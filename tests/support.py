"""Utilidades compartidas por las pruebas."""

from cutlist.models import EPS


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
