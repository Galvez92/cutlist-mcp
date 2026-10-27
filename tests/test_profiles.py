"""Pruebas del perfil de restricciones Cortecloud/Madijal (MEMORIA.md)."""

from dataclasses import replace

import pytest

from cutlist.parts import Barreno, Cantos, Mecanizado, Pieza, Ranura
from cutlist.profiles import (
    PERFIL_CORTECLOUD_MADIJAL,
    PERFILES,
    avisos,
    errores,
    resumen_hallazgos,
    validar,
    validar_pieza,
)

PERFIL = PERFIL_CORTECLOUD_MADIJAL


def pieza(**cambios) -> Pieza:
    datos = {"nombre": "Pieza", "largo": 500.0, "ancho": 300.0}
    datos.update(cambios)
    return Pieza(**datos)


def reglas(hallazgos) -> list[str]:
    return [hallazgo.regla for hallazgo in hallazgos]


def test_perfil_esta_cargado_en_el_registro():
    assert PERFILES["cortecloud_madijal"] is PERFIL
    assert PERFIL.pieza_min_corte == 65.0
    assert PERFIL.barrenos_horizontales == (9.525,)
    assert 9.7 in PERFIL.ranuras_permitidas


def test_pieza_correcta_no_tiene_hallazgos():
    assert validar_pieza(pieza(), PERFIL) == []


def test_pieza_bajo_el_minimo_de_corte_es_error():
    hallazgos = validar_pieza(pieza(ancho=60.0), PERFIL)
    assert reglas(hallazgos) == ["pieza_minima"]
    assert hallazgos[0].nivel == "error"


def test_pieza_entre_minimo_y_recomendado_es_aviso():
    hallazgos = validar_pieza(pieza(ancho=68.0), PERFIL)
    assert reglas(hallazgos) == ["pieza_minima_recomendada"]
    assert hallazgos[0].nivel == "aviso"


def test_medida_terminada_ajustada_con_canto_en_ambos_lados():
    # 65 mm de corte + 0.4 mm de canto en los dos lados = 65.8 mm terminados.
    con_canto = pieza(ancho=65.0, cantos=Cantos(largo_a="PVC", largo_b="PVC"))
    assert reglas(validar_pieza(con_canto, PERFIL)) == [
        "pieza_minima_recomendada",
        "pieza_terminada_ajustada",
    ]


def test_pieza_sin_canto_no_avisa_por_medida_terminada():
    # Sin canto la pieza ya está a su medida final: solo rige el mínimo de corte.
    assert reglas(validar_pieza(pieza(ancho=65.0), PERFIL)) == ["pieza_minima_recomendada"]


def test_dimension_cero_es_error_y_corta_la_validacion():
    hallazgos = validar_pieza(pieza(largo=0.0), PERFIL)
    assert reglas(hallazgos) == ["dimension_invalida"]


def test_pieza_mayor_que_la_maxima_es_error():
    hallazgos = validar_pieza(pieza(largo=2490.0, ancho=1800.0), PERFIL)
    assert reglas(hallazgos) == ["pieza_maxima"]


def test_pieza_girada_cabe_en_la_maxima():
    assert validar_pieza(pieza(largo=1800.0, ancho=2480.0), PERFIL) == []


def test_pieza_que_cabe_en_la_maxima_pero_no_en_el_tablero_avisa():
    perfil_grande = replace(PERFIL, pieza_max_largo=3000.0, pieza_max_ancho=3000.0)
    hallazgos = validar_pieza(pieza(largo=2530.0, ancho=400.0), perfil_grande)
    assert reglas(hallazgos) == ["no_cabe_en_tablero"]


def test_pieza_mecanizada_corta_es_error():
    corta = pieza(largo=200.0, ancho=300.0, mecanizado=Mecanizado(barrenos=(Barreno(diametro=5.0),)))
    assert reglas(validar_pieza(corta, PERFIL)) == ["pieza_mecanizada_corta"]


def test_ranura_permitida_no_avisa_y_la_no_permitida_es_error():
    permitida = pieza(mecanizado=Mecanizado(ranuras=(Ranura(ancho=9.7),)))
    assert validar_pieza(permitida, PERFIL) == []

    no_permitida = pieza(mecanizado=Mecanizado(ranuras=(Ranura(ancho=6.0),)))
    assert reglas(validar_pieza(no_permitida, PERFIL)) == ["ranura_no_permitida"]


def test_barrenos_horizontales_solo_aceptan_tres_octavos():
    ok = pieza(mecanizado=Mecanizado(barrenos=(Barreno(diametro=9.525, horizontal=True),)))
    assert validar_pieza(ok, PERFIL) == []

    malo = pieza(mecanizado=Mecanizado(barrenos=(Barreno(diametro=5.0, horizontal=True),)))
    assert reglas(validar_pieza(malo, PERFIL)) == ["barreno_no_permitido"]


def test_barreno_vertical_fuera_de_lista_es_error():
    malo = pieza(mecanizado=Mecanizado(barrenos=(Barreno(diametro=25.0),)))
    assert reglas(validar_pieza(malo, PERFIL)) == ["barreno_no_permitido"]


def test_aviso_de_luz_de_repisa_solo_si_se_configura():
    repisa = pieza(nombre="Repisa", rol="repisa", ancho=1000.0)
    assert validar_pieza(repisa, PERFIL) == []

    con_aviso = replace(PERFIL, luz_max_repisa_aviso=900.0)
    assert reglas(validar_pieza(repisa, con_aviso)) == ["luz_repisa"]


def test_validar_lista_y_resumen():
    hallazgos = validar([pieza(ancho=60.0), pieza(ancho=68.0), pieza()], PERFIL)
    datos = resumen_hallazgos(hallazgos)
    assert datos["errores"] == 1
    assert datos["avisos"] == 1
    assert len(datos["detalle"]) == 2
    assert len(errores(hallazgos)) == 1
    assert len(avisos(hallazgos)) == 1


def test_hallazgo_lleva_el_nombre_de_la_pieza():
    hallazgos = validar_pieza(pieza(nombre="Faldón", ancho=60.0), PERFIL)
    assert hallazgos[0].pieza == "Faldón"
    assert "65" in hallazgos[0].mensaje


@pytest.mark.parametrize("ancho,esperado", [(65.0, 0), (70.0, 0), (64.9, 1)])
def test_umbral_minimo_de_corte(ancho, esperado):
    assert len(errores(validar_pieza(pieza(ancho=ancho), PERFIL))) == esperado
