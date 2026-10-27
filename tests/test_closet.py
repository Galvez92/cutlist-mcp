"""Pruebas del generador de clóset."""

import pytest

from cutlist.modules.closet import ParamsCloset, generar
from cutlist.profiles import errores


def buscar(modulo, nombre):
    for linea in modulo.resumen():
        if linea.nombre == nombre:
            return linea
    raise AssertionError(f"no se generó la pieza {nombre!r}")


def test_medidas_del_cuerpo():
    modulo = generar(ParamsCloset())
    assert (buscar(modulo, "Costado").largo, buscar(modulo, "Costado").ancho) == (2400.0, 600.0)
    assert buscar(modulo, "Costado").cantidad == 2
    assert (buscar(modulo, "Base").largo, buscar(modulo, "Base").ancho) == (600.0, 1464.0)
    assert buscar(modulo, "Tapa").cantidad == 1
    assert (buscar(modulo, "Trasera").largo, buscar(modulo, "Trasera").ancho) == (2400.0, 1500.0)
    assert buscar(modulo, "Trasera").espesor == 3.0
    assert modulo.medidas["ancho_interior"] == pytest.approx(1464.0)


def test_repisas_repartidas_en_el_interior():
    modulo = generar(ParamsCloset())
    repisa = buscar(modulo, "Repisa")
    assert repisa.cantidad == 3
    assert (repisa.largo, repisa.ancho) == (600.0, 1464.0)
    assert repisa.cantos.por_arista() == {"ancho_a": "PVC 0.4 mm"}
    assert repisa.rol == "repisa"
    # Alturas repartidas parejas: paso = (2382 - 18) / 4 = 591 mm.
    assert any(nota.endswith("591, 1182, 1773") for nota in modulo.notas)


def test_posiciones_de_repisa_explicitas():
    modulo = generar(ParamsCloset(repisas=0, posiciones_repisas=(500.0, 1000.0, 1500.0)))
    assert buscar(modulo, "Repisa").cantidad == 3
    assert any(nota.endswith("482, 982, 1482") for nota in modulo.notas)


def test_repisa_fuera_del_modulo_falla():
    with pytest.raises(ValueError, match="fuera del interior"):
        generar(ParamsCloset(posiciones_repisas=(10.0,)))


def test_puertas_batientes_cubrientes():
    modulo = generar(ParamsCloset())
    puerta = buscar(modulo, "Puerta")
    assert puerta.cantidad == 2
    assert puerta.largo == pytest.approx(2400.0 - 3.0)
    assert puerta.ancho == pytest.approx((1500.0 - 3.0) / 2)
    assert puerta.cantos.cantidad() == 4
    assert puerta.espesor == 18.0
    accesorios = {accesorio.nombre: accesorio for accesorio in modulo.accesorios}
    assert accesorios["Bisagra"].cantidad == 8  # 4 por puerta a 2397 mm de alto
    assert accesorios["Tirador o manija"].cantidad == 2


def test_puertas_correderas_traslapadas():
    modulo = generar(ParamsCloset(tipo_puerta="corredera", puertas=3))
    hoja = buscar(modulo, "Puerta corredera")
    assert hoja.cantidad == 3
    assert hoja.ancho == pytest.approx((1500.0 + 2 * 30.0) / 3)
    assert hoja.largo == pytest.approx(2400.0 - 45.0)
    assert any("por revisar" in nota for nota in modulo.notas)
    assert {accesorio.nombre for accesorio in modulo.accesorios} >= {
        "Guía superior de puerta corredera",
        "Guía inferior de puerta corredera",
    }


def test_closet_sin_puertas():
    modulo = generar(ParamsCloset(tipo_puerta="sin"))
    assert not [linea for linea in modulo.resumen() if linea.rol == "puerta"]
    assert modulo.medidas["puertas"] == 0


def test_barral_como_accesorio_con_su_altura():
    modulo = generar(ParamsCloset(barral_altura=1800.0))
    barral = [accesorio for accesorio in modulo.accesorios if accesorio.nombre == "Barral redondo"]
    assert len(barral) == 1
    assert "1800" in barral[0].nota

    sin_barral = generar(ParamsCloset(barral_altura=None))
    assert not [
        accesorio for accesorio in sin_barral.accesorios if accesorio.nombre == "Barral redondo"
    ]

    with pytest.raises(ValueError, match="dentro del módulo"):
        generar(ParamsCloset(barral_altura=3000.0))


def test_repisas_moviles_perforan_los_costados():
    modulo = generar(ParamsCloset(repisas=3, repisas_moviles=True))
    costado = buscar(modulo, "Costado")
    assert len(costado.mecanizado.barrenos) == 15  # 3 posiciones x 5
    assert {barreno.diametro for barreno in costado.mecanizado.barrenos} == {5.0}
    assert "barrenos" in costado.funcion

    soportes = [a for a in modulo.accesorios if a.nombre == "Soporte de repisa Ø5"]
    assert soportes and soportes[0].cantidad == 12  # 4 por repisa

    sin_perforar = buscar(generar(ParamsCloset()), "Costado")
    assert sin_perforar.mecanizado.vacio()


def test_el_modulo_respeta_el_perfil_por_omision():
    modulo = generar(ParamsCloset(repisas_moviles=True))
    assert errores(modulo.validar()) == []


def test_medidas_invalidas_fallan():
    with pytest.raises(ValueError, match="tipo_puerta inválido"):
        generar(ParamsCloset(tipo_puerta="plegable"))
    with pytest.raises(ValueError, match="menor que uno"):
        generar(ParamsCloset(puertas=0))
    with pytest.raises(ValueError, match="dos hojas"):
        generar(ParamsCloset(tipo_puerta="corredera", puertas=1))
    with pytest.raises(ValueError, match="interior entre costados"):
        generar(ParamsCloset(ancho=30.0))
