import unittest

from cutlist.cortecloud import MaterialGroup
from cutlist.materials import optimize_by_material
from cutlist.models import Constraints, Part, Sheet


def group(material, parts, sheet=None):
    return MaterialGroup(material=material, sheet=sheet or Sheet(100, 100, kerf=0), parts=parts)


class OptimizeByMaterialTest(unittest.TestCase):
    def test_une_los_tableros_de_cada_material(self):
        optimization = optimize_by_material(
            [group("A", [Part(100, 100)]), group("B", [Part(100, 100, quantity=2)])]
        )
        self.assertEqual(len(optimization.result.layouts), 3)
        self.assertEqual([layout.index for layout in optimization.result.layouts], [1, 2, 3])
        self.assertEqual(optimization.result.yield_percent, 100.0)
        self.assertEqual(optimization.result.piece_count, 3)
        self.assertEqual([summary.sheets_used for summary in optimization.materials], [1, 2])

    def test_cada_material_usa_su_propio_tablero(self):
        optimization = optimize_by_material(
            [
                group("A", [Part(200, 50)], Sheet(200, 50, kerf=0, label="A")),
                group("B", [Part(80, 80)], Sheet(80, 80, kerf=0, label="B")),
            ]
        )
        self.assertEqual(
            [layout.sheet.label for layout in optimization.result.layouts], ["A", "B"]
        )
        self.assertEqual([summary.yield_percent for summary in optimization.materials], [100.0, 100.0])

    def test_lista_de_corte_separa_materiales(self):
        optimization = optimize_by_material(
            [group("A", [Part(50, 50, label="tapa")]), group("B", [Part(50, 50, label="tapa")])]
        )
        self.assertEqual(len(optimization.result.cut_list), 2)

    def test_avisos_repetidos_aparecen_una_vez(self):
        small = Part(50, 300, label="tirante")
        sheet = Sheet(600, 600, kerf=0, label="stock")
        optimization = optimize_by_material(
            [group("A", [small], sheet), group("B", [small], sheet)], constraints=Constraints()
        )
        self.assertEqual(len(optimization.result.warnings), 1)

    def test_pieza_sin_ubicar_se_reporta(self):
        optimization = optimize_by_material([group("A", [Part(300, 300)])])
        self.assertEqual(len(optimization.result.unplaced), 1)
        self.assertEqual(optimization.materials[0].unplaced, 1)

    def test_respeta_el_algoritmo(self):
        optimization = optimize_by_material([group("A", [Part(60, 60)])], algorithm="nonguillotine")
        self.assertEqual(optimization.result.algorithm, "nonguillotine")
        self.assertEqual(optimization.result.layouts[0].algorithm, "nonguillotine")
        with self.assertRaises(ValueError):
            optimize_by_material([group("A", [Part(60, 60)])], algorithm="otro")

    def test_to_dict_incluye_los_materiales(self):
        payload = optimize_by_material([group("A", [Part(50, 50)])]).to_dict()
        self.assertEqual(len(payload["materials"]), 1)
        self.assertEqual(payload["materials"][0]["material"], "A")
        self.assertEqual(payload["piece_count"], 1)


if __name__ == "__main__":
    unittest.main()
