import unittest

from cutlist.csv_import import EXAMPLE_CSV, parse_parts_csv
from cutlist.models import Sheet
from cutlist.optimizer import optimize


class CsvImportTest(unittest.TestCase):
    def test_columnas_en_espanol(self):
        parts = parse_parts_csv("ancho,alto,cantidad,etiqueta\n600,732,2,Costado\n")
        self.assertEqual(len(parts), 1)
        self.assertEqual((parts[0].width, parts[0].height), (600.0, 732.0))
        self.assertEqual(parts[0].quantity, 2)
        self.assertEqual(parts[0].label, "Costado")
        self.assertFalse(parts[0].grain)

    def test_columnas_en_ingles(self):
        parts = parse_parts_csv("width,height,quantity,label\n500,400,3,Tapa\n")
        self.assertEqual(parts[0].quantity, 3)
        self.assertEqual(parts[0].label, "Tapa")

    def test_separador_punto_y_coma_con_decimales_coma(self):
        parts = parse_parts_csv("ancho;alto;cantidad\n600,5;732;2\n")
        self.assertEqual(parts[0].width, 600.5)
        self.assertEqual(parts[0].quantity, 2)

    def test_veta_en_variantes(self):
        cases = (("si", True), ("sí", True), ("1", True), ("no", False), ("", False))
        for value, expected in cases:
            with self.subTest(value=value):
                parts = parse_parts_csv(f"ancho,alto,veta\n100,200,{value}\n")
                self.assertEqual(parts[0].grain, expected)

    def test_cantidad_por_defecto_es_uno(self):
        parts = parse_parts_csv("ancho,alto\n100,200\n")
        self.assertEqual(parts[0].quantity, 1)

    def test_cantos_opcionales(self):
        parts = parse_parts_csv("ancho,alto,c1,l1\n600,732,PVC roble,\n")
        self.assertEqual(parts[0].edges.c1, "PVC roble")
        self.assertIsNone(parts[0].edges.l1)
        self.assertIsNone(parse_parts_csv("ancho,alto\n600,732\n")[0].edges)

    def test_varias_filas(self):
        parts = parse_parts_csv("ancho,alto\n600,732\n564,732\n300,400\n")
        self.assertEqual([part.width for part in parts], [600.0, 564.0, 300.0])

    def test_falta_la_columna_de_ancho(self):
        with self.assertRaises(ValueError) as ctx:
            parse_parts_csv("alto,cantidad\n732,2\n")
        self.assertIn("ancho", str(ctx.exception))

    def test_valor_no_numerico_indica_la_fila(self):
        with self.assertRaises(ValueError) as ctx:
            parse_parts_csv("ancho,alto\n600,732\nxx,400\n")
        self.assertIn("fila 3", str(ctx.exception))
        self.assertIn("ancho", str(ctx.exception))
        self.assertIn("xx", str(ctx.exception))

    def test_medida_invalida_indica_la_fila(self):
        with self.assertRaises(ValueError) as ctx:
            parse_parts_csv("ancho,alto\n0,400\n")
        self.assertIn("fila 2", str(ctx.exception))

    def test_csv_vacio(self):
        with self.assertRaises(ValueError):
            parse_parts_csv("")
        with self.assertRaises(ValueError):
            parse_parts_csv("ancho,alto\n")

    def test_el_ejemplo_se_puede_optimizar(self):
        parts = parse_parts_csv(EXAMPLE_CSV)
        self.assertGreater(len(parts), 0)
        result = optimize(parts, [Sheet(2500, 1830)], max_sheets=10)
        self.assertEqual(result.unplaced, [])
        self.assertGreater(result.yield_percent, 0)


if __name__ == "__main__":
    unittest.main()
