"""Mecanizados justo en el borde de la pieza: límite de la tolerancia.

`Machining.outside` acepta el mecanizado que no sobresalga del área más de
`MACHINING_TOLERANCE` (1e-6 mm). Estos casos fijan esa frontera: un barreno
tangente al canto, una ranura pasante que termina justo en el borde o una
ranura diagonal que toca la esquina son **válidos** —no pueden marcar un falso
positivo—, mientras que cualquier exceso mayor que la tolerancia invalida la
pieza.
"""

from __future__ import annotations

import math
import unittest

from cutlist.constraints import MACHINING_TOLERANCE, Constraints
from cutlist.models import Drill, Machining, Part, Slot

WIDTH = 600.0
HEIGHT = 300.0
DIAMETER = 35.0
RADIUS = DIAMETER / 2.0
SLOT_WIDTH = 10.0
HALF = SLOT_WIDTH / 2.0
TOLERANCE = MACHINING_TOLERANCE


def reasons(machining: Machining | None) -> tuple[str, ...]:
    """Motivos por los que la pieza no se puede cortar."""
    return Part(WIDTH, HEIGHT, machining=machining).invalid_reasons


def edge_reasons(
    machining: Machining | None, thickness: float | None = 18.0
) -> tuple[str, ...]:
    """Motivos de una pieza con espesor conocido (barrenos al canto)."""
    return Part(WIDTH, HEIGHT, thickness=thickness, machining=machining).invalid_reasons


class MachiningToleranceLimitTest(unittest.TestCase):
    """La tolerancia de 1e-6 mm es la frontera entre válido e inválido."""

    def test_la_tolerancia_documentada_es_1e_6_mm(self):
        self.assertEqual(TOLERANCE, 1e-6)

    def test_barreno_tangente_a_cada_canto_es_valido(self):
        """El círculo del barreno toca el canto sin salirse: no hay falso positivo."""
        drills = {
            "izquierdo": Drill(RADIUS, HEIGHT / 2, DIAMETER),
            "derecho": Drill(WIDTH - RADIUS, HEIGHT / 2, DIAMETER),
            "superior": Drill(WIDTH / 2, RADIUS, DIAMETER),
            "inferior": Drill(WIDTH / 2, HEIGHT - RADIUS, DIAMETER),
        }
        for edge, drill in drills.items():
            with self.subTest(canto=edge):
                self.assertEqual(reasons(Machining(drills=(drill,))), ())

    def test_barreno_tangente_en_la_esquina_es_valido(self):
        self.assertEqual(
            reasons(Machining(drills=(Drill(RADIUS, RADIUS, DIAMETER),))), ()
        )
        self.assertEqual(
            reasons(
                Machining(drills=(Drill(WIDTH - RADIUS, HEIGHT - RADIUS, DIAMETER),))
            ),
            (),
        )

    def test_barreno_que_sobresale_dentro_de_la_tolerancia_es_valido(self):
        excess = TOLERANCE / 2
        drills = {
            "izquierdo": Drill(RADIUS - excess, HEIGHT / 2, DIAMETER),
            "derecho": Drill(WIDTH - RADIUS + excess, HEIGHT / 2, DIAMETER),
            "superior": Drill(WIDTH / 2, RADIUS - excess, DIAMETER),
            "inferior": Drill(WIDTH / 2, HEIGHT - RADIUS + excess, DIAMETER),
        }
        for edge, drill in drills.items():
            with self.subTest(canto=edge):
                self.assertEqual(reasons(Machining(drills=(drill,))), ())

    def test_barreno_que_sobresale_mas_que_la_tolerancia_invalida(self):
        excess = TOLERANCE * 2
        drills = {
            "izquierdo": Drill(RADIUS - excess, HEIGHT / 2, DIAMETER),
            "derecho": Drill(WIDTH - RADIUS + excess, HEIGHT / 2, DIAMETER),
            "superior": Drill(WIDTH / 2, RADIUS - excess, DIAMETER),
            "inferior": Drill(WIDTH / 2, HEIGHT - RADIUS + excess, DIAMETER),
        }
        for edge, drill in drills.items():
            with self.subTest(canto=edge):
                problems = reasons(Machining(drills=(drill,)))
                self.assertEqual(len(problems), 1)
                self.assertIn("barreno Ø35 mm", problems[0])

    def test_barreno_centrado_en_el_canto_invalida(self):
        """Tangente sí, mitad fuera no: el borde no relaja la validación."""
        self.assertEqual(
            len(reasons(Machining(drills=(Drill(0, HEIGHT / 2, DIAMETER),)))), 1
        )

    def test_ranura_pasante_tangente_a_cada_canto_es_valida(self):
        """Ranura que muere justo en el borde (pasante por el canto)."""
        slots = {
            "izquierdo": Slot(SLOT_WIDTH, HALF, 0, HALF, HEIGHT),
            "derecho": Slot(SLOT_WIDTH, WIDTH - HALF, 0, WIDTH - HALF, HEIGHT),
            "superior": Slot(SLOT_WIDTH, 0, HALF, WIDTH, HALF),
            "inferior": Slot(SLOT_WIDTH, 0, HEIGHT - HALF, WIDTH, HEIGHT - HALF),
        }
        for edge, slot in slots.items():
            with self.subTest(canto=edge):
                self.assertEqual(reasons(Machining(slots=(slot,))), ())

    def test_ranura_que_sobresale_dentro_de_la_tolerancia_es_valida(self):
        excess = TOLERANCE / 2
        slots = (
            Slot(SLOT_WIDTH, HALF - excess, 0, HALF - excess, HEIGHT),
            Slot(SLOT_WIDTH, WIDTH - HALF + excess, 0, WIDTH - HALF + excess, HEIGHT),
            Slot(SLOT_WIDTH, 0, HALF - excess, WIDTH, HALF - excess),
            Slot(SLOT_WIDTH, 0, HEIGHT - HALF + excess, WIDTH, HEIGHT - HALF + excess),
        )
        for slot in slots:
            with self.subTest(ranura=slot):
                self.assertEqual(reasons(Machining(slots=(slot,))), ())

    def test_ranura_que_sobresale_mas_que_la_tolerancia_invalida(self):
        excess = TOLERANCE * 2
        slot = Slot(SLOT_WIDTH, HALF - excess, 0, HALF - excess, HEIGHT)
        problems = reasons(Machining(slots=(slot,)))
        self.assertEqual(len(problems), 1)
        self.assertIn("ranura de 10 mm", problems[0])

    def test_ranura_diagonal_que_toca_la_esquina_es_valida(self):
        """El ancho se abre perpendicular al eje: la tolerancia cubre el redondeo."""
        reach = HALF / math.sqrt(2.0)
        slot = Slot(SLOT_WIDTH, reach, reach, reach + 200, reach + 200)
        self.assertEqual(reasons(Machining(slots=(slot,))), ())

    def test_ranura_diagonal_que_sobresale_la_esquina_invalida(self):
        reach = HALF / math.sqrt(2.0) - TOLERANCE * 10
        slot = Slot(SLOT_WIDTH, reach, reach, reach + 200, reach + 200)
        self.assertEqual(len(reasons(Machining(slots=(slot,)))), 1)

    def test_ranura_sin_eje_en_el_borde_no_se_valida(self):
        """Una ranura sin eje no se puede posicionar: no marca falso positivo."""
        self.assertEqual(reasons(Machining(slots=(Slot(SLOT_WIDTH),))), ())

