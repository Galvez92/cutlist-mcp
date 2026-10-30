import json
import tempfile
import unittest
from pathlib import Path

from cutlist.cortecloud import FALLBACK_DIMENSIONS, load_fixture, parse_cortecloud_json
from cutlist.materials import optimize_by_material
from cutlist.models import Constraints


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

    def test_la_veta_sigue_el_largo(self):
        """Cortecloud: el largo sigue la veta del tablero, así que no se gira."""
        self.assertTrue(all(part.grain for group in self.groups for part in group.parts))

    def test_las_piezas_del_fixture_no_se_giran(self):
        optimization = optimize_by_material(load_fixture())
        placements = [
            placement
            for layout in optimization.result.layouts
            for placement in layout.placements
        ]
        self.assertTrue(placements)
        self.assertTrue(all(not placement.rotated for placement in placements))
        self.assertEqual(optimization.result.unplaced, [])

    def test_importa_barrenos_y_ranuras(self):
        parts = {part.label: part for group in self.groups for part in group.parts}
        pasacables = parts["Cubierta izquierda (pasacables Ø35)"]
        self.assertEqual(pasacables.machining.vertical_drills, (35.0,))
        self.assertEqual(pasacables.machining.horizontal_drills, ())
        self.assertEqual(pasacables.machining.slot_widths, ())
        self.assertEqual(pasacables.machining.drills[0].x, 300.0)
        self.assertEqual(pasacables.machining.drills[0].y, 60.0)

        repisa = parts["Repisa flotante R1 roble (soporte oculto HyM 00105412 + LED)"]
        self.assertEqual(repisa.machining.vertical_drills, (8.0,))
        self.assertEqual(repisa.machining.slot_widths, (9.7,))
        self.assertFalse(repisa.machining.slots[0].has_axis)
        self.assertEqual(pasacables.invalid_reasons, ())
        self.assertEqual(repisa.invalid_reasons, ())

    def test_el_perfil_no_reporta_el_mecanizado_del_fixture(self):
        for group in self.groups:
            for part in group.parts:
                problems = [
                    problem
                    for problem in Constraints().violations(part)
                    if "ranura" in problem or "barreno" in problem
                ]
                self.assertEqual(problems, [], part.label)


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

    def test_todas_las_piezas_llevan_veta(self):
        groups = parse_cortecloud_json(
            payload(row(), row(material="Moscato 18 mm (2500x1830)"))
        )
        self.assertTrue(all(part.grain for group in groups for part in group.parts))

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


class LoadFixtureTest(unittest.TestCase):
    """Errores al leer el archivo, no al interpretarlo."""

    def setUp(self):
        temp = tempfile.TemporaryDirectory()
        self.addCleanup(temp.cleanup)
        self.dir = Path(temp.name)

    def test_archivo_inexistente(self):
        with self.assertRaises(ValueError) as ctx:
            load_fixture(self.dir / "no-existe.json")
        self.assertIn("no se encontró", str(ctx.exception))
        self.assertIn("no-existe.json", str(ctx.exception))

    def test_ruta_que_es_un_directorio(self):
        with self.assertRaises(ValueError) as ctx:
            load_fixture(self.dir)
        self.assertIn("directorio", str(ctx.exception))

    def test_archivo_que_no_es_utf8(self):
        path = self.dir / "latin1.json"
        path.write_bytes(b'{"parts": [{"material": "\xff\xfe", "c": 10, "l": 10}]}')
        with self.assertRaises(ValueError) as ctx:
            load_fixture(path)
        self.assertIn("UTF-8", str(ctx.exception))

    def test_archivo_vacio(self):
        path = self.dir / "vacio.json"
        path.write_text("", encoding="utf-8")
        with self.assertRaises(ValueError) as ctx:
            load_fixture(path)
        self.assertIn("JSON", str(ctx.exception))

    def test_acepta_ruta_como_texto(self):
        path = self.dir / "ok.json"
        path.write_text(payload(row(quantity="3")), encoding="utf-8")
        self.assertEqual(load_fixture(str(path))[0].piece_count, 3)

    def test_el_error_no_expone_un_traceback_de_io(self):
        with self.assertRaises(ValueError) as ctx:
            load_fixture(self.dir / "otro.json")
        self.assertIsInstance(ctx.exception.__cause__, FileNotFoundError)


