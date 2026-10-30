import unittest

from cutlist.models import Constraints, Drill, Machining, Part, Sheet, Slot
from cutlist.optimizer import optimize
from tests.support import assert_layouts_valid


class OptimizeTest(unittest.TestCase):
    def test_aprovechamiento_de_una_pieza(self):
        result = optimize([Part(500, 500)], [Sheet(1000, 1000, kerf=0)])
        self.assertEqual(result.yield_percent, 25.0)
        self.assertEqual(len(result.layouts), 1)
        self.assertEqual(result.piece_count, 1)
        self.assertEqual(result.unplaced, [])

    def test_reparte_en_varios_tableros(self):
        result = optimize([Part(100, 100, quantity=2)], [Sheet(100, 100, kerf=0)])
        self.assertEqual(len(result.layouts), 2)
        self.assertEqual(result.yield_percent, 100.0)
        self.assertEqual(result.piece_count, 2)
        self.assertEqual([layout.index for layout in result.layouts], [1, 2])

    def test_lista_de_corte_agrupa_piezas_iguales(self):
        parts = [
            Part(300, 400, quantity=3, label="costado"),
            Part(600, 200, label="tapa"),
        ]
        result = optimize(parts, [Sheet(2500, 1830)])
        self.assertEqual(len(result.cut_list), 2)

        costado = next(row for row in result.cut_list if row.label == "costado")
        self.assertEqual(costado.quantity, 3)
        self.assertEqual(costado.area, 300 * 400 * 3)
        tapa = next(row for row in result.cut_list if row.label == "tapa")
        self.assertEqual(tapa.quantity, 1)

    def test_pieza_mayor_que_el_stock_queda_sin_ubicar(self):
        result = optimize([Part(3000, 2000)], [Sheet(2500, 1830)])
        self.assertEqual(result.layouts, [])
        self.assertEqual(len(result.unplaced), 1)
        self.assertEqual(result.yield_percent, 0.0)
        self.assertTrue(any("sin ubicar" in warning for warning in result.warnings))

    def test_respeta_el_maximo_de_tableros(self):
        result = optimize(
            [Part(100, 100, quantity=3)],
            [Sheet(100, 100, kerf=0)],
            max_sheets=1,
        )
        self.assertEqual(len(result.layouts), 1)
        self.assertEqual(len(result.unplaced), 2)

    def test_avisos_del_perfil_de_restricciones(self):
        result = optimize([Part(50, 300, label="tirante")], [Sheet(2500, 1830)],
                          constraints=Constraints())
        self.assertTrue(any("mínimo de corte" in warning for warning in result.warnings))

    def test_avisos_de_ranuras_y_barrenos_del_perfil(self):
        part = Part(
            600,
            732,
            label="tapa",
            machining=Machining(slots=(Slot(8.0),), drills=(Drill(10, 10, 6.0),)),
        )
        result = optimize([part], [Sheet(2500, 1830)], constraints=Constraints())
        self.assertTrue(any("ranura de 8 mm" in warning for warning in result.warnings))
        self.assertTrue(any("barreno vertical Ø6 mm" in warning for warning in result.warnings))

    def test_pieza_con_mecanizado_fuera_del_area_no_se_corta(self):
        good = Part(600, 300, label="buena")
        bad = Part(
            600,
            300,
            label="mala",
            machining=Machining(drills=(Drill(5, 150, 35.0),)),
        )
        result = optimize([good, bad], [Sheet(2500, 1830)])
        self.assertEqual([piece.part.label for piece in result.invalid], ["mala"])
        self.assertEqual([piece.part.label for piece in result.unplaced], [])
        self.assertEqual(result.piece_count, 1)
        self.assertTrue(any("no se corta" in warning for warning in result.warnings))
        self.assertTrue(any("barreno Ø35 mm" in warning for warning in result.warnings))
        self.assertEqual(result.to_dict()["invalid"], ["P02"])

    def test_sin_perfil_no_hay_avisos_de_restricciones(self):
        result = optimize([Part(50, 300)], [Sheet(2500, 1830)])
        self.assertEqual(result.warnings, [])

    def test_rechaza_algoritmo_desconocido(self):
        with self.assertRaises(ValueError):
            optimize([Part(100, 100)], [Sheet(2500, 1830)], algorithm="otro")

    def test_rechaza_stock_vacio(self):
        with self.assertRaises(ValueError):
            optimize([Part(100, 100)], [])

    def test_resultado_determinista(self):
        parts = [Part(600, 732, quantity=2), Part(564, 732, quantity=2)]
        sheets = [Sheet(2500, 1830)]
        first = optimize(parts, sheets).to_dict()
        second = optimize(parts, sheets).to_dict()
        self.assertEqual(first, second)

    def test_ambos_algoritmos_colocan_todo(self):
        parts = [Part(600, 732, quantity=2), Part(564, 732, quantity=2), Part(300, 400)]
        for algorithm in ("guillotine", "nonguillotine"):
            with self.subTest(algorithm=algorithm):
                result = optimize(parts, [Sheet(2500, 1830)], algorithm=algorithm)
                self.assertEqual(result.unplaced, [])
                self.assertEqual(result.piece_count, 5)
                assert_layouts_valid(self, result.layouts)


if __name__ == "__main__":
    unittest.main()
