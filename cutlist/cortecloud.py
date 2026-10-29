"""Importador del formato JSON de Cortecloud.

Formato real, documentado en `docs/memoria/MEMORIA.md`: `{"parts": [...]}` con
`quantity`, `c` (largo, mm), `l` (ancho, mm), `function`, `complement`,
`material` y los cantos `c1`, `c2`, `l1`, `l2` (texto del canto o `null`).

Las piezas se agrupan por el texto `material` del archivo, porque cada material
se corta de su propio tablero. Las medidas del tablero se leen de ese mismo
texto, por ejemplo `(2500x1830)` y `18 mm`; si no aparecen se usan las del
perfil Cortecloud/Madijal: 2500 x 1830 x 18 mm.

por revisar: la muestra real no trae veta y todos los `machining` vienen vacíos,
así que esos campos todavía no se importan. El kerf no viene en el archivo: se
usa 4 mm como valor de trabajo.
"""

from __future__ import annotations

import json
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
        grouped.setdefault(material, []).append(_row_to_part(row, index))

    return [
        MaterialGroup(material=material, sheet=_sheet_for(material), parts=parts)
        for material, parts in grouped.items()
    ]


def load_fixture(path: Path = FIXTURE) -> list[MaterialGroup]:
    """Grupos del fixture real del repositorio."""
    return parse_cortecloud_json(path.read_text(encoding="utf-8"))


def _row_to_part(row: dict, index: int) -> Part:
    try:
        width = float(row["l"])  # l = ancho
        height = float(row["c"])  # c = largo
    except KeyError as error:
        raise ValueError(f"pieza {index}: falta el campo {error.args[0]!r}") from error
    except (TypeError, ValueError) as error:
        raise ValueError(f"pieza {index}: medida inválida") from error

    try:
        quantity = int(row.get("quantity", 1))
    except (TypeError, ValueError) as error:
        raise ValueError(f"pieza {index}: cantidad inválida") from error

    try:
        return Part(
            width=width,
            height=height,
            quantity=quantity,
            label=str(row.get("function") or "").strip(),
            edges=EdgeBanding(
                c1=_edge(row.get("c1")),
                c2=_edge(row.get("c2")),
                l1=_edge(row.get("l1")),
                l2=_edge(row.get("l2")),
            ),
        )
    except ValueError as error:
        raise ValueError(f"pieza {index}: {error}") from error


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
    )


def _edge(value) -> str | None:
    text = str(value).strip() if value is not None else ""
    return text or None
