import unittest

from cutlist.dxf import parse_dxf
from tests.support import block, dxf_document as dxf, insert, lwpolyline

RECT = [(0, 0), (600, 0), (600, 732), (0, 732)]


def polyline(points, layer="Roble", closed=True):
    lines = ["0", "POLYLINE", "8", layer, "70", "1" if closed else "0", "66", "1"]
    for x, y in points:
        lines += ["0", "VERTEX", "8", layer, "10", f"{x:g}", "20", f"{y:g}"]
    lines += ["0", "SEQEND", "8", layer]
    return lines


def line(start, end, layer="Roble"):
    return [
        "0", "LINE", "8", layer,
        "10", f"{start[0]:g}", "20", f"{start[1]:g}",
        "11", f"{end[0]:g}", "21", f"{end[1]:g}",
    ]


def text(x, y, value, layer="Roble"):
    return ["0", "TEXT", "8", layer, "10", f"{x:g}", "20", f"{y:g}", "1", value]


def mtext(x, y, value, layer="Roble"):
    return ["0", "MTEXT", "8", layer, "10", f"{x:g}", "20", f"{y:g}", "1", value]


class DxfTest(unittest.TestCase):
    def test_contorno_cerrado_por_capa(self):
        imported = parse_dxf(dxf([lwpolyline(RECT, layer="Roble")]))
        self.assertEqual(len(imported.parts), 1)
        part = imported.parts[0]
        self.assertEqual((part.width, part.height), (600.0, 732.0))
        self.assertEqual(part.material, "Roble")
        self.assertEqual(part.label, "")

    def test_capa_0_es_sin_material(self):
        imported = parse_dxf(dxf([lwpolyline(RECT, layer="0")]))
        self.assertEqual(imported.parts[0].material, "")

    def test_dos_materiales(self):
        imported = parse_dxf(
            dxf(
                [
                    lwpolyline(RECT, layer="Roble"),
                    lwpolyline([(0, 0), (500, 0), (500, 400), (0, 400)], layer="Moscato"),
                ]
            )
        )
        self.assertEqual(
            sorted(part.material for part in imported.parts), ["Moscato", "Roble"]
        )
        moscato = next(part for part in imported.parts if part.material == "Moscato")
        self.assertEqual((moscato.width, moscato.height), (500.0, 400.0))

    def test_piezas_iguales_quedan_una_por_contorno(self):
        imported = parse_dxf(dxf([lwpolyline(RECT), lwpolyline(RECT)]))
        self.assertEqual(len(imported.parts), 2)

    def test_polylines_antiguas(self):
        imported = parse_dxf(dxf([polyline(RECT)]))
        self.assertEqual(len(imported.parts), 1)
        self.assertEqual(imported.parts[0].width, 600.0)

    def test_cuatro_lineas_forman_un_contorno(self):
        segments = [
            line((0, 0), (600, 0)),
            line((600, 0), (600, 732)),
            line((600, 732), (0, 732)),
            line((0, 732), (0, 0)),
        ]
        imported = parse_dxf(dxf(segments))
        self.assertEqual(len(imported.parts), 1)
        self.assertEqual((imported.parts[0].width, imported.parts[0].height), (600.0, 732.0))

    def test_lineas_sueltas_se_avisan(self):
        imported = parse_dxf(dxf([lwpolyline(RECT), line((2000, 0), (2200, 0))]))
        self.assertEqual(len(imported.parts), 1)
        self.assertTrue(any("suelta" in warning for warning in imported.warnings))

    def test_etiqueta_de_texto_dentro(self):
        imported = parse_dxf(dxf([lwpolyline(RECT), text(100, 100, "Costado")]))
        self.assertEqual(imported.parts[0].label, "Costado")

    def test_etiqueta_mtext_con_formato(self):
        imported = parse_dxf(
            dxf([lwpolyline(RECT), mtext(100, 100, r"{\fArial|b0;Tapa\Pder}")])
        )
        self.assertEqual(imported.parts[0].label, "Tapa der")

    def test_texto_fuera_no_es_etiqueta(self):
        imported = parse_dxf(dxf([lwpolyline(RECT), text(5000, 5000, "Costado")]))
        self.assertEqual(imported.parts[0].label, "")

    def test_unidades_en_pulgadas(self):
        inches = [(0, 0), (23.622, 0), (23.622, 28.819), (0, 28.819)]
        imported = parse_dxf(dxf([lwpolyline(inches)], insunits=1))
        part = imported.parts[0]
        self.assertAlmostEqual(part.width, 600.0, delta=0.02)
        self.assertAlmostEqual(part.height, 732.0, delta=0.02)

    def test_sin_unidades_avisa_y_asume_milimetros(self):
        imported = parse_dxf(dxf([lwpolyline(RECT)], insunits=None))
        self.assertEqual(imported.parts[0].width, 600.0)
        self.assertTrue(any("$INSUNITS" in warning for warning in imported.warnings))

    def test_forma_no_rectangular_usa_su_rectangulo(self):
        l_shape = [(0, 0), (600, 0), (600, 300), (300, 300), (300, 732), (0, 732)]
        imported = parse_dxf(dxf([lwpolyline(RECT), lwpolyline(l_shape)]))
        self.assertEqual(len(imported.parts), 2)
        self.assertEqual(
            (imported.parts[1].width, imported.parts[1].height), (600.0, 732.0)
        )
        self.assertTrue(any("no rectangular" in warning for warning in imported.warnings))

    def test_vertice_repetido_al_cerrar(self):
        imported = parse_dxf(dxf([lwpolyline(RECT + [(0, 0)])]))
        self.assertEqual(len(imported.parts), 1)
        self.assertEqual(imported.parts[0].height, 732.0)

    def test_sin_piezas_rectangulares(self):
        with self.assertRaises(ValueError) as ctx:
            parse_dxf(dxf([lwpolyline(RECT, closed=False)]))
        self.assertIn("no tiene piezas utilizables", str(ctx.exception))

    def test_sin_seccion_entities(self):
        with self.assertRaises(ValueError):
            parse_dxf("0\nSECTION\n2\nHEADER\n0\nENDSEC\n0\nEOF\n")

    def test_dxf_vacio(self):
        with self.assertRaises(ValueError) as ctx:
            parse_dxf("   \n")
        self.assertIn("vacío", str(ctx.exception))

    def test_dxf_binario(self):
        with self.assertRaises(ValueError) as ctx:
            parse_dxf("AutoCAD Binary DXF\r\n\x00\x00")
        self.assertIn("binario", str(ctx.exception))

    def test_dxf_incompleto(self):
        with self.assertRaises(ValueError) as ctx:
            parse_dxf("0\nSECTION\n2\n")
        self.assertIn("incompleto", str(ctx.exception))

    def test_texto_que_no_es_dxf(self):
        with self.assertRaises(ValueError) as ctx:
            parse_dxf("hola\nmundo\n")
        self.assertIn("no es ASCII DXF", str(ctx.exception))


