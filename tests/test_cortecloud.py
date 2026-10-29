import json
import unittest

from cutlist.cortecloud import FALLBACK_DIMENSIONS, load_fixture, parse_cortecloud_json


def row(**overrides):
    base = {
        "quantity": 1,
        "c": 732.0,
        "l": 600.0,
        "function": "Pata costado exterior",
        "complement": "D01 Escritorio Atelier Simple",
        "c1": None,
        "c2": None,
        "l1": None,
        "l2": None,
        "machining": None,
        "material": "Roble Americano 2 C 18 mm 719L ARAUCO (2500x1830)",
    }
    base.update(overrides)
    return base


def payload(*rows):
    return json.dumps({"parts": list(rows)})


class FixtureTest(unittest.TestCase):
    def setUp(self):
        self.groups = load_fixture()

    def test_agrupa_por_material(self):
        self.assertEqual(len(self.groups), 2)
        self.assertEqual(sum(len(group.parts) for group in self.groups), 21)
        self.assertEqual(sum(group.piece_count for group in self.groups), 30)

    def test_tablero_desde_el_texto_del_material(self):
        for group in self.groups:
            self.assertEqual((group.sheet.width, group.sheet.height), (2500.0, 1830.0))
            self.assertEqual(group.sheet.thickness, 18.0)
            self.assertEqual(group.sheet.kerf, 4.0)
            self.assertEqual(group.sheet.label, group.material)

    def test_mapea_c_como_largo_y_l_como_ancho(self):
        pata = next(
            part
            for group in self.groups
            for part in group.parts
            if part.label.startswith("Pata costado exterior acento der")
        )
        self.assertEqual((pata.width, pata.height), (600.0, 732.0))

    def test_importa_cantos_y_nombre(self):
        first = self.groups[0].parts[0]
        self.assertTrue(first.label)
        self.assertIsNotNone(first.edges.c1)
        self.assertIsNone(first.edges.c2)

    def test_la_veta_no_se_inventa(self):
        self.assertTrue(all(not part.grain for group in self.groups for part in group.parts))


class ParseTest(unittest.TestCase):
    def test_agrupa_por_material_y_conserva_el_orden(self):
        groups = parse_cortecloud_json(
            payload(row(quantity=2), row(material="Moscato 18 mm (2500x1830)"), row())
        )
        self.assertEqual([group.material for group in groups], [
            "Roble Americano 2 C 18 mm 719L ARAUCO (2500x1830)",
            "Moscato 18 mm (2500x1830)",
        ])
        self.assertEqual(groups[0].piece_count, 3)

    def test_lee_medidas_del_material(self):
        groups = parse_cortecloud_json(payload(row(material="Melamina blanca 15 mm (2440x1220)")))
        self.assertEqual((groups[0].sheet.width, groups[0].sheet.height), (2440.0, 1220.0))
        self.assertEqual(groups[0].sheet.thickness, 15.0)

    def test_material_sin_medidas_usa_el_perfil(self):
        groups = parse_cortecloud_json(payload(row(material="Melamina blanca")))
        expected_width, expected_height, expected_thickness = FALLBACK_DIMENSIONS
        self.assertEqual(groups[0].sheet.width, expected_width)
        self.assertEqual(groups[0].sheet.height, expected_height)
        self.assertEqual(groups[0].sheet.thickness, expected_thickness)

    def test_json_invalido(self):
        with self.assertRaises(ValueError) as ctx:
            parse_cortecloud_json("{no es json")
        self.assertIn("JSON", str(ctx.exception))

    def test_sin_clave_parts(self):
        with self.assertRaises(ValueError) as ctx:
            parse_cortecloud_json('{"piezas": []}')
        self.assertIn("parts", str(ctx.exception))

    def test_archivo_sin_piezas(self):
        with self.assertRaises(ValueError):
            parse_cortecloud_json('{"parts": []}')

    def test_pieza_sin_material(self):
        with self.assertRaises(ValueError) as ctx:
            parse_cortecloud_json(payload(row(material=None)))
        self.assertIn("material", str(ctx.exception))

    def test_pieza_sin_medida(self):
        with self.assertRaises(ValueError) as ctx:
            parse_cortecloud_json(payload(row(c=None)))
        self.assertIn("pieza 1", str(ctx.exception))

    def test_pieza_con_medida_invalida(self):
        with self.assertRaises(ValueError) as ctx:
            parse_cortecloud_json(payload(row(l="ancho")))
        self.assertIn("medida inválida", str(ctx.exception))

    def test_pieza_con_medida_no_positiva(self):
        with self.assertRaises(ValueError) as ctx:
            parse_cortecloud_json(payload(row(c=0)))
        self.assertIn("pieza 1", str(ctx.exception))


if __name__ == "__main__":
    unittest.main()
