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

Del objeto `machining` de cada pieza se importan sólo las medidas que el perfil
Cortecloud/Madijal restringe: el `diameter` de cada barreno (`verticalDrills` y
`horizontalDrills`) y el `width` de cada ranura (`furrowMachining` y
`furrowMachiningPair`). Las ranuras y barrenos fuera del perfil no se rechazan
aquí: quedan en la pieza y `Constraints` los reporta como avisos.

Veta: el archivo no trae un campo de veta. Cortecloud documenta que el largo
(`c`) siempre sigue la veta del tablero cuando el tablero tiene veta, así que
cada pieza se importa con `grain=True` (el motor no la gira) y conserva el largo
en la dirección de la veta. Fuente: «Como importar tu lista de piezas de Excel
para Cortecloud», https://ayuda.vendedores.cortecloud.com/help/como-importar-tu-lista-de-piezas-de-excel-para-cortecloud
por revisar: el archivo no distingue tableros con veta de tableros sin veta, y
la dirección de veta del tablero no se modela; la regla se aplica a todas las
piezas de Cortecloud.

Todos los `horizontalDrills` de la muestra están vacíos y
`furrowMachiningPair` siempre es `null`: de esos dos se asume que repiten la
forma de `verticalDrills` y `furrowMachining` (mismo `diameter`/`width`). El
kerf no viene en el archivo: se usa 4 mm como valor de trabajo.
"""

from __future__ import annotations

import json
import math
import re
from dataclasses import dataclass
from pathlib import Path

from .models import EdgeBanding, Machining, Part, Sheet

FIXTURE = (
    Path(__file__).resolve().parent.parent
    / "tests"
    / "fixtures"
    / "cortecloud"
    / "escritorio_D_simple.json"
)

DEFAULT_KERF = 4.0
FALLBACK_DIMENSIONS = (2500.0, 1830.0, 18.0)

# Cortecloud: «el largo siempre sigue la veta del tablero (si él tiene veta)».
# Las piezas se importan con veta para que el motor no las gire y el largo (c)
# quede en la dirección de la veta.
GRAIN_FOLLOWS_LARGO = True

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
            grain=GRAIN_FOLLOWS_LARGO,
            material=material,
            edges=EdgeBanding(
                c1=_edge(row, "c1", index),
                c2=_edge(row, "c2", index),
                l1=_edge(row, "l1", index),
                l2=_edge(row, "l2", index),
            ),
            machining=_machining(row, index),
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


def _machining(row: dict, index: int) -> Machining | None:
    """Ranuras y barrenos de la pieza (`machining` del archivo)."""
    raw = row.get("machining")
    if raw is None:
        return None
    if not isinstance(raw, dict):
        raise ValueError(f"pieza {index}: «machining» debe ser un objeto o null")
    machining = Machining(
        vertical_drills=_drill_diameters(raw, "verticalDrills", index),
        horizontal_drills=_drill_diameters(raw, "horizontalDrills", index),
        slots=_slot_widths(raw, index),
    )
    return None if machining.is_empty else machining


def _drill_diameters(raw: dict, key: str, index: int) -> tuple[float, ...]:
    drills = raw.get(key)
    if drills is None:
        return ()
    if not isinstance(drills, list):
        raise ValueError(f"pieza {index}: «{key}» debe ser una lista")
    return tuple(
        _positive(drill.get("diameter"), index, f"diámetro de barreno en «{key}»")
        for drill in _objects(drills, key, index)
    )


def _slot_widths(raw: dict, index: int) -> tuple[float, ...]:
    widths: list[float] = []
    for key in ("furrowMachining", "furrowMachiningPair"):
        furrow = raw.get(key)
        if furrow is None:
            continue
        entries = furrow if isinstance(furrow, list) else [furrow]
        for entry in _objects(entries, key, index):
            widths.append(
                _positive(
                    entry.get("width"),
                    index,
                    f"ancho de ranura en «{key}» (forma por revisar)",
                )
            )
    return tuple(widths)


def _objects(entries: list, key: str, index: int) -> list[dict]:
    objects: list[dict] = []
    for entry in entries:
        if not isinstance(entry, dict):
            raise ValueError(f"pieza {index}: cada elemento de «{key}» debe ser un objeto")
        objects.append(entry)
    return objects


def _positive(raw, index: int, what: str) -> float:
    if isinstance(raw, bool) or not isinstance(raw, (int, float)):
        raise ValueError(f"pieza {index}: {what} inválido: {raw!r}")
    value = float(raw)
    if not math.isfinite(value) or value <= 0:
        raise ValueError(f"pieza {index}: {what} inválido: {raw!r}")
    return value


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
