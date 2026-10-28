"""Lista de corte en CSV (separador `;` para abrir en planillas en español)."""

from __future__ import annotations

import csv
import io

from ..models import MaterialLayout

HEADER = [
    "referencia",
    "pieza",
    "material",
    "largo_mm",
    "ancho_mm",
    "hoja",
    "x_mm",
    "y_mm",
    "girada",
    "canto_c1",
    "canto_c2",
    "canto_l1",
    "canto_l2",
]


def material_csv(layout: MaterialLayout) -> str:
    buffer = io.StringIO()
    writer = csv.writer(buffer, delimiter=";", lineterminator="\n")
    writer.writerow(HEADER)
    for sheet in layout.sheets:
        for placed in sheet.placements:
            writer.writerow(
                [
                    placed.ref,
                    placed.name,
                    layout.material,
                    f"{placed.length:g}",
                    f"{placed.width:g}",
                    sheet.index,
                    f"{placed.x:g}",
                    f"{placed.y:g}",
                    "si" if placed.rotated else "no",
                    placed.edges.get("c1") or "",
                    placed.edges.get("c2") or "",
                    placed.edges.get("l1") or "",
                    placed.edges.get("l2") or "",
                ]
            )
    return buffer.getvalue()