class HorizontalDrillEdgeTest(unittest.TestCase):
    """Barrenos al canto: el centro se mide contra el canto y el espesor."""

    def test_barreno_horizontal_dentro_del_canto_y_espesor_es_valido(self):
        drill = Drill(150, 9, 8.0, horizontal=True)
        self.assertEqual(edge_reasons(Machining(drills=(drill,))), ())

    def test_barreno_horizontal_tangente_es_valido(self):
        for drill in (
            Drill(0, 0, 8.0, horizontal=True),
            Drill(WIDTH, 18.0, 8.0, horizontal=True),
        ):
            with self.subTest(barreno=drill):
                self.assertEqual(edge_reasons(Machining(drills=(drill,))), ())

    def test_barreno_horizontal_fuera_del_canto_invalida(self):
        drill = Drill(WIDTH + 1, 9, 8.0, horizontal=True)
        reasons_ = edge_reasons(Machining(drills=(drill,)))
        self.assertEqual(len(reasons_), 1)
        self.assertIn("barreno horizontal Ø8 mm", reasons_[0])
        self.assertIn("fuera del canto 600 mm", reasons_[0])

    def test_barreno_horizontal_fuera_del_espesor_invalida(self):
        drill = Drill(150, 40, 8.0, horizontal=True)
        reasons_ = edge_reasons(Machining(drills=(drill,)))
        self.assertEqual(len(reasons_), 1)
        self.assertIn("espesor 18 mm", reasons_[0])

    def test_barreno_horizontal_acepta_la_otra_lectura_de_coordenadas(self):
        """El export no dice cuál coordenada corre a lo largo del canto."""
        drill = Drill(9, 150, 8.0, horizontal=True)
        self.assertEqual(edge_reasons(Machining(drills=(drill,))), ())

    def test_barreno_horizontal_sin_espesor_solo_valida_el_canto(self):
        dentro = Drill(150, 90, 8.0, horizontal=True)
        self.assertEqual(edge_reasons(Machining(drills=(dentro,)), thickness=None), ())
        fuera = Drill(WIDTH + 1, 9, 8.0, horizontal=True)
        self.assertEqual(
            len(edge_reasons(Machining(drills=(fuera,)), thickness=None)), 1
        )

    def test_barreno_vertical_sigue_midiendose_contra_la_cara(self):
        """Un Ø35 de cara en un tablero de 18 mm es normal: no es del canto."""
        part = Part(
            WIDTH,
            HEIGHT,
            thickness=18.0,
            machining=Machining(drills=(Drill(150, 150, DIAMETER),)),
        )
        self.assertEqual(part.invalid_reasons, ())

    def test_barreno_horizontal_y_vertical_se_contabilizan_juntos(self):
        machining = Machining(
            drills=(
                Drill(150, 9, 8.0, horizontal=True),
                Drill(WIDTH + 1, 9, 8.0, horizontal=True),
                Drill(5, 150, DIAMETER),
            )
        )
        reasons_ = edge_reasons(machining)
        self.assertEqual(len(reasons_), 2)
        self.assertIn("barreno horizontal", reasons_[0])
        self.assertIn("barreno Ø35 mm", reasons_[1])


class ConstraintsEdgeToleranceTest(unittest.TestCase):
    """El perfil Cortecloud no debe avisar por mecanizado tangente al borde."""

    def test_perfil_no_avisa_mecanizado_tangente(self):
        width = 9.7  # ancho de ranura que el perfil admite
        half = width / 2.0
        part = Part(
            WIDTH,
            HEIGHT,
            label="costado",
            machining=Machining(
                drills=(Drill(RADIUS, RADIUS, DIAMETER),),
                slots=(Slot(width, half, 0, half, HEIGHT),),
            ),
        )
        self.assertEqual(Constraints().violations(part), [])


if __name__ == "__main__":
    unittest.main()
