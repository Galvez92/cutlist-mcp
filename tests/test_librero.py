"""Pruebas del generador de librero."""

import pytest

from cutlist.modules.librero import ParamsLibrero, generar
from cutlist.profiles import errores


def buscar(modulo, nombre):
    for linea in modulo.resumen():
        if linea.nombre == nombre:
            return linea
    raise AssertionError(f"no se generó la pieza {nombre!r}")


def test_medidas_del_cuerpo():
    modulo = generar(ParamsLibrero())
    costado = buscar(modulo, "Costado")
    assert (costado.largo, costado.ancho, costado.cantidad) == (2000.0, 300.0, 2)
    # La tapa va entre costados: la arista superior del costado queda a la vista.
    assert costado.cantos.por_arista() == {"largo_a": "PVC 0.4 mm", "ancho_a": "PVC 0.4 mm"}

    assert (buscar(modulo, "Base").largo, buscar(modulo, "Base").ancho) == (300.0, 764.0)
    assert buscar(modulo, "Tapa").cantidad == 1
    assert buscar(modulo, "Trasera").espesor == 3.0
    assert (buscar(modulo, "Trasera").largo, buscar(modulo, "Trasera").ancho) == (2000.0, 800.0)


def test_repisas_repartidas_en_el_interior():
    modulo = generar(ParamsLibrero())
    repisa = buscar(modulo, "Repisa")
    assert repisa.cantidad == 4
    assert (repisa.largo, repisa.ancho) == (300.0, 764.0)
    assert repisa.cantos.por_arista() == {"ancho_a": "PVC 0.4 mm"}
    # Alturas repartidas parejas: (1982 - 18) / 5 = 392.8 mm de paso.
    assert any(nota.startswith("Alturas de repisa") for nota in modulo.notas)


def test_repisas_en_alturas_pedidas_y_sin_repisas():
    modulo = generar(ParamsLibrero(repisas=0, posiciones_repisas=(400.0, 800.0, 1200.0)))
    assert buscar(modulo, "Repisa").cantidad == 3

    vacio = generar(ParamsLibrero(repisas=0))
    assert not [linea for linea in vacio.resumen() if linea.nombre == "Repisa"]
    assert "Librero sin repisas." in vacio.notas


def test_repisas_moviles_agregan_barrenos_y_soportes():
    modulo = generar(ParamsLibrero(repisas_moviles=True))
    costado = buscar(modulo, "Costado")
    assert len(costado.mecanizado.barrenos) == 20  # 4 posiciones x 5
    assert {barreno.diametro for barreno in costado.mecanizado.barrenos} == {5.0}

    soportes = [a for a in modulo.accesorios if a.nombre == "Soporte de repisa Ø5"]
    assert soportes and soportes[0].cantidad == 16  # 4 por repisa


def test_sin_trasera_lo_avisa():
    modulo = generar(ParamsLibrero(trasera_espesor=0))
    assert not [linea for linea in modulo.resumen() if linea.nombre == "Trasera"]
    assert any("rigidización" in nota for nota in modulo.notas)


def test_el_modulo_respeta_el_perfil_por_omision():
    assert errores(generar(ParamsLibrero(repisas_moviles=True)).validar()) == []


def test_medidas_invalidas_fallan():
    with pytest.raises(ValueError, match="interior entre costados"):
        generar(ParamsLibrero(ancho=20.0))
    with pytest.raises(ValueError, match="fuera del interior"):
        generar(ParamsLibrero(posiciones_repisas=(1990.0,)))
    with pytest.raises(ValueError, match="profundidad"):
        generar(ParamsLibrero(trasera_espesor=300.0))
