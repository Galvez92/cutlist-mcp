"""Pruebas del intérprete de ideas escritas (`cutlist.spec`)."""

import pytest

from cutlist.spec import construir, construir_desde_texto, parsear


def test_parsear_separa_tipo_y_valores():
    tipo, valores = parsear("cajonera ancho=450 alto=800 fondo=500 cajones=3")
    assert tipo == "cajonera"
    assert valores == {"ancho": "450", "alto": "800", "fondo": "500", "cajones": "3"}


def test_alias_de_modulos():
    assert parsear("clóset ancho=1000")[0] == "closet"
    assert parsear("placard ancho=1000")[0] == "closet"
    assert parsear("biblioteca ancho=800")[0] == "librero"
    assert parsear("bajo mesada ancho=600")[0] == "cocina"


def test_construir_cajonera_desde_texto():
    modulo = construir_desde_texto("cajonera ancho=450 alto=800 fondo=500 cajones=3")
    assert modulo.tipo == "cajonera"
    assert modulo.medidas["ancho"] == 450.0
    assert modulo.medidas["cajones"] == 3
    assert len([linea for linea in modulo.resumen() if linea.nombre == "Frente de cajón"]) == 1
    assert [linea for linea in modulo.resumen() if linea.nombre == "Frente de cajón"][0].cantidad == 3


def test_conversion_de_tipos():
    modulo = construir_desde_texto("librero ancho=800 repisas=2 repisas_moviles=si")
    assert len(modulo.accesorios) == 2  # tornillos + soportes Ø5

    con_lista = construir_desde_texto("librero repisas=0 posiciones_repisas=[400, 800]")
    assert con_lista.medidas["repisas"] == 2


def test_cadena_entrecomillada_con_espacios():
    modulo = construir_desde_texto('closet nombre="Clóset pieza 2" tipo_puerta=sin')
    assert modulo.nombre == "Clóset pieza 2"


def test_altura_opcional_del_barral():
    con_barral = construir_desde_texto("closet barral_altura=1750")
    assert any(a.nombre == "Barral redondo" for a in con_barral.accesorios)

    sin_barral = construir("closet", {"barral_altura": None})
    assert not [a for a in sin_barral.accesorios if a.nombre == "Barral redondo"]


@pytest.mark.parametrize(
    "texto,mensaje",
    [
        ("", "no se escribió"),
        ("sillon ancho=500", "módulo desconocido"),
        ("cajonera ancho", "parámetro sin valor"),
        ("cajonera =450", "parámetro sin nombre"),
        ("cajonera ancho=450 ancho=500", "parámetro repetido"),
        ("cajonera inventado=1", "desconocido"),
    ],
)
def test_errores_claros(texto, mensaje):
    with pytest.raises(ValueError, match=mensaje):
        construir_desde_texto(texto)


def test_valor_invalido_falla_con_el_parametro():
    with pytest.raises(ValueError):
        construir_desde_texto("cajonera cajones=muchos")