class DxfBlocksTest(unittest.TestCase):
    """INSERT: los bloques se expanden con su transformación, también anidados."""

    def test_insert_se_expande_y_hereda_la_capa(self):
        imported = parse_dxf(
            dxf(
                [insert("PANEL", 1000, 0, layer="Roble")],
                blocks=[block("PANEL", [lwpolyline(RECT, layer="0")])],
            )
        )
        self.assertEqual(len(imported.parts), 1)
        part = imported.parts[0]
        self.assertEqual((part.width, part.height), (600.0, 732.0))
        self.assertEqual(part.material, "Roble")
        self.assertEqual(imported.warnings, [])

    def test_insert_con_escala_y_rotacion(self):
        imported = parse_dxf(
            dxf(
                [insert("PANEL", scale=(2, 2), rotation=90)],
                blocks=[block("PANEL", [lwpolyline(RECT, layer="0")])],
            )
        )
        part = imported.parts[0]
        self.assertAlmostEqual(part.width, 1464.0, delta=0.01)
        self.assertAlmostEqual(part.height, 1200.0, delta=0.01)

    def test_insert_usa_el_punto_base_del_bloque(self):
        # Con la base en (600, 0) y el INSERT en (600, 0), la pieza cae de 0 a 600.
        imported = parse_dxf(
            dxf(
                [lwpolyline([(0, 0), (600, 0), (600, 732), (0, 732)]), insert("PANEL", 600, 0)],
                blocks=[block("PANEL", [lwpolyline(RECT, layer="0")], base=(600, 0))],
            )
        )
        self.assertEqual(len(imported.parts), 2)
        self.assertEqual(
            [(part.width, part.height) for part in imported.parts],
            [(600.0, 732.0), (600.0, 732.0)],
        )

    def test_insert_en_arreglo(self):
        imported = parse_dxf(
            dxf(
                [insert("PANEL", columns=3, rows=2, spacing=(700, 800))],
                blocks=[block("PANEL", [lwpolyline(RECT, layer="0")])],
            )
        )
        self.assertEqual(len(imported.parts), 6)

    def test_bloques_anidados(self):
        blocks = [
            block("INNER", [lwpolyline(RECT, layer="0")]),
            block("OUTER", [insert("INNER", 0, 0, layer="0")]),
        ]
        imported = parse_dxf(dxf([insert("OUTER", 10, 10)], blocks=blocks))
        self.assertEqual(len(imported.parts), 1)
        self.assertEqual(imported.parts[0].material, "Roble")

    def test_lw_polyline_dentro_de_bloque(self):
        imported = parse_dxf(
            dxf(
                [insert("PANEL")],
                blocks=[block("PANEL", [lwpolyline(RECT, layer="0")])],
            )
        )
        self.assertEqual(len(imported.parts), 1)

    def test_forma_no_rectangular_en_bloque_se_incluye(self):
        l_shape = [(0, 0), (600, 0), (600, 300), (300, 300), (300, 732), (0, 732)]
        imported = parse_dxf(
            dxf(
                [insert("L")],
                blocks=[block("L", [lwpolyline(l_shape, layer="0")])],
            )
        )
        self.assertEqual(len(imported.parts), 1)
        self.assertEqual(
            (imported.parts[0].width, imported.parts[0].height), (600.0, 732.0)
        )
        self.assertTrue(any("no rectangular" in warning for warning in imported.warnings))

    def test_texto_dentro_de_bloque_es_etiqueta(self):
        imported = parse_dxf(
            dxf(
                [insert("PUERTA")],
                blocks=[
                    block("PUERTA", [lwpolyline(RECT, layer="0"), text(10, 10, "puerta", layer="0")])
                ],
            )
        )
        self.assertEqual(imported.parts[0].label, "puerta")

    def test_bloque_inexistente_avisa(self):
        imported = parse_dxf(dxf([lwpolyline(RECT), insert("NOPE")]))
        self.assertEqual(len(imported.parts), 1)
        self.assertTrue(
            any("bloque inexistente" in warning for warning in imported.warnings)
        )


if __name__ == "__main__":
    unittest.main()
