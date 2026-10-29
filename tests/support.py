"""Utilidades compartidas por las pruebas."""

from cutlist.models import EPS


def dxf_document(entities, insunits=4):
    """DXF ASCII mínimo: HEADER con las unidades y la sección ENTITIES."""
    lines = ["0", "SECTION", "2", "HEADER"]
    if insunits is not None:
        lines += ["9", "$INSUNITS", "70", str(insunits)]
    lines += ["0", "ENDSEC", "0", "SECTION", "2", "ENTITIES"]
    for entity in entities:
        lines += entity
    lines += ["0", "ENDSEC", "0", "EOF"]
    return "\n".join(lines) + "\n"


def lwpolyline(points, layer="Roble", closed=True):
    """Entidad LWPOLYLINE cerrada con sus vértices."""
    lines = ["0", "LWPOLYLINE", "8", layer, "90", str(len(points)), "70", "1" if closed else "0"]
    for x, y in points:
        lines += ["10", f"{x:g}", "20", f"{y:g}"]
    return lines


def assert_layouts_valid(testcase, layouts) -> None:
    """Cada pieza queda dentro de su tablero y ninguna se solapa con otra."""
    for layout in layouts:
        sheet = layout.sheet
        for placement in layout.placements:
            testcase.assertGreaterEqual(placement.x, -EPS)
            testcase.assertGreaterEqual(placement.y, -EPS)
            testcase.assertLessEqual(placement.x + placement.width, sheet.width + EPS)
            testcase.assertLessEqual(placement.y + placement.height, sheet.height + EPS)

        placements = layout.placements
        for index, first in enumerate(placements):
            for second in placements[index + 1 :]:
                overlap_x = min(first.x + first.width, second.x + second.width) - max(
                    first.x, second.x
                )
                overlap_y = min(first.y + first.height, second.y + second.height) - max(
                    first.y, second.y
                )
                testcase.assertFalse(
                    overlap_x > EPS and overlap_y > EPS,
                    f"{first.piece.label} se solapa con {second.piece.label} "
                    f"en el tablero {layout.index}",
                )
