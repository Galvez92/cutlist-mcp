import unittest

from cutlist.models import Part, Sheet
from cutlist.stock import group_by_stock, normalize_material, optimize_with_stock


def stock(material="", label="", width=2500, height=1830, kerf=0):
    return Sheet(width, height, kerf=kerf, label=label or material, material=material)


class NormalizeMaterialTest(unittest.TestCase):
    def test_ignora_mayusculas_acentos_y_espacios(self):
        self.assertEqual(normalize_material("  MDF   Blanco "), "mdf blanco")
        self.assertEqual(normalize_material("Melamina Ñandú"), "melamina nandu")
        self.assertEqual(normalize_material(None), "")


class GroupByStockTest(unittest.TestCase):
    def test_asigna_cada_pieza_al_stock_de_su_material(self):
        roble, moscato = stock("Roble"), stock("Moscato")
        assignment = group_by_stock(
            [Part(100, 100, material="Roble"), Part(200, 200, material="Moscato")],
            [roble, moscato],
        )
        self.assertEqual([group.material for group in assignment.groups], ["Roble", "Moscato"])
        self.assertEqual([group.sheets for group in assignment.groups], [[roble], [moscato]])
        self.assertEqual(assignment.unassigned, [])
        self.assertEqual(assignment.warnings, [])

    def test_el_material_se_compara_sin_mayusculas_ni_acentos(self):
        assignment = group_by_stock(
            [Part(100, 100, material="  MDF   BLANCO ")], [stock("Mdf Blanco")]
        )
        self.assertEqual([group.material for group in assignment.groups], ["Mdf Blanco"])

    def test_un_material_puede_tener_varios_stocks(self):
        grande = stock("Roble")
        chico = stock("Roble", width=1200, height=600)
        assignment = group_by_stock([Part(100, 100, material="Roble")], [grande, chico])
        self.assertEqual(assignment.groups[0].sheets, [grande, chico])

    def test_el_comodin_recibe_el_material_sin_stock_propio(self):
        roble, comodin = stock("Roble"), stock()
        assignment = group_by_stock(
            [Part(100, 100, material="Roble"), Part(50, 50, material="Moscato")],
            [roble, comodin],
        )
        self.assertEqual([group.material for group in assignment.groups], ["Roble", "Moscato"])
        self.assertEqual(assignment.groups[1].sheets, [comodin])

    def test_pieza_sin_material_va_al_comodin(self):
        comodin = stock()
        assignment = group_by_stock([Part(100, 100)], [stock("Roble"), comodin])
        self.assertEqual([group.material for group in assignment.groups], ["sin material"])
        self.assertEqual(assignment.groups[0].sheets, [comodin])

    def test_un_solo_stock_sin_material_recibe_todo(self):
        sheet = stock()
        assignment = group_by_stock(
            [Part(100, 100, material="Roble"), Part(200, 200, material="Moscato")], [sheet]
        )
        self.assertEqual(len(assignment.groups), 2)
        self.assertTrue(all(group.sheets == [sheet] for group in assignment.groups))
        self.assertEqual(assignment.unassigned, [])
        self.assertEqual(assignment.warnings, [])

    def test_un_solo_stock_con_material_no_recibe_otro_material(self):
        assignment = group_by_stock([Part(100, 100, material="Moscato")], [stock("Roble")])
        self.assertEqual(assignment.groups, [])
        self.assertEqual(len(assignment.unassigned), 1)
        self.assertIn("Moscato", assignment.warnings[0])

    def test_pieza_sin_material_con_un_solo_stock(self):
        sheet = stock("Roble")
        assignment = group_by_stock([Part(100, 100)], [sheet])
        self.assertEqual([group.material for group in assignment.groups], ["sin material"])
        self.assertEqual(assignment.groups[0].sheets, [sheet])

    def test_material_sin_stock_queda_sin_asignar(self):
        assignment = group_by_stock(
            [Part(100, 100, material="Pino", quantity=2)], [stock("Roble"), stock("Moscato")]
        )
        self.assertEqual(assignment.groups, [])
        self.assertEqual([part.material for part in assignment.unassigned], ["Pino"])
        self.assertIn("Pino", assignment.warnings[0])
        self.assertIn("2 pieza(s)", assignment.warnings[0])

    def test_pieza_sin_material_con_varios_stocks_queda_sin_asignar(self):
        assignment = group_by_stock([Part(100, 100)], [stock("Roble"), stock("Moscato")])
        self.assertEqual(len(assignment.unassigned), 1)
        self.assertIn("sin material", assignment.warnings[0])

    def test_el_orden_de_los_grupos_sigue_el_de_las_piezas(self):
        assignment = group_by_stock(
            [Part(10, 10, material="B"), Part(10, 10, material="A")], [stock("A"), stock("B")]
        )
        self.assertEqual([group.material for group in assignment.groups], ["B", "A"])

    def test_sin_stocks(self):
        with self.assertRaises(ValueError):
            group_by_stock([Part(100, 100)], [])


class OptimizeWithStockTest(unittest.TestCase):
    def test_cada_material_se_corta_de_su_stock(self):
        optimization = optimize_with_stock(
            [Part(200, 100, material="Roble"), Part(80, 80, material="Moscato")],
            [
                Sheet(200, 100, kerf=0, label="Roble", material="Roble"),
                Sheet(80, 80, kerf=0, label="Moscato", material="Moscato"),
            ],
        )
        self.assertEqual(
            [layout.sheet.label for layout in optimization.result.layouts], ["Roble", "Moscato"]
        )
        self.assertEqual([summary.material for summary in optimization.materials], ["Roble", "Moscato"])
        self.assertEqual(optimization.result.yield_percent, 100.0)

    def test_no_mezcla_dos_materiales_en_el_mismo_tablero(self):
        optimization = optimize_with_stock(
            [Part(100, 100, material="Roble"), Part(100, 100, material="Moscato")],
            [
                Sheet(250, 250, kerf=0, material="Roble"),
                Sheet(250, 250, kerf=0, material="Moscato"),
            ],
        )
        self.assertEqual(len(optimization.result.layouts), 2)
        self.assertEqual(
            {layout.sheet.material for layout in optimization.result.layouts},
            {"Roble", "Moscato"},
        )

    def test_usa_los_varios_stocks_del_mismo_material(self):
        optimization = optimize_with_stock(
            [Part(600, 600, material="Roble", quantity=2)],
            [
                Sheet(600, 600, kerf=0, material="Roble"),
                Sheet(600, 600, kerf=0, material="Roble"),
            ],
        )
        self.assertEqual(len(optimization.result.layouts), 2)
        self.assertEqual(optimization.result.yield_percent, 100.0)

    def test_avisa_el_material_sin_stock(self):
        optimization = optimize_with_stock(
            [Part(100, 100, material="Pino", quantity=2)], [Sheet(2500, 1830, material="Roble")]
        )
        self.assertEqual(optimization.result.piece_count, 0)
        self.assertEqual(len(optimization.result.unplaced), 2)
        self.assertIn("Pino", optimization.result.warnings[0])

    def test_to_dict_cuenta_las_piezas_sin_stock(self):
        payload = optimize_with_stock(
            [Part(100, 100, material="Pino")], [Sheet(2500, 1830, material="Roble")]
        ).to_dict()
        self.assertEqual(payload["piece_count"], 0)
        self.assertEqual(len(payload["unplaced"]), 1)
        self.assertEqual(payload["materials"], [])


if __name__ == "__main__":
    unittest.main()
