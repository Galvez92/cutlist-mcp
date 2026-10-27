"""Pruebas del punto de entrada HTTP de la vista previa (app/servidor.py)."""

import json
import threading
import urllib.error
import urllib.request
from http.server import ThreadingHTTPServer

import pytest

from app.servidor import Manejador


@pytest.fixture()
def servidor():
    httpd = ThreadingHTTPServer(("127.0.0.1", 0), Manejador)
    hilo = threading.Thread(target=httpd.serve_forever, daemon=True)
    hilo.start()
    yield f"http://127.0.0.1:{httpd.server_address[1]}"
    httpd.shutdown()
    httpd.server_close()


def pedir(url, datos=None):
    if datos is None:
        peticion = urllib.request.Request(url)
    else:
        peticion = urllib.request.Request(
            url,
            data=json.dumps(datos).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST",
        )
    try:
        with urllib.request.urlopen(peticion, timeout=5) as respuesta:
            return respuesta.status, respuesta.read().decode("utf-8")
    except urllib.error.HTTPError as error:
        return error.code, error.read().decode("utf-8")


def test_pagina_de_la_vista_previa(servidor):
    estado, cuerpo = pedir(f"{servidor}/")
    assert estado == 200
    assert "Módulos paramétricos" in cuerpo


def test_api_de_modulos_lista_los_cuatro(servidor):
    estado, cuerpo = pedir(f"{servidor}/api/modulos")
    assert estado == 200
    datos = json.loads(cuerpo)
    tipos = [modulo["tipo"] for modulo in datos["modulos"]]
    assert tipos == ["cajonera", "closet", "cocina", "librero"]
    campos = {campo["nombre"] for campo in datos["modulos"][0]["campos"]}
    assert {"ancho", "alto", "fondo", "cajones"} <= campos


def test_api_de_perfil_expone_el_perfil_por_omision(servidor):
    estado, cuerpo = pedir(f"{servidor}/api/perfil")
    assert estado == 200
    datos = json.loads(cuerpo)
    assert datos["nombre"] == "cortecloud_madijal"
    assert datos["pieza_min_corte"] == 65.0
    assert datos["pieza_max"] == [2480.0, 1810.0]


def test_previsualizar_devuelve_piezas_y_hallazgos(servidor):
    estado, cuerpo = pedir(f"{servidor}/api/previsualizar", {"tipo": "cajonera", "params": {}})
    assert estado == 200
    datos = json.loads(cuerpo)
    assert datos["tipo"] == "cajonera"
    assert datos["totales"]["unidades"] == 30
    assert datos["hallazgos"]["errores"] == 0
    assert any(pieza["nombre"] == "Costado" for pieza in datos["piezas"])
    assert datos["piezas"][0]["cantos"]


def test_previsualizar_con_parametros_y_errores_400(servidor):
    estado, cuerpo = pedir(
        f"{servidor}/api/previsualizar",
        {"tipo": "cocina", "params": {"ancho": 800, "cajones": 3, "puertas": 0}},
    )
    assert estado == 200
    assert json.loads(cuerpo)["medidas"]["ancho"] == 800.0

    estado, cuerpo = pedir(f"{servidor}/api/previsualizar", {"tipo": "cocina", "params": {"alto": 50}})
    assert estado == 400
    assert "carcasa" in json.loads(cuerpo)["error"]

    estado, _ = pedir(f"{servidor}/api/previsualizar", {"params": {}})
    assert estado == 400


def test_idea_escrita(servidor):
    estado, cuerpo = pedir(
        f"{servidor}/api/idea", {"texto": "librero ancho=900 alto=1800 fondo=300 repisas=4"}
    )
    assert estado == 200
    datos = json.loads(cuerpo)
    assert datos["tipo"] == "librero"
    assert datos["medidas"]["repisas"] == 4

    estado, cuerpo = pedir(f"{servidor}/api/idea", {"texto": "sillon ancho=500"})
    assert estado == 400
    assert "desconocido" in json.loads(cuerpo)["error"]


def test_rutas_y_json_invalidos(servidor):
    estado, _ = pedir(f"{servidor}/no-existe")
    assert estado == 404

    estado, _ = pedir(f"{servidor}/api/previsualizar")
    assert estado == 404

    peticion = urllib.request.Request(
        f"{servidor}/api/idea", data=b"{no es json", method="POST"
    )
    with pytest.raises(urllib.error.HTTPError) as error:
        urllib.request.urlopen(peticion, timeout=5)
    assert error.value.code == 400
    assert "JSON" in error.value.read().decode("utf-8")
