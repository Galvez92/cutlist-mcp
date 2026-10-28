"""Importador del JSON de Cortecloud.

Formato documentado en `docs/memoria/MEMORIA.md` y verificado contra la muestra
real `tests/fixtures/cortecloud/escritorio_D_simple.json`:

    {"parts": [{"quantity", "c", "l", "function", "complement", "material",
                "c1", "c2", "l1", "l2", "machining"}]}

`c` es el largo y `l` el ancho (mm). El nombre del material trae el espesor y
las medidas del tablero, p. ej. "Moscato 2 C 18 mm 771L ARAUCO (2500x1830)".
La veta y el material asociado no vienen en el archivo (por revisar).
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field

from ..models import Part, StockSheet

DEFAULT_KERF = 4.0
DEFAULT_THICKNESS = 18.0

_SHEET_RE = re.compile(r"\(\s*(\d+(?:[.,]\d+)?)\s*[x×]\s*(\d+(?:[.,]\d+)?)\s*\)")
_THICKNESS_RE = re.compile(r"(\d+(?:[.,]\d+)?)\s*mm", re.IGNORECASE)


class CortecloudImportError(ValueError):
    """El archivo no tiene el formato esperado."""


@dataclass
class CutDocument:
    parts: list[Part] = field(default_factory=list)
    stocks: list[StockSheet] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)


def _number(value, field_name: str) -> float:
    if isinstance(value, (int, float)):
        return float(value)
    if isinstance(value, str):
        try:
            return float(value.replace(",", ".").strip())
        except ValueError:
            pass
    raise CortecloudImportError(f"Valor numérico inválido en `{field_name}`: {value!r}")


def stock_from_material(material: str, kerf: float = DEFAULT_KERF) -> StockSheet:
    """Tablero deducido del nombre del material: "(2500x1830)" y "18 mm"."""
    sheet = _SHEET_RE.search(material)
    if not sheet:
        raise CortecloudImportError(
            f"El material no indica medidas de tablero (ancho x alto): {material!r}"
        )
    thickness = _THICKNESS_RE.search(material)
    return StockSheet(
        material=material,
        length=_number(sheet.group(1), "material"),
        width=_number(sheet.group(2), "material"),
        thickness=_number(thickness.group(1), "material") if thickness else DEFAULT_THICKNESS,
        kerf=kerf,
    )


def _edges(row: dict) -> dict:
    return {key: row.get(key) for key in ("c1", "c2", "l1", "l2") if row.get(key)}


def parse_cortecloud(data: dict, kerf: float = DEFAULT_KERF) -> CutDocument:
    """Convierte el JSON de Cortecloud en piezas y tableros."""
    if not isinstance(data, dict) or not isinstance(data.get("parts"), list):
        raise CortecloudImportError("El JSON debe tener la forma {\"parts\": [...]}")

    document = CutDocument()
    stocks: dict[str, StockSheet] = {}

    for index, row in enumerate(data["parts"], start=1):
        if not isinstance(row, dict):
            raise CortecloudImportError(f"La pieza #{index} no es un objeto")

        material = str(row.get("material") or "").strip()
        if not material:
            raise CortecloudImportError(f"La pieza #{index} no indica material")

        quantity = int(_number(row.get("quantity", 1), "quantity"))
        if quantity < 1:
            document.warnings.append(f"Pieza #{index} con cantidad {quantity}: se omite")
            continue

        if material not in stocks:
            stocks[material] = stock_from_material(material, kerf=kerf)

        complement = str(row.get("complement") or "").strip()
        module = complement.split()[0] if complement else "P"
        document.parts.append(
            Part(
                ref=f"{module}-{index:02d}",
                name=str(row.get("function") or "").strip() or f"Pieza {index}",
                length=_number(row.get("c"), f"c (pieza #{index})"),
                width=_number(row.get("l"), f"l (pieza #{index})"),
                material=material,
                qty=quantity,
                grain=False,
                edges=_edges(row),
            )
        )

    if not document.parts:
        raise CortecloudImportError("El archivo no contiene piezas")

    document.stocks = list(stocks.values())
    document.warnings.append(
        "La veta no viene en el formato Cortecloud: se permite girar las piezas (por revisar)."
    )
    return document