class MalformedInputTest(unittest.TestCase):
    """Datos mal formados dentro del JSON."""

    def test_raiz_que_no_es_objeto(self):
        for text in ("[]", '"texto"', "null", "42"):
            with self.assertRaises(ValueError) as ctx:
                parse_cortecloud_json(text)
            self.assertIn("parts", str(ctx.exception))

    def test_parts_que_no_es_lista(self):
        with self.assertRaises(ValueError) as ctx:
            parse_cortecloud_json('{"parts": {"c": 10, "l": 10}}')
        self.assertIn("parts", str(ctx.exception))

    def test_pieza_que_no_es_objeto(self):
        with self.assertRaises(ValueError) as ctx:
            parse_cortecloud_json('{"parts": [["c", 10]]}')
        self.assertIn("pieza 1", str(ctx.exception))

    def test_pieza_nula(self):
        with self.assertRaises(ValueError) as ctx:
            parse_cortecloud_json('{"parts": [null]}')
        self.assertIn("pieza 1", str(ctx.exception))

    def test_material_en_blanco(self):
        with self.assertRaises(ValueError) as ctx:
            parse_cortecloud_json(payload(row(material="   ")))
        self.assertIn("material", str(ctx.exception))

    def test_material_nulo(self):
        with self.assertRaises(ValueError) as ctx:
            parse_cortecloud_json(payload(row(material=None)))
        self.assertIn("material", str(ctx.exception))

    def test_el_error_indica_que_pieza_falla(self):
        with self.assertRaises(ValueError) as ctx:
            parse_cortecloud_json(payload(row(), row(), row(c=None)))
        self.assertIn("pieza 3", str(ctx.exception))

    def test_medida_con_unidades(self):
        with self.assertRaises(ValueError) as ctx:
            parse_cortecloud_json(payload(row(c="732 mm")))
        self.assertIn("medida inválida", str(ctx.exception))

    def test_medida_vacia(self):
        with self.assertRaises(ValueError) as ctx:
            parse_cortecloud_json(payload(row(l="")))
        self.assertIn("medida inválida", str(ctx.exception))

    def test_medida_no_finita(self):
        for value in ("NaN", "Infinity", float("inf"), float("nan")):
            with self.assertRaises(ValueError) as ctx:
                parse_cortecloud_json(payload(row(c=value)))
            self.assertIn("no finita", str(ctx.exception))

    def test_medida_booleana(self):
        with self.assertRaises(ValueError) as ctx:
            parse_cortecloud_json(payload(row(l=True)))
        self.assertIn("no es un número", str(ctx.exception))

    def test_medida_cero_o_negativa(self):
        for value in (0, -600):
            with self.assertRaises(ValueError) as ctx:
                parse_cortecloud_json(payload(row(l=value)))
            self.assertIn("pieza 1", str(ctx.exception))

    def test_cantidad_no_numerica(self):
        with self.assertRaises(ValueError) as ctx:
            parse_cortecloud_json(payload(row(quantity="dos")))
        self.assertIn("cantidad inválida", str(ctx.exception))

    def test_cantidad_fraccionaria(self):
        with self.assertRaises(ValueError) as ctx:
            parse_cortecloud_json(payload(row(quantity=2.5)))
        self.assertIn("entera", str(ctx.exception))

    def test_cantidad_negativa(self):
        with self.assertRaises(ValueError) as ctx:
            parse_cortecloud_json(payload(row(quantity=-2)))
        self.assertIn("pieza 1", str(ctx.exception))

    def test_cantidad_booleana(self):
        with self.assertRaises(ValueError) as ctx:
            parse_cortecloud_json(payload(row(quantity=True)))
        self.assertIn("cantidad inválida", str(ctx.exception))

    def test_cantidad_como_texto_es_valida(self):
        groups = parse_cortecloud_json(payload(row(quantity="4")))
        self.assertEqual(groups[0].piece_count, 4)

    def test_cantidad_ausente_vale_uno(self):
        sin_cantidad = {key: value for key, value in row().items() if key != "quantity"}
        groups = parse_cortecloud_json(payload(sin_cantidad))
        self.assertEqual(groups[0].piece_count, 1)

    def test_cantidad_nula(self):
        with self.assertRaises(ValueError) as ctx:
            parse_cortecloud_json(payload(row(quantity=None)))
        self.assertIn("cantidad inválida", str(ctx.exception))

    def test_canto_que_no_es_texto(self):
        with self.assertRaises(ValueError) as ctx:
            parse_cortecloud_json(payload(row(c2=4)))
        self.assertIn("canto", str(ctx.exception))

    def test_canto_en_blanco_es_sin_canto(self):
        groups = parse_cortecloud_json(payload(row(c1="   ", l1=" PVC 719L ")))
        self.assertIsNone(groups[0].parts[0].edges.c1)
        self.assertEqual(groups[0].parts[0].edges.l1, "PVC 719L")

    def test_materiales_con_medidas_distintas_son_grupos_distintos(self):
        groups = parse_cortecloud_json(
            payload(
                row(material="Roble 18 mm (2500x1830)"),
                row(material="Roble 18 mm (2440x1220)"),
            )
        )
        self.assertEqual(len(groups), 2)
        self.assertEqual(groups[1].sheet.width, 2440.0)
        self.assertEqual(groups[1].sheet.height, 1220.0)


