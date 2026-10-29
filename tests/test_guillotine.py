import unittest

from cutlist.guillotine import pack
from cutlist.models import Part, Piece, Sheet, SheetLayout
from tests.support import assert_layouts_valid


def pieces(*parts):
    out = []
    for part in parts:
        out.extend(Piece(part=part, number=len(out) + 1) for _ in range(part.quantity))
    return out


def layout_for(placements, sheet):
    return SheetLayout(index=1, sheet=sheet, placements=placements, algorithm="guillotine")


class GuillotinePackTest(unittest.TestCase):
    def test_el_kerf_separa_las_piezas(self):
        sheet = Sheet(width=204, height=100, kerf=4)
        placed, remaining = pack(pieces(Part(100, 100, quantity=2)), sheet)
        self.assertEqual(remaining, [])
        self.assertEqual([p.x for p in placed], [0, 104])
        self.assertTrue(all(p.y == 0 for p in placed))
        assert_layouts_valid(self, [layout_for(placed, sheet)])

    def test_sin_espacio_para_el_kerf_la_pieza_sobra(self):
        sheet = Sheet(width=203, height=100, kerf=4)
        placed, remaining = pack(pieces(Part(100, 100, quantity=2)), sheet)
        self.assertEqual(len(placed), 1)
        self.assertEqual(len(remaining), 1)

    def test_kerf_cero_permite_dos_piezas_exactas(self):
        sheet = Sheet(width=200, height=100, kerf=0)
        placed, remaining = pack(pieces(Part(100, 100, quantity=2)), sheet)
        self.assertEqual(remaining, [])
        self.assertEqual([p.x for p in placed], [0, 100])

    def test_gira_la_pieza_si_no_tiene_veta(self):
        sheet = Sheet(width=200, height=100, kerf=0)
        placed, remaining = pack(pieces(Part(100, 200)), sheet)
        self.assertEqual(remaining, [])
        self.assertTrue(placed[0].rotated)
        self.assertEqual((placed[0].width, placed[0].height), (200, 100))

    def test_la_veta_impide_girar(self):
        sheet = Sheet(width=200, height=100, kerf=0)
        placed, remaining = pack(pieces(Part(100, 200, grain=True)), sheet)
        self.assertEqual(placed, [])
        self.assertEqual(len(remaining), 1)

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
