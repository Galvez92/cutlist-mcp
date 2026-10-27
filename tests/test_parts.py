"""Pruebas del modelo de piezas, cantos y totales."""

import pytest

from cutlist.parts import (
    Barreno,
    Cantos,
    Mecanizado,
    Pieza,
    Ranura,
    resumen,
    tabla,
    totales,
)


def pieza(**cambios) -> Pieza:
    datos = {"nombre": "Costado", "largo": 500.0, "ancho": 100.0}
    datos.update(cambios)
    return Pieza(**datos)


def test_cantos_por_arista_y_cantidad():
    cantos = Cantos(largo_a="PVC 0.4 mm", ancho_b="PVC 0.4 mm")
    assert cantos.cantidad() == 2
    assert cantos.aristas() == ("largo_a", "ancho_b")
    assert cantos.por_arista() == {"largo_a": "PVC 0.4 mm", "ancho_b": "PVC 0.4 mm"}
    assert not cantos.vacio()


def test_cantos_todas_las_aristas():
    cantos = Cantos().todas("PVC 0.4 mm")
    assert cantos.cantidad() == 4
    assert set(cantos.por_arista()) == {"largo_a", "largo_b", "ancho_a", "ancho_b"}


def test_cantos_rechaza_arista_desconocida():
    with pytest.raises(ValueError, match="aristas desconocidas"):
        Cantos().con(frente="PVC")


def test_medidas_terminadas_suma_canto_de_aristas_de_largo():
    # El canto de una arista de longitud `largo` engrosa el `ancho` de la pieza.
    con_canto = pieza(cantos=Cantos(largo_a="PVC", largo_b="PVC"))
    largo, ancho = con_canto.medidas_terminadas()
    assert largo == pytest.approx(500.0)
    assert ancho == pytest.approx(100.8)


def test_medidas_terminadas_suma_canto_de_aristas_de_ancho():
    con_canto = pieza(cantos=Cantos(ancho_a="PVC"))
    largo, ancho = con_canto.medidas_terminadas()
    assert largo == pytest.approx(500.4)
    assert ancho == pytest.approx(100.0)


def test_medidas_terminadas_sin_canto_no_cambia():
    assert pieza().medidas_terminadas() == (500.0, 100.0)


def test_veta_invalida_falla():
    with pytest.raises(ValueError, match="veta inválida"):
        pieza(veta="diagonal")


def test_cantidad_negativa_falla():
    with pytest.raises(ValueError, match="cantidad"):
        pieza(cantidad=-1)


def test_area_y_to_dict():
    completo = pieza(
        rol="costado",
        cantos=Cantos(largo_a="PVC 0.4 mm"),
        mecanizado=Mecanizado(barrenos=(Barreno(diametro=5.0),), ranuras=(Ranura(ancho=9.7),)),
        funcion="Costado — canto frontal",
        modulo="Cajonera 450x800x500",
    )
    assert completo.area_mm2 == pytest.approx(50_000.0)
    datos = completo.to_dict()
    assert datos["cantos"] == {"largo_a": "PVC 0.4 mm"}
    assert datos["ancho_terminado"] == pytest.approx(100.4)
    assert datos["mecanizado"]["barrenos"][0]["diametro"] == 5.0
    assert datos["mecanizado"]["ranuras"][0]["ancho"] == 9.7
    assert datos["rol"] == "costado"


def test_mecanizado_vacio():
    assert Mecanizado().vacio()
    assert not Mecanizado(barrenos=(Barreno(diametro=5.0),)).vacio()


def test_resumen_agrupa_lineas_identicas():
    lineas = resumen(
        [
            pieza(nombre="Lateral cajón", cantos=Cantos(largo_a="PVC")),
            pieza(nombre="Lateral cajón", cantos=Cantos(largo_a="PVC")),
            pieza(nombre="Piso cajón"),
        ]
    )
    assert [(linea.nombre, linea.cantidad) for linea in lineas] == [
        ("Lateral cajón", 2),
        ("Piso cajón", 1),
    ]


def test_resumen_no_mezcla_piezas_con_distinto_canto():
    lineas = resumen(
        [
            pieza(nombre="Costado", cantos=Cantos(largo_a="PVC")),
            pieza(nombre="Costado"),
        ]
    )
    assert len(lineas) == 2


def test_totales_y_tabla():
    lineas = resumen([pieza(cantidad=2), pieza(nombre="Repisa", largo=300.0, ancho=100.0)])
    datos = totales(lineas)
    assert datos["lineas"] == 2
    assert datos["unidades"] == 3
    assert datos["area_m2"] == pytest.approx((500.0 * 100.0 * 2 + 300.0 * 100.0) / 1_000_000)

    texto = tabla(lineas)
    assert "Costado" in texto
    assert "Repisa" in texto
    assert "3 piezas en 2 líneas" in texto
