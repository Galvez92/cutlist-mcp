"""Catálogo de stocks: validación y persistencia entre sesiones.

El catálogo es la lista de tableros que el optimizador puede usar, cada uno con
su material (ver `cutlist/stock.py`). Se guarda como JSON para reutilizarlo en
cualquier sesión o navegador; por defecto en `data/stocks.json` y se puede
cambiar con la variable de entorno `CUTLIST_STOCKS`.

El formato es **propio de cutlist-mcp**:

    {"stocks": [{"material": "Roble", "width": 2500, "height": 1830,
                 "thickness": 18, "kerf": 4}]}

`schema` está sólo para poder migrar el archivo más adelante; se escribe y se
ignora al leer.
"""

from __future__ import annotations

import json
import math
import os
from dataclasses import dataclass
from pathlib import Path
from typing import Sequence

from .models import Sheet

SCHEMA = 1

DEFAULT_STOCKS = [
    {"material": "", "width": 2500.0, "height": 1830.0, "thickness": 18.0, "kerf": 4.0}
]

MEASURES = ("width", "height", "thickness", "kerf")


def parse_catalog(data, default_label: str = "Stock") -> list[Sheet]:
    """Valida una lista de stocks y devuelve los tableros del motor.

    Cada stock es un objeto con `material` (texto; vacío = comodín) y las
    medidas `width`, `height`, `thickness` y `kerf` en milímetros. Las medidas
    que faltan toman el valor por defecto de la API: 2500 × 1830 × 18 mm con
    kerf de 4 mm.
    """
    if not isinstance(data, list):
        raise ValueError("«stocks» debe ser una lista de objetos")
    if not data:
        raise ValueError("«stocks» está vacío")

    sheets: list[Sheet] = []
    for index, item in enumerate(data, start=1):
        if not isinstance(item, dict):
            raise ValueError(f"stock {index}: se espera un objeto")
        material = str(item.get("material") or "").strip()
        label = material or f"{default_label} {index}"
        values = {
            field: _measure(item, field, DEFAULT_STOCKS[0][field], index)
            for field in MEASURES
        }
        try:
            sheets.append(Sheet(**values, label=label, material=material))
        except ValueError as error:
            raise ValueError(f"stock {index}: {error}") from error
    return sheets


def sheet_to_dict(sheet: Sheet) -> dict:
    """Un tablero como objeto JSON (lo que devuelve la API)."""
    return {
        "material": sheet.material,
        "label": sheet.label,
        "width": sheet.width,
        "height": sheet.height,
        "thickness": sheet.thickness,
        "kerf": sheet.kerf,
    }


def _stored_dict(sheet: Sheet) -> dict:
    """Lo que se guarda: la etiqueta se deriva del material al leer."""
    return {
        "material": sheet.material,
        "width": sheet.width,
        "height": sheet.height,
        "thickness": sheet.thickness,
        "kerf": sheet.kerf,
    }


def _measure(data: dict, field: str, default: float, index: int) -> float:
    raw = data.get(field, default)
    text = str(raw).strip().replace(",", ".")
    if not text:
        return float(default)
    try:
        value = float(text)
    except ValueError:
        raise ValueError(
            f"stock {index}: «{field}» no es un número: {raw!r}"
        ) from None
    if not math.isfinite(value):
        raise ValueError(f"stock {index}: «{field}» no es un número finito: {raw!r}")
    return value


@dataclass(frozen=True)
class CatalogStore:
    """Lectura y escritura del catálogo en un archivo JSON."""

    path: Path

    def load(self) -> tuple[list[Sheet], str | None]:
        """Catálogo guardado; si no hay archivo, el catálogo por defecto.

        Un archivo ilegible o inválido no rompe la página: se usa el catálogo
        por defecto y se devuelve un aviso con el motivo.
        """
        try:
            text = self.path.read_text(encoding="utf-8")
        except FileNotFoundError:
            return parse_catalog(DEFAULT_STOCKS), None
        except OSError as error:
            return parse_catalog(DEFAULT_STOCKS), (
                f"no se pudo leer el catálogo guardado ({error.strerror or error}); "
                f"se usa el de por defecto"
            )

        try:
            data = json.loads(text)
        except json.JSONDecodeError as error:
            return parse_catalog(DEFAULT_STOCKS), (
                f"el catálogo guardado no es JSON válido (línea {error.lineno}); "
                f"se usa el de por defecto"
            )

        stocks = data.get("stocks") if isinstance(data, dict) else data
        try:
            return parse_catalog(stocks), None
        except ValueError as error:
            return parse_catalog(DEFAULT_STOCKS), (
                f"el catálogo guardado no es válido ({error}); se usa el de por defecto"
            )

    def save(self, sheets: Sequence[Sheet]) -> list[Sheet]:
        """Guarda el catálogo de forma atómica y devuelve lo guardado."""
        sheets = list(sheets)
        if not sheets:
            raise ValueError("«stocks» está vacío")
        payload = {
            "schema": SCHEMA,
            "stocks": [_stored_dict(sheet) for sheet in sheets],
        }
        self.path.parent.mkdir(parents=True, exist_ok=True)
        temporary = self.path.with_name(self.path.name + ".tmp")
        temporary.write_text(
            json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
        )
        os.replace(temporary, self.path)
        return sheets
