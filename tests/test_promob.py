import unittest

from cutlist.models import Drill, Slot
from cutlist.promob import load_fixture, parse_promob_xml


def program(dx=914.4, dy=457.2, description="Panel", content="", normal="(0;0;1)", declaration=True):
    """Un `PROGRAM` mínimo del Plugin Builder XML de Promob."""
    head = '<?xml version="1.0" encoding="utf-8"?>' if declaration else ""
    return (
        f"{head}"
        f'<PROGRAM PROGRAMNAME="P1" PARTDESCRIPTION="{description}">'
        f'<HEADER DX="{dx}" DY="{dy}" DZ="18.5" />'
        f"<CONTENT>{content}</CONTENT>"
        "</PROGRAM>"
    )


def hole(x=10, y=10, diameter=8, normal="(0;0;1)"):
    return (
        f'<HOLE X="{x}" Y="{y}" Z="18.5" DEPTH="10" DIAMETER="{diameter}" '
        f'ISTHROUGH="False" FACENORMAL="{normal}" />'
    )


def slot(sx=0, sy=100, ex=900, ey=100, width=7.5):
    return (
        f'<SLOT SX="{sx}" SY="{sy}" EX="{ex}" EY="{ey}" WIDTH="{width}" '
        f'DEPTH="9.5" FACENORMAL="(0;0;-1)" />'
    )


def contour(points):
    """Contorno exterior con sus puntos (`STARTPOINT` + `LINEENDPOINT`)."""
    start, *rest = points
    body = f'<STARTPOINT X="{start[0]}" Y="{start[1]}" Z="18.6" />'
    body += "".join(f'<LINEENDPOINT X="{x}" Y="{y}" Z="18.6" />' for x, y in rest)
    return (
        '<MACHINING DEPTH="18.6" ISEXTERNALCONTOUR="True" TYPE="Contour" '
        f'ISCLOSED="True">{body}</MACHINING>'
    )


class PromobFixtureTest(unittest.TestCase):
    """Ejemplo oficial `SID0036A.xml` del Plugin Builder XML de Promob."""

    def setUp(self):
        self.imported = load_fixture()
        self.part = self.imported.parts[0]

    def test_lee_la_pieza_y_su_descripcion(self):
        self.assertEqual(len(self.imported.parts), 1)
        self.assertEqual((self.part.width, self.part.height), (914.4, 457.2))
        self.assertEqual(self.part.label, "Right Side Panel Toe Kick")
        self.assertEqual(self.part.material, "")

    def test_importa_barrenos_con_su_posicion(self):
        drills = self.part.machining.drills
        self.assertEqual(len(drills), 13)
        self.assertEqual(drills[0], Drill(x=9, y=20, diameter=5))
        self.assertEqual(self.part.machining.vertical_drills[:2], (5.0, 8.0))

    def test_importa_la_ranura_con_su_eje(self):
        slot = self.part.machining.slots[0]
        self.assertEqual(
            slot,
            Slot(width=7.5, x0=0, y0=435.45, x1=914.4, y1=435.45),
        )
        self.assertTrue(slot.has_axis)

    def test_el_mecanizado_cae_dentro_de_la_pieza(self):
        self.assertEqual(self.part.invalid_reasons, ())

    def test_avisa_que_la_pieza_no_es_rectangular(self):
        self.assertTrue(
            any("no es rectangular" in warning for warning in self.imported.warnings)
        )
        self.assertTrue(
            any("914.4x457.2" in warning for warning in self.imported.warnings)
        )


class PromobParseTest(unittest.TestCase):
    def test_barreno_fuera_del_area_invalida_la_pieza(self):
        imported = parse_promob_xml(program(content=hole(x=2, y=10, diameter=35)))
        self.assertEqual(len(imported.parts[0].invalid_reasons), 1)
        self.assertIn("barreno Ø35 mm", imported.parts[0].invalid_reasons[0])

    def test_ranura_que_sale_del_area_invalida_la_pieza(self):
        imported = parse_promob_xml(
            program(content=slot(sx=0, sy=0, ex=900, ey=0, width=10))
        )
        self.assertEqual(len(imported.parts[0].invalid_reasons), 1)
        self.assertIn("ranura de 10 mm", imported.parts[0].invalid_reasons[0])

    def test_barreno_horizontal_no_se_valida(self):
        imported = parse_promob_xml(
            program(content=hole(x=1, y=1, diameter=35, normal="(1;0;0)"))
        )
        drill = imported.parts[0].machining.drills[0]
        self.assertTrue(drill.horizontal)
        self.assertEqual(imported.parts[0].invalid_reasons, ())

    def test_varios_programas_son_varias_piezas(self):
        text = (
            "<LISTA>"
            + program(description="A", declaration=False)
            + program(dx=600, dy=300, description="B", declaration=False)
            + "</LISTA>"
        )
        imported = parse_promob_xml(text)
        self.assertEqual([part.label for part in imported.parts], ["A", "B"])
        self.assertEqual((imported.parts[1].width, imported.parts[1].height), (600.0, 300.0))

    def test_contorno_rectangular_no_avisa(self):
        imported = parse_promob_xml(
            program(
                dx=600,
                dy=300,
                content=contour([(0, 0), (600, 0), (600, 300), (0, 300), (0, 0)]),
            )
        )
        self.assertEqual(imported.warnings, [])

    def test_xml_vacio(self):
        with self.assertRaises(ValueError) as ctx:
            parse_promob_xml("  \n")
        self.assertIn("vacío", str(ctx.exception))

    def test_xml_invalido(self):
        with self.assertRaises(ValueError) as ctx:
            parse_promob_xml("<PROGRAM><HEADER")
        self.assertIn("no es válido", str(ctx.exception))

    def test_xml_que_no_es_de_promob(self):
        with self.assertRaises(ValueError) as ctx:
            parse_promob_xml("<otros><pieza /></otros>")
        self.assertIn("no es un XML de Promob", str(ctx.exception))

    def test_sin_medidas(self):
        with self.assertRaises(ValueError) as ctx:
            parse_promob_xml('<PROGRAM PARTDESCRIPTION="x"><HEADER DY="300" /></PROGRAM>')
        self.assertIn("DX", str(ctx.exception))

    def test_coordenada_invalida(self):
        with self.assertRaises(ValueError) as ctx:
            parse_promob_xml(program(content='<HOLE X="a" Y="10" DIAMETER="8" />'))
        self.assertIn("coordenada 'X'", str(ctx.exception))


if __name__ == "__main__":
    unittest.main()
