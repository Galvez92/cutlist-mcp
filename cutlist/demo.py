"""Entrada de demostración: el fixture real de Cortecloud.

El archivo `tests/fixtures/cortecloud/escritorio_D_simple.json` es una muestra
real saneada del formato (ver `docs/memoria/MEMORIA.md`). Aquí sólo se mapea lo
que el motor necesita; el importador completo del formato es la tarea
`formatos-import-export` y la asignación de materiales todavía no se resuelve,
así que todas las piezas se optimizan sobre un único stock.
"""

from __future__ import annotations

import json
import re
from pathlib import Path

from .models import EdgeBanding, Part, Sheet

FIXTURE = (
    Path(__file__).resolve().parent.parent
    / "tests"
    / "fixtures"
    / "cortecloud"
    / "escritorio_D_simple.json"
)

DEFAULT_SHEET = Sheet(
    width=2500.0,
    height=1830.0,
    thickness=18.0,
    kerf=4.0,
    label="Stock 2500×1830×18 · asignación de materiales pendiente",
)


def load_demo_parts(fixture: Path = FIXTURE) -> tuple[list[Part], Sheet]:
    """Piezas y stock del fixture, en el modelo del motor."""
    data = json.loads(fixture.read_text(encoding="utf-8"))
    rows = data.get("parts", [])

    parts = [
        Part(
            width=float(row["l"]),  # l = ancho
            height=float(row["c"]),  # c = largo
            quantity=int(row.get("quantity", 1)),
            label=str(row.get("function") or ""),
            edges=EdgeBanding(
                c1=row.get("c1"),
                c2=row.get("c2"),
                l1=row.get("l1"),
                l2=row.get("l2"),
            ),
        )
        for row in rows
    ]
    return parts, _sheet_from_materials(rows)


def _sheet_from_materials(rows: list[dict]) -> Sheet:
    """Medidas del stock tal como aparecen en el texto `material` del fixture."""
    for row in rows:
        material = str(row.get("material") or "")
        size = re.search(r"(\d+(?:\.\d+)?)\s*[x×]\s*(\d+(?:\.\d+)?)", material)
        if not size:
            continue
        thickness = re.search(r"(\d+(?:\.\d+)?)\s*mm", material)
        return Sheet(
            width=float(size.group(1)),
            height=float(size.group(2)),
            thickness=float(thickness.group(1)) if thickness else 18.0,
            kerf=4.0,
            label=DEFAULT_SHEET.label,
        )
    return DEFAULT_SHEET
