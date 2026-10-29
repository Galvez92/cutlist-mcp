import unittest

from cutlist.maxrects import _subtract, pack
from cutlist.models import Part, Piece, Rect, Sheet, SheetLayout
from tests.support import assert_layouts_valid


def pieces(*parts):
    out = []
    for part in parts:
        out.extend(Piece(part=part, number=len(out) + 1) for _ in range(part.quantity))
    return out


def layout_for(placements, sheet):
    return SheetLayout(index=1, sheet=sheet, placements=placements, algorithm="nonguillotine")


class MaxRectsPackTest(unittest.TestCase):
    def test_coloca_dos_piezas_con_kerf(self):
        sheet = Sheet(width=204, height=100, kerf=4)
        placed, remaining = pack(pieces(Part(100, 100, quantity=2)), sheet)
        self.assertEqual(remaining, [])
        self.assertEqual(len(placed), 2)
        assert_layouts_valid(self, [layout_for(placed, sheet)])

    def test_no_solapa_piezas_grandes(self):
        sheet = Sheet(width=1000, height=1000, kerf=4)
        placed, remaining = pack(pieces(Part(600, 400, quantity=3)), sheet)
        self.assertGreater(len(placed), 0)
        assert_layouts_valid(self, [layout_for(placed, sheet)])

    def test_respeta_la_veta(self):
        sheet = Sheet(width=100, height=200, kerf=0)
        placed, remaining = pack(pieces(Part(100, 200, grain=True)), sheet)
        self.assertEqual(len(placed), 1)
        self.assertFalse(placed[0].rotated)
        self.assertEqual(remaining, [])

    def test_pieza_mayor_que_el_tablero_sobra(self):
        sheet = Sheet(width=100, height=100)
        placed, remaining = pack(pieces(Part(200, 200)), sheet)
        self.assertEqual(placed, [])
        self.assertEqual(len(remaining), 1)

    def test_el_hueco_libre_puede_quedar_en_forma_de_l(self):
        """Los huecos no se limitan a un corte de guillotina: se solapan en la esquina."""
        free = _subtract(Rect(0, 0, 100, 100), Rect(0, 0, 60, 40))
        self.assertEqual(
            sorted((rect.x, rect.y, rect.w, rect.h) for rect in free),
            [(0.0, 40.0, 100.0, 60.0), (60.0, 0.0, 40.0, 100.0)],
        )

    def test_layout_valido_con_piezas_mezcladas(self):
        sheet = Sheet(width=2500, height=1830, kerf=4)
        parts = [
            Part(600, 732, quantity=2),
            Part(564, 732, quantity=2),
            Part(1700, 600),
            Part(300, 400, quantity=4),
        ]
        placed, remaining = pack(pieces(*parts), sheet)
        self.assertGreater(len(placed), 0)
        assert_layouts_valid(self, [layout_for(placed, sheet)])


if __name__ == "__main__":
    unittest.main()
