import unittest

from cutlist.demo import load_demo_parts
from cutlist.optimizer import optimize


class DemoFixtureTest(unittest.TestCase):
    def setUp(self):
        self.parts, self.sheet = load_demo_parts()

    def test_lee_todas_las_piezas_del_fixture(self):
        self.assertEqual(sum(part.quantity for part in self.parts), 30)
        self.assertTrue(all(part.width > 0 and part.height > 0 for part in self.parts))

    def test_stock_desde_el_material_del_fixture(self):
        self.assertEqual((self.sheet.width, self.sheet.height), (2500.0, 1830.0))
        self.assertEqual(self.sheet.thickness, 18.0)
        self.assertEqual(self.sheet.kerf, 4.0)

    def test_optimiza_todas_las_piezas(self):
        result = optimize(self.parts, [self.sheet], max_sheets=30)
        self.assertEqual(result.unplaced, [])
        self.assertEqual(result.piece_count, 30)
        self.assertGreater(result.yield_percent, 0)
        self.assertLessEqual(result.yield_percent, 100)


if __name__ == "__main__":
    unittest.main()
