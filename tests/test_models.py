import unittest

from cutlist.models import Constraints, EdgeBanding, Part, Rect, Sheet


class PartTest(unittest.TestCase):
    def test_rechaza_medidas_no_positivas(self):
        with self.assertRaises(ValueError):
            Part(width=0, height=100)
        with self.assertRaises(ValueError):
            Part(width=100, height=-5)

    def test_rechaza_cantidad_invalida(self):
        with self.assertRaises(ValueError):
            Part(width=100, height=100, quantity=0)

    def test_area_y_lado_mayor(self):
        part = Part(width=300, height=800)
        self.assertEqual(part.area, 240000)
        self.assertEqual(part.max_side, 800)

    def test_cantos_se_describen(self):
        edges = EdgeBanding(c1="PVC roble", l1="PVC roble")
        self.assertFalse(edges.is_empty)
        self.assertEqual(edges.describe(), "c1=PVC roble; l1=PVC roble")
        self.assertTrue(EdgeBanding().is_empty)
        self.assertEqual(EdgeBanding().describe(), "")


class SheetTest(unittest.TestCase):
    def test_rechaza_medidas_no_positivas(self):
        with self.assertRaises(ValueError):
            Sheet(width=0, height=1830)

    def test_rechaza_kerf_negativo(self):
        with self.assertRaises(ValueError):
            Sheet(width=2500, height=1830, kerf=-1)


class ConstraintsTest(unittest.TestCase):
    def test_pieza_valida_no_tiene_avisos(self):
        self.assertEqual(Constraints().violations(Part(width=600, height=732)), [])

    def test_avisa_pieza_bajo_el_minimo_de_corte(self):
        problems = Constraints().violations(Part(width=50, height=300, label="tirante"))
        self.assertTrue(any("mínimo de corte" in problem for problem in problems))
        self.assertTrue(any("tirante" in problem for problem in problems))

    def test_avisa_pieza_sobre_el_maximo(self):
        problems = Constraints().violations(Part(width=3000, height=900))
        self.assertTrue(any("sobre el máximo" in problem for problem in problems))

    def test_avisa_pieza_mecanizada_corta(self):
        problems = Constraints().violations(Part(width=100, height=150))
        self.assertTrue(any("mecanizada" in problem for problem in problems))


class RectTest(unittest.TestCase):
    def test_interseccion_y_contencion(self):
        rect = Rect(0, 0, 100, 100)
        self.assertTrue(rect.intersects(Rect(50, 50, 100, 100)))
        self.assertFalse(rect.intersects(Rect(100, 0, 50, 50)))
        self.assertTrue(rect.contains(Rect(10, 10, 20, 20)))
        self.assertFalse(rect.contains(Rect(90, 90, 20, 20)))


if __name__ == "__main__":
    unittest.main()
