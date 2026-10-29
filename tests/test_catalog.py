import json
import tempfile
import unittest
from pathlib import Path

from cutlist.catalog import DEFAULT_STOCKS, CatalogStore, parse_catalog, sheet_to_dict


class ParseCatalogTest(unittest.TestCase):
    def test_catalogo_por_defecto(self):
        sheets = parse_catalog(DEFAULT_STOCKS)
        self.assertEqual(len(sheets), 1)
        self.assertEqual(sheets[0].width, 2500.0)
        self.assertEqual(sheets[0].height, 1830.0)
        self.assertEqual(sheets[0].kerf, 4.0)
        self.assertEqual(sheets[0].material, "")

    def test_varios_stocks_con_material(self):
        sheets = parse_catalog(
            [
                {"material": "Roble", "width": 600, "height": 732, "kerf": 0},
                {"material": " Moscato ", "width": "500", "height": "400"},
            ]
        )
        self.assertEqual([sheet.material for sheet in sheets], ["Roble", "Moscato"])
        self.assertEqual(sheets[0].label, "Roble")
        self.assertEqual(sheets[1].thickness, 18.0)
        self.assertEqual(sheets[1].kerf, 4.0)

    def test_medidas_que_faltan_usan_el_valor_por_defecto(self):
        sheet = parse_catalog([{}])[0]
        self.assertEqual(
            (sheet.width, sheet.height, sheet.thickness, sheet.kerf),
            (2500.0, 1830.0, 18.0, 4.0),
        )

    def test_medidas_con_coma_decimal(self):
        self.assertEqual(parse_catalog([{"kerf": "3,2"}])[0].kerf, 3.2)

    def test_un_stock_es_un_objeto(self):
        with self.assertRaises(ValueError) as ctx:
            parse_catalog(["Roble"])
        self.assertIn("stock 1: se espera un objeto", str(ctx.exception))

    def test_errores_de_validacion(self):
        cases = {
            "no es lista": ("Roble", "«stocks» debe ser una lista"),
            "vacía": ([], "«stocks» está vacío"),
            "texto": ([{"width": "ancho"}], "«width» no es un número"),
            "no finita": ([{"height": "NaN"}], "no es un número finito"),
            "medida negativa": ([{"width": -1}], "medida no positiva"),
            "kerf negativo": ([{"kerf": -1}], "kerf negativo"),
        }
        for name, (data, message) in cases.items():
            with self.subTest(name):
                with self.assertRaises(ValueError) as ctx:
                    parse_catalog(data)
                self.assertIn(message, str(ctx.exception))

    def test_sheet_to_dict(self):
        sheet = parse_catalog([{"material": "Roble", "width": 600, "height": 700}])[0]
        self.assertEqual(
            sheet_to_dict(sheet),
            {
                "material": "Roble",
                "label": "Roble",
                "width": 600.0,
                "height": 700.0,
                "thickness": 18.0,
                "kerf": 4.0,
            },
        )


class CatalogStoreTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.path = Path(self.tmp.name) / "data" / "stocks.json"
        self.store = CatalogStore(self.path)

    def tearDown(self):
        self.tmp.cleanup()

    def test_sin_archivo_devuelve_el_catalogo_por_defecto(self):
        sheets, warning = self.store.load()
        self.assertIsNone(warning)
        self.assertEqual(len(sheets), 1)
        self.assertEqual(sheets[0].width, 2500.0)

    def test_guarda_y_relee(self):
        self.store.save(
            parse_catalog(
                [
                    {"material": "Roble", "width": 600, "height": 732, "kerf": 0},
                    {"material": "Moscato", "width": 500, "height": 400},
                ]
            )
        )
        self.assertTrue(self.path.exists())
        sheets, warning = self.store.load()
        self.assertIsNone(warning)
        self.assertEqual([sheet.material for sheet in sheets], ["Roble", "Moscato"])
        self.assertEqual(sheets[1].height, 400.0)
        self.assertEqual(sheets[1].thickness, 18.0)

    def test_el_archivo_es_json_propio(self):
        self.store.save(parse_catalog([{"material": "Roble", "width": 600, "height": 700}]))
        data = json.loads(self.path.read_text(encoding="utf-8"))
        self.assertEqual(data["schema"], 1)
        self.assertEqual(
            set(data["stocks"][0]),
            {"material", "width", "height", "thickness", "kerf"},
        )

    def test_no_deja_archivo_temporal(self):
        self.store.save(parse_catalog([{"material": "Roble"}]))
        self.assertEqual(
            sorted(item.name for item in self.path.parent.iterdir()), ["stocks.json"]
        )

    def test_guarda_formato_lista_plana(self):
        self.path.parent.mkdir(parents=True)
        self.path.write_text(
            json.dumps([{"material": "Roble", "width": 600, "height": 700}]),
            encoding="utf-8",
        )
        sheets, warning = self.store.load()
        self.assertIsNone(warning)
        self.assertEqual(sheets[0].material, "Roble")

    def test_json_invalido_usa_el_por_defecto(self):
        self.path.parent.mkdir(parents=True)
        self.path.write_text("{esto no es json", encoding="utf-8")
        sheets, warning = self.store.load()
        self.assertEqual(sheets[0].width, 2500.0)
        self.assertIn("no es JSON válido", warning)

    def test_catalogo_invalido_usa_el_por_defecto(self):
        self.path.parent.mkdir(parents=True)
        self.path.write_text(json.dumps({"stocks": []}), encoding="utf-8")
        sheets, warning = self.store.load()
        self.assertEqual(len(sheets), 1)
        self.assertIn("no es válido", warning)

    def test_no_guarda_un_catalogo_vacio(self):
        with self.assertRaises(ValueError):
            self.store.save([])


if __name__ == "__main__":
    unittest.main()
