"""Pruebas del generador de mueble bajo de cocina (ARAUCO #17)."""

import pytest

from cutlist.modules.cocina import ParamsCocina, generar
from cutlist.profiles import errores


def buscar(modulo, nombre):
    for linea in modulo.resumen():
        if linea.nombre == nombre:
            return linea
    raise AssertionError(f"no se generó la pieza {nombre!r}")


def test_medidas_del_cuerpo():
    modulo = generar(ParamsCocina())
    assert modulo.medidas["alto_carcasa"] == pytest.approx(800.0)
    assert modulo.medidas["fondo_costado"] == pytest.approx(582.0)
    assert modulo.medidas["ancho_interior"] == pytest.approx(564.0)

    costado = buscar(modulo, "Costado")
    assert (costado.largo, costado.ancho, costado.cantidad) == (800.0, 582.0, 2)
    assert costado.cantos.por_arista() == {"largo_a": "PVC 0.4 mm"}

    base = buscar(modulo, "Base")
    assert (base.largo, base.ancho) == (582.0, 564.0)
    assert buscar(modulo, "Travesaño frontal").largo == 564.0
    assert buscar(modulo, "Travesaño frontal").ancho == 100.0
    assert buscar(modulo, "Travesaño trasero").cantidad == 1
    assert buscar(modulo, "Trasera").espesor == 3.0


def test_alturas_y_profundidad_segun_arauco():
    params = ParamsCocina()
    modulo = generar(params)
    # 900 mm del piso a la cubierta = zócalo + carcasa (+ mesón).
    assert params.zocalo + modulo.medidas["alto_carcasa"] + params.cubierta_espesor == 900.0
    # 600 mm de profundidad total = costado + puerta.
    assert modulo.medidas["fondo_costado"] + params.espesor_puerta == 600.0


def test_zocalo_retranqueado():
    modulo = generar(ParamsCocina())
    frontal = buscar(modulo, "Zócalo frontal")
    assert (frontal.largo, frontal.ancho) == (600.0, 100.0)
    assert frontal.cantos.por_arista() == {"largo_a": "PVC 0.4 mm"}

    lateral = buscar(modulo, "Zócalo lateral")
    assert (lateral.largo, lateral.ancho) == (582.0 - 75.0, 100.0)
    assert lateral.cantidad == 2
    assert lateral.cantos.vacio()
    assert any("retranqueado 75" in nota for nota in modulo.notas)


def test_puertas_cubrientes_con_bisagras_y_patas():
    modulo = generar(ParamsCocina())
    puerta = buscar(modulo, "Puerta")
    assert (puerta.cantidad, puerta.largo) == (2, 797.0)
    assert puerta.ancho == pytest.approx((600.0 - 3.0) / 2)
    assert puerta.cantos.cantidad() == 4

    accesorios = {accesorio.nombre: accesorio for accesorio in modulo.accesorios}
    assert accesorios["Bisagra"].cantidad == 4
    assert accesorios["Pata regulable"].cantidad == 4


def test_cajones_en_lugar_de_puertas():
    modulo = generar(ParamsCocina(puertas=0, cajones=2))
    frente = buscar(modulo, "Frente de cajón")
    assert frente.cantidad == 2
    assert frente.ancho == 600.0
    assert not [linea for linea in modulo.resumen() if linea.rol == "puerta"]

    ancho_caja = 564.0 - 25.0
    laterales = buscar(modulo, "Lateral cajón")
    assert laterales.largo == 500.0  # corredera estándar mayor dentro de 582 - 3 - 10
    assert laterales.ancho == pytest.approx((800.0 - 3.0) / 2 - 20.0)
    assert buscar(modulo, "Piso cajón").ancho == pytest.approx(ancho_caja)


def test_puertas_y_cajones_no_se_mezclan():
    with pytest.raises(ValueError, match="puertas o cajones"):
        generar(ParamsCocina(puertas=1, cajones=1))


def test_el_modulo_respeta_el_perfil_por_omision():
    assert errores(generar(ParamsCocina()).validar()) == []
    assert errores(generar(ParamsCocina(puertas=0, cajones=3)).validar()) == []


def test_medidas_invalidas_fallan():
    with pytest.raises(ValueError, match="alto de carcasa"):
        generar(ParamsCocina(alto=80.0))
    with pytest.raises(ValueError, match="profundidad de costado"):
        generar(ParamsCocina(espesor_puerta=600.0))
    with pytest.raises(ValueError, match="retranqueo del zócalo"):
        generar(ParamsCocina(retranqueo_zocalo=900.0))
