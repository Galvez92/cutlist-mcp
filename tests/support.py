"""Utilidades compartidas por las pruebas."""

from cutlist.models import EPS


def dxf_document(entities, insunits=4, blocks=()):
    """DXF ASCII mínimo: HEADER con las unidades, BLOCKS opcional y ENTITIES."""
    lines = ["0", "SECTION", "2", "HEADER"]
    if insunits is not None:
        lines += ["9", "$INSUNITS", "70", str(insunits)]
    lines += ["0", "ENDSEC"]
    if blocks:
        lines += ["0", "SECTION", "2", "BLOCKS"]
        for block_lines in blocks:
            lines += block_lines
        lines += ["0", "ENDSEC"]
    lines += ["0", "SECTION", "2", "ENTITIES"]
    for entity in entities:
        lines += entity
    lines += ["0", "ENDSEC", "0", "EOF"]
    return "\n".join(lines) + "\n"


def block(name, entities, base=(0, 0), layer="0"):
    """Definición de bloque (BLOCK ... ENDBLK) con sus entidades."""
    lines = [
        "0", "BLOCK", "8", layer, "2", name, "70", "0",
        "10", f"{base[0]:g}", "20", f"{base[1]:g}",
    ]
    for entity in entities:
        lines += entity
    lines += ["0", "ENDBLK"]
    return lines


def insert(
    name,
    x=0,
    y=0,
    layer="Roble",
    scale=(1, 1),
    rotation=0,
    columns=1,
    rows=1,
    spacing=(0, 0),
):
    """Referencia a un bloque, con escala, rotación y arreglo opcionales."""
    lines = ["0", "INSERT", "8", layer, "2", name, "10", f"{x:g}", "20", f"{y:g}"]
    if scale != (1, 1):
        lines += ["41", f"{scale[0]:g}", "42", f"{scale[1]:g}"]
    if rotation:
        lines += ["50", f"{rotation:g}"]
    if columns != 1 or rows != 1:
        lines += [
            "70", str(columns), "71", str(rows),
            "44", f"{spacing[0]:g}", "45", f"{spacing[1]:g}",
        ]
    return lines


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
