"""Pruebas del generador de cajonera."""

import pytest

from cutlist.modules import generar_modulo, obtener
from cutlist.modules.cajonera import ParamsCajonera, generar
from cutlist.profiles import errores

MEDIDAS_CUERPO = {
    "Costado": (800.0, 500.0, 2),
    "Base": (500.0, 414.0, 1),
    "Tapa": (500.0, 414.0, 1),
    "Travesaño trasero": (414.0, 100.0, 1),
    "Trasera": (800.0, 450.0, 1),
}


def buscar(modulo, nombre):
    for linea in modulo.resumen():
        if linea.nombre == nombre:
            return linea
    raise AssertionError(f"no se generó la pieza {nombre!r}")


def test_medidas_del_cuerpo():
    modulo = generar(ParamsCajonera())
    for nombre, (largo, ancho, cantidad) in MEDIDAS_CUERPO.items():
        pieza = buscar(modulo, nombre)
        assert pieza.largo == pytest.approx(largo), nombre
        assert pieza.ancho == pytest.approx(ancho), nombre
        assert pieza.cantidad == cantidad, nombre
    assert modulo.medidas["ancho_interior"] == pytest.approx(414.0)


def test_cantos_del_cuerpo():
    modulo = generar(ParamsCajonera())
    assert buscar(modulo, "Costado").cantos.por_arista() == {"largo_a": "PVC 0.4 mm"}
    assert buscar(modulo, "Base").cantos.por_arista() == {"ancho_a": "PVC 0.4 mm"}
    assert buscar(modulo, "Travesaño trasero").cantos.vacio()


def test_trasera_con_espesor_menor_y_sin_canto():
    trasera = buscar(generar(ParamsCajonera()), "Trasera")
    assert trasera.espesor == 3.0
    assert trasera.material == "MDF 3 mm"
    assert trasera.veta == "indiferente"


def test_sin_trasera_cuando_el_espesor_es_cero():
    modulo = generar(ParamsCajonera(trasera_espesor=0))
    assert not [linea for linea in modulo.resumen() if linea.nombre == "Trasera"]


def test_frentes_cubrientes_reparten_el_alto():
    params = ParamsCajonera()
    modulo = generar(params)
    frente = buscar(modulo, "Frente de cajón")
    assert frente.cantidad == 4
    assert frente.ancho == pytest.approx(450.0)
    assert frente.largo == pytest.approx((800.0 - 3 * params.juego) / 4)
    assert frente.cantos.cantidad() == 4
    # Los frentes cubren todo el alto, con las holguras intermedias.
    assert frente.largo * 4 + params.juego * 3 == pytest.approx(800.0)


def test_caja_de_cajon_sigue_el_despiece_del_fixture():
    params = ParamsCajonera()
    modulo = generar(params)
    ancho_caja = 414.0 - params.juego_corredera  # 389 mm
    largo_caja = 450.0  # mayor corredera estándar que cabe en 500 - 3 - 10 mm
    alto_caja = (800.0 - 3 * params.juego) / 4 - params.margen_alto_cajon

    laterales = buscar(modulo, "Lateral cajón")
    assert (laterales.largo, laterales.ancho) == pytest.approx((largo_caja, alto_caja))
    # La lista agrupa los laterales de los cuatro cajones: 2 por cajón.
    assert laterales.cantidad == 8
    assert laterales.cantos.por_arista() == {"largo_a": "PVC 0.4 mm"}

    frente_interior = buscar(modulo, "Frente interior cajón")
    assert frente_interior.largo == pytest.approx(ancho_caja - 2 * params.espesor)
    assert frente_interior.ancho == pytest.approx(alto_caja)
    assert frente_interior.cantos.vacio()

    piso = buscar(modulo, "Piso cajón")
    assert (piso.largo, piso.ancho) == pytest.approx((largo_caja, ancho_caja))
    assert piso.cantos.vacio()


def test_accesorios_correderas_y_tiradores():
    modulo = generar(ParamsCajonera(cajones=2))
    accesorios = {accesorio.nombre: accesorio for accesorio in modulo.accesorios}
    assert accesorios["Corredera"].cantidad == 2
    assert accesorios["Tirador o manija"].cantidad == 2
    assert "450" in accesorios["Corredera"].nota


def test_alturas_de_frente_explicitas():
    modulo = generar(ParamsCajonera(alto=500.0, cajones=2, alturas_frente=(110.0, 180.0)))
    alturas = sorted(
        linea.largo for linea in modulo.resumen() if linea.nombre == "Frente de cajón"
    )
    assert alturas == pytest.approx([110.0, 180.0])


def test_nota_cuando_la_corredera_no_es_estandar():
    modulo = generar(ParamsCajonera(fondo=380.0, trasera_espesor=0.0, juego_fondo=10.0))
    assert any("por revisar" in nota for nota in modulo.notas)
    assert modulo.medidas["largo_caja_cajon"] == pytest.approx(370.0)


def test_el_modulo_respeta_el_perfil_cortecloud_madijal():
    modulo = generar(ParamsCajonera())
    assert errores(modulo.validar()) == []


def test_medidas_invalidas_fallan():
    with pytest.raises(ValueError, match="al menos un cajón"):
        generar(ParamsCajonera(cajones=0))
    with pytest.raises(ValueError, match="interior entre costados"):
        generar(ParamsCajonera(ancho=30.0))
    with pytest.raises(ValueError, match="no caben"):
        generar(ParamsCajonera(cajones=2, alturas_frente=(500.0, 500.0)))
    with pytest.raises(ValueError, match="alturas de frente"):
        generar(ParamsCajonera(cajones=4, alturas_frente=(100.0, 100.0)))


def test_generar_modulo_desde_el_registro_con_valores_json():
    modulo = generar_modulo("cajonera", {"ancho": 500, "cajones": 3})
    assert modulo.tipo == "cajonera"
    assert buscar(modulo, "Frente de cajón").cantidad == 3
    assert buscar(modulo, "Base").ancho == pytest.approx(500.0 - 2 * 18.0)

    with pytest.raises(ValueError, match="desconocido"):
        generar_modulo("cajonera", {"inventado": 1})


def test_registro_expone_los_campos():
    registro = obtener("cajonera")
    campos = registro.campos_ui()
    assert "ancho" in [campo["nombre"] for campo in campos]
    assert all(campo["descripcion"] for campo in campos)
