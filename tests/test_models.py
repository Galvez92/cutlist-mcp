import unittest

from cutlist.models import Constraints, EdgeBanding, Machining, Part, Rect, Sheet


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


class MachiningConstraintsTest(unittest.TestCase):
    """Ranuras y barrenos del perfil Cortecloud/Madijal."""

    def violations(self, machining):
        return Constraints().violations(
            Part(width=600, height=732, label="tapa", machining=machining)
        )

    def test_ranuras_y_barrenos_del_perfil_no_avisan(self):
        machining = Machining(
            vertical_drills=(8.0, 35.0),
            horizontal_drills=(3.0, 8.0),
            slots=(5.7, 9.7, 25.7),
        )
        self.assertEqual(self.violations(machining), [])

    def test_avisa_ranura_no_permitida(self):
        problems = self.violations(Machining(slots=(8.0,)))
        self.assertTrue(any("ranura de 8 mm" in problem for problem in problems))
        self.assertTrue(any("permitidas: 5.7/6.2/6.7" in problem for problem in problems))
        self.assertTrue(any("tapa" in problem for problem in problems))

    def test_avisa_barreno_vertical_no_permitido(self):
        problems = self.violations(Machining(vertical_drills=(6.0,)))
        self.assertTrue(any("barreno vertical Ø6 mm" in problem for problem in problems))
        self.assertTrue(any("permitidos: 3/5/8/10/15/20/35" in problem for problem in problems))

    def test_avisa_barreno_horizontal_no_permitido(self):
        problems = self.violations(Machining(horizontal_drills=(10.0,)))
        self.assertTrue(any("barreno horizontal Ø10 mm" in problem for problem in problems))
        self.assertTrue(any("permitidos: 3/8 mm" in problem for problem in problems))

    def test_pieza_sin_mecanizado_no_avisa(self):
        self.assertEqual(self.violations(None), [])
        self.assertEqual(self.violations(Machining()), [])

    def test_perfil_personalizado_cambia_las_medidas_permitidas(self):
        constraints = Constraints(slot_widths=(8.0,), vertical_drill_diameters=(6.0,))
        self.assertEqual(
            constraints.violations(
                Part(width=600, height=732, machining=Machining(slots=(8.0,)))
            ),
            [],
        )
        problems = constraints.violations(
            Part(width=600, height=732, machining=Machining(vertical_drills=(35.0,)))
        )
        self.assertTrue(any("barreno vertical Ø35 mm" in problem for problem in problems))


class RectTest(unittest.TestCase):
    def test_interseccion_y_contencion(self):
        rect = Rect(0, 0, 100, 100)
        self.assertTrue(rect.intersects(Rect(50, 50, 100, 100)))
        self.assertFalse(rect.intersects(Rect(100, 0, 50, 50)))
        self.assertTrue(rect.contains(Rect(10, 10, 20, 20)))
        self.assertFalse(rect.contains(Rect(90, 90, 20, 20)))


if __name__ == "__main__":
    unittest.main()
