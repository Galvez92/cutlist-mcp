"""Importador del formato JSON de Cortecloud.

Formato real, documentado en `docs/memoria/MEMORIA.md`: `{"parts": [...]}` con
`quantity`, `c` (largo, mm), `l` (ancho, mm), `function`, `complement`,
`material` y los cantos `c1`, `c2`, `l1`, `l2` (texto del canto o `null`).

Las piezas se agrupan por el texto `material` del archivo, porque cada material
se corta de su propio tablero. Las medidas del tablero se leen de ese mismo
texto, por ejemplo `(2500x1830)` y `18 mm`; si no aparecen se usan las del
perfil Cortecloud/Madijal: 2500 x 1830 x 18 mm.

Todos los problemas se informan como `ValueError` con el número de la pieza que
falla, para que la vista previa muestre el motivo en lugar de un traceback.

por revisar: la muestra real no trae veta y todos los `machining` vienen vacíos,
así que esos campos todavía no se importan. El kerf no viene en el archivo: se
usa 4 mm como valor de trabajo.
"""

from __future__ import annotations

import json
import math
import re
from dataclasses import dataclass
from pathlib import Path

from .models import EdgeBanding, Part, Sheet

FIXTURE = (
    Path(__file__).resolve().parent.parent
    / "tests"
    / "fixtures"
    / "cortecloud"
    / "escritorio_D_simple.json"
)

DEFAULT_KERF = 4.0
FALLBACK_DIMENSIONS = (2500.0, 1830.0, 18.0)

_SIZE = re.compile(r"(\d+(?:\.\d+)?)\s*[x×]\s*(\d+(?:\.\d+)?)")
_THICKNESS = re.compile(r"(\d+(?:\.\d+)?)\s*mm")


@dataclass(frozen=True)
class MaterialGroup:
    """Piezas de un mismo material y el tablero del que se cortan."""

    material: str
    sheet: Sheet
    parts: list[Part]

    @property
    def sheets(self) -> list[Sheet]:
        """El tablero derivado del texto del material."""
        return [self.sheet]

    @property
    def piece_count(self) -> int:
        return sum(part.quantity for part in self.parts)


def parse_cortecloud_json(text: str) -> list[MaterialGroup]:
    """Convierte el JSON de Cortecloud en grupos de material del motor."""
    try:
        data = json.loads(text)
    except json.JSONDecodeError as error:
        raise ValueError(f"JSON inválido: {error}") from error

    if not isinstance(data, dict) or not isinstance(data.get("parts"), list):
        raise ValueError("se espera un objeto JSON con la clave «parts»")

    rows = data["parts"]
    if not rows:
        raise ValueError("el archivo no tiene piezas")

    grouped: dict[str, list[Part]] = {}
    for index, row in enumerate(rows, start=1):
        if not isinstance(row, dict):
            raise ValueError(f"pieza {index}: se espera un objeto")
        material = str(row.get("material") or "").strip()
        if not material:
            raise ValueError(f"pieza {index}: falta «material»")
        grouped.setdefault(material, []).append(_row_to_part(row, index, material))

    return [
        MaterialGroup(material=material, sheet=_sheet_for(material), parts=parts)
        for material, parts in grouped.items()
    ]


def load_fixture(path: str | Path = FIXTURE) -> list[MaterialGroup]:
    """Grupos de material del fixture del repositorio (o de `path`).

    Los errores de lectura —archivo ausente, ruta que es un directorio, bytes que
    no son UTF-8— se convierten en `ValueError` para poder mostrarlos tal cual.
    """
    path = Path(path)
    try:
        text = path.read_text(encoding="utf-8")
    except FileNotFoundError as error:
        raise ValueError(f"no se encontró el archivo {path}") from error
    except IsADirectoryError as error:
        raise ValueError(f"{path} es un directorio, no un archivo") from error
    except UnicodeDecodeError as error:
        raise ValueError(f"{path} no está codificado en UTF-8: {error}") from error
    except OSError as error:
        raise ValueError(f"no se pudo leer {path}: {error}") from error
    return parse_cortecloud_json(text)


def _row_to_part(row: dict, index: int, material: str) -> Part:
    width = _measure(row, "l", index)  # l = ancho
    height = _measure(row, "c", index)  # c = largo
    quantity = _quantity(row, index)

    try:
        return Part(
            width=width,
            height=height,
            quantity=quantity,
            label=str(row.get("function") or "").strip(),
            material=material,
            edges=EdgeBanding(
                c1=_edge(row, "c1", index),
                c2=_edge(row, "c2", index),
                l1=_edge(row, "l1", index),
                l2=_edge(row, "l2", index),
            ),
        )
    except ValueError as error:
        raise ValueError(f"pieza {index}: {error}") from error


def _measure(row: dict, key: str, index: int) -> float:
    raw = row.get(key)
    if isinstance(raw, bool) or not isinstance(raw, (int, float, str)):
        raise ValueError(f"pieza {index}: falta el campo {key!r} o no es un número")
    try:
        value = float(raw)
    except ValueError as error:
        raise ValueError(f"pieza {index}: medida inválida en {key!r}: {raw!r}") from error
    if not math.isfinite(value):
        raise ValueError(f"pieza {index}: medida no finita en {key!r}: {raw!r}")
    return value


def _quantity(row: dict, index: int) -> int:
    raw = row.get("quantity", 1)
    if isinstance(raw, bool):
        raise ValueError(f"pieza {index}: cantidad inválida: {raw!r}")
    if isinstance(raw, int):
        return raw
    if isinstance(raw, float):
        if not raw.is_integer():
            raise ValueError(f"pieza {index}: la cantidad debe ser entera: {raw!r}")
        return int(raw)
    if isinstance(raw, str) and raw.strip().lstrip("+-").isdigit():
        return int(raw.strip())
    raise ValueError(f"pieza {index}: cantidad inválida: {raw!r}")


def _edge(row: dict, key: str, index: int) -> str | None:
    raw = row.get(key)
    if raw is None:
        return None
    if not isinstance(raw, str):
        raise ValueError(f"pieza {index}: canto {key!r} inválido: {raw!r}")
    return raw.strip() or None


def _sheet_for(material: str) -> Sheet:
    size = _SIZE.search(material)
    fallback_width, fallback_height, fallback_thickness = FALLBACK_DIMENSIONS
    thickness = _THICKNESS.search(material)
    return Sheet(
        width=float(size.group(1)) if size else fallback_width,
        height=float(size.group(2)) if size else fallback_height,
        thickness=float(thickness.group(1)) if thickness else fallback_thickness,
        kerf=DEFAULT_KERF,
        label=material,
        material=material,
    )
