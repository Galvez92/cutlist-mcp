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

    def test_columna_material(self):
        parts = parse_parts_csv("ancho,alto,material\n600,732,Roble\n564,700,\n")
        self.assertEqual(parts[0].material, "Roble")
        self.assertEqual(parts[1].material, "")

    def test_material_con_alias_stock(self):
        parts = parse_parts_csv("ancho,alto,stock\n600,732,MDF blanco\n")
        self.assertEqual(parts[0].material, "MDF blanco")

    def test_sin_columna_material(self):
        self.assertEqual(parse_parts_csv("ancho,alto\n600,732\n")[0].material, "")

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


class PlanillaExportadaTest(unittest.TestCase):
    """Datos tal como llegan de una planilla o de la API de Google Sheets."""

    def test_bom_utf8_al_inicio(self):
        parts = parse_parts_csv("\ufeffancho,alto\n600,732\n")
        self.assertEqual((parts[0].width, parts[0].height), (600.0, 732.0))

    def test_finales_de_linea_crlf(self):
        parts = parse_parts_csv("ancho,alto\r\n600,732\r\n564,700\r\n")
        self.assertEqual([part.width for part in parts], [600.0, 564.0])

    def test_filas_vacias_al_final_se_ignoran(self):
        parts = parse_parts_csv("ancho,alto\n600,732\n,,\n,,\n\n")
        self.assertEqual(len(parts), 1)

    def test_filas_vacias_en_el_medio_se_ignoran(self):
        parts = parse_parts_csv("ancho,alto\n600,732\n,\n564,700\n")
        self.assertEqual([part.width for part in parts], [600.0, 564.0])

    def test_columnas_vacias_extra(self):
        parts = parse_parts_csv("ancho,alto\n600,732,,\n")
        self.assertEqual(parts[0].height, 732.0)

    def test_celda_con_salto_de_linea_entre_comillas(self):
        parts = parse_parts_csv('ancho,alto,etiqueta\n600,732,"Pata\nexterior"\n')
        self.assertEqual(parts[0].label, "Pata\nexterior")

    def test_comillas_escapadas(self):
        parts = parse_parts_csv('ancho,alto,etiqueta\n600,732,"Costado ""der"""\n')
        self.assertEqual(parts[0].label, 'Costado "der"')

    def test_columna_extra_sin_encabezado(self):
        parts = parse_parts_csv("ancho,alto\n600,732,observación\n")
        self.assertEqual(parts[0].width, 600.0)

    def test_columnas_desconocidas_se_ignoran(self):
        parts = parse_parts_csv("Material,Ancho ,ALTO,Observaciones\nRoble,600,732,x\n")
        self.assertEqual((parts[0].width, parts[0].height), (600.0, 732.0))

    def test_numeros_como_texto(self):
        parts = parse_parts_csv('ancho,alto,cantidad\n"600","732","2"\n')
        self.assertEqual((parts[0].width, parts[0].height, parts[0].quantity), (600.0, 732.0, 2))

    def test_cantidad_decimal_entera(self):
        self.assertEqual(parse_parts_csv("ancho,alto,cantidad\n600,732,2.0\n")[0].quantity, 2)

    def test_veta_como_booleano_de_la_api(self):
        self.assertTrue(parse_parts_csv("ancho,alto,veta\n600,732,TRUE\n")[0].grain)
        self.assertTrue(parse_parts_csv("ancho,alto,veta\n600,732,VERDADERO\n")[0].grain)

    def test_texto_pegado_con_tabulaciones(self):
        with self.assertRaises(ValueError) as ctx:
            parse_parts_csv("ancho\talto\n600\t732\n")
        self.assertIn("tabulaciones", str(ctx.exception))

    def test_solo_encabezados_y_filas_vacias(self):
        with self.assertRaises(ValueError) as ctx:
            parse_parts_csv("ancho,alto\n,,\n")
        self.assertIn("no tiene piezas", str(ctx.exception))


class DatosMalFormadosTest(unittest.TestCase):
    """Filas incompletas y valores imposibles de traducir a una pieza."""

    def test_fila_truncada(self):
        with self.assertRaises(ValueError) as ctx:
            parse_parts_csv("ancho,alto\n600,732\n564\n")
        self.assertIn("fila 3", str(ctx.exception))
        self.assertIn("alto", str(ctx.exception))

    def test_medida_vacia(self):
        with self.assertRaises(ValueError) as ctx:
            parse_parts_csv("ancho,alto\n600,\n")
        self.assertIn("fila 2", str(ctx.exception))
        self.assertIn("alto", str(ctx.exception))

    def test_medida_no_finita(self):
        for value in ("NaN", "Infinity", "-Infinity"):
            with self.subTest(value=value):
                with self.assertRaises(ValueError) as ctx:
                    parse_parts_csv(f"ancho,alto\n{value},732\n")
                self.assertIn("no finito", str(ctx.exception))
                self.assertIn("fila 2", str(ctx.exception))

    def test_medida_cero_o_negativa(self):
        for value in ("0", "-600"):
            with self.subTest(value=value):
                with self.assertRaises(ValueError) as ctx:
                    parse_parts_csv(f"ancho,alto\n{value},732\n")
                self.assertIn("fila 2", str(ctx.exception))

    def test_cantidad_fraccionaria(self):
        with self.assertRaises(ValueError) as ctx:
            parse_parts_csv("ancho,alto,cantidad\n600,732,2.5\n")
        self.assertIn("entero positivo", str(ctx.exception))
        self.assertIn("fila 2", str(ctx.exception))

    def test_cantidad_cero_o_negativa(self):
        for value in ("0", "-1"):
            with self.subTest(value=value):
                with self.assertRaises(ValueError) as ctx:
                    parse_parts_csv(f"ancho,alto,cantidad\n600,732,{value}\n")
                self.assertIn("fila 2", str(ctx.exception))

    def test_cantidad_no_numerica(self):
        with self.assertRaises(ValueError) as ctx:
            parse_parts_csv("ancho,alto,cantidad\n600,732,dos\n")
        self.assertIn("fila 2", str(ctx.exception))
        self.assertIn("cantidad", str(ctx.exception))

    def test_la_fila_del_error_cuenta_los_saltos_de_linea_entre_comillas(self):
        with self.assertRaises(ValueError) as ctx:
            parse_parts_csv('ancho,alto,etiqueta\n600,732,"Pata\nexterior"\nxx,400,"Tapa"\n')
        self.assertIn("fila 4", str(ctx.exception))

    def test_solo_espacios(self):
        with self.assertRaises(ValueError):
            parse_parts_csv("   \n\n")


if __name__ == "__main__":
    unittest.main()
