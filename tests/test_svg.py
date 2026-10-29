import unittest

from cutlist.models import Part, Sheet
from cutlist.optimizer import optimize
from cutlist.svg import render_svg


class SvgTest(unittest.TestCase):
    def test_dibuja_una_pieza_por_colocacion(self):
        result = optimize([Part(500, 500, quantity=2)], [Sheet(1000, 1000, kerf=0)])
        svg = render_svg(result)
        self.assertTrue(svg.startswith("<svg"))
        self.assertEqual(svg.count('class="piece"'), 2)
        self.assertIn("viewBox", svg)

    def test_escapa_caracteres_especiales(self):
        result = optimize([Part(500, 500, label='tapa <b> 3/4" & canto')], [Sheet(1000, 1000)])
        svg = render_svg(result)
        self.assertIn("&lt;b&gt;", svg)
        self.assertIn("&amp;", svg)
        self.assertNotIn("<b>", svg)

    def test_sin_tableros_devuelve_un_svg_legible(self):
        result = optimize([Part(500, 500)], [Sheet(100, 100)])
        svg = render_svg(result)
        self.assertIn("<svg", svg)
        self.assertIn("Sin tableros", svg)

    def test_incluye_medidas_del_tablero(self):
        result = optimize([Part(500, 500)], [Sheet(1000, 800, thickness=18)])
        svg = render_svg(result)
        self.assertIn("1000×800×18", svg)


if __name__ == "__main__":
    unittest.main()