class MachiningParseTest(unittest.TestCase):
    """Ranuras y barrenos dentro de `machining`."""

    def machining(self, **overrides):
        groups = parse_cortecloud_json(payload(row(machining=overrides)))
        return groups[0].parts[0].machining

    def test_importa_diametros_anchos_y_posiciones(self):
        machining = self.machining(
            verticalDrills=[{"diameter": 35, "x": 300, "y": 60}],
            horizontalDrills=[{"diameter": 8, "x": 10, "y": 20}],
            furrowMachining={"width": 9.7, "depth": 8, "face": "i"},
            furrowMachiningPair={"width": 5.7},
        )
        self.assertEqual(machining.vertical_drills, (35.0,))
        self.assertEqual(machining.horizontal_drills, (8.0,))
        self.assertEqual(machining.slot_widths, (9.7, 5.7))
        self.assertEqual(machining.drills[0].x, 300.0)
        self.assertEqual(machining.drills[0].y, 60.0)
        self.assertTrue(machining.drills[0].horizontal is False)
        self.assertTrue(machining.drills[1].horizontal)
        self.assertFalse(machining.slots[0].has_axis)

    def test_barreno_sin_coordenadas(self):
        with self.assertRaises(ValueError) as ctx:
            parse_cortecloud_json(
                payload(row(machining={"verticalDrills": [{"diameter": 8}]}))
            )
        self.assertIn("coordenada 'x'", str(ctx.exception))

    def test_barreno_con_coordenada_invalida(self):
        for value in ("8", True, None):
            with self.assertRaises(ValueError) as ctx:
                parse_cortecloud_json(
                    payload(
                        row(
                            machining={
                                "verticalDrills": [{"diameter": 8, "x": value, "y": 0}]
                            }
                        )
                    )
                )
            self.assertIn("coordenada 'x'", str(ctx.exception))

    def test_machining_vacio_es_sin_mecanizado(self):
        self.assertIsNone(self.machining())
        self.assertIsNone(
            self.machining(verticalDrills=[], horizontalDrills=[], furrowMachining=None)
        )

    def test_ranura_en_lista(self):
        """`furrowMachining`/`furrowMachiningPair` como lista: forma por revisar."""
        machining = self.machining(furrowMachining=[{"width": 6.2}, {"width": 7}])
        self.assertEqual(machining.slot_widths, (6.2, 7.0))

    def test_machining_que_no_es_objeto(self):
        with self.assertRaises(ValueError) as ctx:
            parse_cortecloud_json(payload(row(machining="taladro")))
        self.assertIn("pieza 1", str(ctx.exception))
        self.assertIn("machining", str(ctx.exception))

    def test_barrenos_que_no_son_lista(self):
        with self.assertRaises(ValueError) as ctx:
            parse_cortecloud_json(payload(row(machining={"verticalDrills": {}})))
        self.assertIn("verticalDrills", str(ctx.exception))

    def test_barreno_que_no_es_objeto(self):
        with self.assertRaises(ValueError) as ctx:
            parse_cortecloud_json(payload(row(machining={"horizontalDrills": [8]})))
        self.assertIn("objeto", str(ctx.exception))

    def test_barreno_sin_diametro(self):
        with self.assertRaises(ValueError) as ctx:
            parse_cortecloud_json(
                payload(
                    row(machining={"verticalDrills": [{"x": 10, "y": 10, "depth": 18}]})
                )
            )
        self.assertIn("diámetro de barreno", str(ctx.exception))

    def test_barreno_con_diametro_invalido(self):
        for value in (0, -5, "8", True, None):
            with self.assertRaises(ValueError) as ctx:
                parse_cortecloud_json(
                    payload(
                        row(
                            machining={
                                "verticalDrills": [
                                    {"diameter": value, "x": 10, "y": 10}
                                ]
                            }
                        )
                    )
                )
            self.assertIn("diámetro de barreno", str(ctx.exception))

    def test_ranura_sin_ancho(self):
        with self.assertRaises(ValueError) as ctx:
            parse_cortecloud_json(
                payload(row(machining={"furrowMachining": {"depth": 8}}))
            )
        self.assertIn("ancho de ranura", str(ctx.exception))

    def test_ranura_que_no_es_objeto(self):
        with self.assertRaises(ValueError) as ctx:
            parse_cortecloud_json(payload(row(machining={"furrowMachining": 8})))
        self.assertIn("furrowMachining", str(ctx.exception))

    def test_el_error_indica_la_pieza_que_falla(self):
        with self.assertRaises(ValueError) as ctx:
            parse_cortecloud_json(
                payload(row(), row(machining={"verticalDrills": [{}]}))
            )
        self.assertIn("pieza 2", str(ctx.exception))


if __name__ == "__main__":
    unittest.main()
