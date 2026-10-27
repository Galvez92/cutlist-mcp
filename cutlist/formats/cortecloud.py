"""Cortecloud — JSON de piezas (importación y exportación).

Fuente principal (documentación oficial de Serrabits):
https://cortecloud.com/api-docs/guias/json_import/

Estructura documentada: ``{"parts": [ {...} ]}`` con ``quantity``, ``c``, ``l``,
``function``, ``complement``, ``c1``/``c2``/``l1``/``l2`` (texto del canto o
``null``), ``material`` y ``machining`` (furación/usinado).

Lo no verificado se marca «por revisar» en :data:`DESCRIPTOR`; ver
``docs/formatos/cortecloud.md``.
"""

from __future__ import annotations

import json
from typing import Any

from ..model import ErrorDato, Fuente, ListaCorte, PARCIAL, Pieza
from .base import DIRECCION_AMBOS, DescriptorFormato, ErrorFormato, propagar_avisos

CLAVE = "cortecloud"

DESCRIPTOR = DescriptorFormato(
    clave=CLAVE,
    nombre="Cortecloud (JSON de piezas)",
    direccion=DIRECCION_AMBOS,
    estado=PARCIAL,
    fuentes=(
        Fuente(
            "https://cortecloud.com/api-docs/guias/json_import/",
            "Guía oficial «Importar JSON Cortecloud» (Serrabits): estructura de "
            "`parts`, atributos de furación/usinado y sistema de coordenadas.",
        ),
        Fuente(
            "tests/fixtures/cortecloud/escritorio_D_simple.json",
            "Muestra real saneada (escritorio D, 30 piezas) usada en las pruebas.",
        ),
    ),
    por_revisar=(
        "La guía oficial no declara la unidad de medida de las dimensiones: se "
        "asume milímetro (mm) según el proyecto.",
        "Leer `c` como largo y `l` como ancho proviene de los «lados C1/C2/L1/L2» "
        "del diagrama oficial; conviene confirmarlo con Cortecloud/Serrabits.",
        "El bloque `machining` se conserva tal cual (ida y vuelta) sin interpretar "
        "geometría ni validar cotas.",
    ),
    extensiones=(".json",),
)

CAMPOS_PIEZA = ("quantity", "c", "l", "function", "complement",
                "c1", "c2", "l1", "l2", "material")


def _cargar(texto: str) -> dict[str, Any]:
    try:
        datos = json.loads(texto)
    except json.JSONDecodeError as exc:
        raise ErrorFormato(f"JSON inválido: {exc}") from exc
    if not isinstance(datos, dict):
        raise ErrorFormato("el JSON de Cortecloud debe ser un objeto con clave `parts`")
    return datos


def _pieza_desde_json(bruto: dict[str, Any], indice: int) -> Pieza:
    faltantes = [campo for campo in ("c", "l") if bruto.get(campo) is None]
    if faltantes:
        raise ErrorFormato(f"pieza #{indice}: faltan campos obligatorios {faltantes}")
    nombre = bruto.get("function") or bruto.get("complement") or f"pieza {indice}"
    cantidad = bruto.get("quantity") or 1
    extra: dict[str, Any] = {}
    for campo in ("machining", "startSide"):
        if bruto.get(campo) is not None:
            extra[campo] = bruto[campo]
    return Pieza(
        nombre=str(nombre),
        largo=bruto["c"],
        ancho=bruto["l"],
        cantidad=cantidad,
        material=bruto.get("material"),
        cantos={
            "c1": bruto.get("c1"),
            "c2": bruto.get("c2"),
            "l1": bruto.get("l1"),
            "l2": bruto.get("l2"),
        },
        grupo=bruto.get("complement"),
        extra=extra,
    )


def importar(texto: str, **_: object) -> ListaCorte:
    """Lee un JSON de Cortecloud y devuelve una lista de corte."""
    datos = _cargar(texto)
    partes = datos.get("parts")
    if not isinstance(partes, list):
        raise ErrorFormato("el JSON debe tener una lista `parts`")
    lista = ListaCorte(metadatos={"formato": CLAVE})
    for indice, bruto in enumerate(partes, start=1):
        if not isinstance(bruto, dict):
            raise ErrorFormato(f"pieza #{indice}: se esperaba un objeto JSON")
        try:
            lista.agregar(_pieza_desde_json(bruto, indice))
        except ErrorDato as exc:
            raise ErrorFormato(f"pieza #{indice}: {exc}") from exc
    for campo in ("serviceId", "projectId", "board"):
        if datos.get(campo) is not None:
            lista.metadatos[campo] = datos[campo]
    return propagar_avisos(DESCRIPTOR, lista)


def _json_desde_pieza(pieza: Pieza) -> dict[str, Any]:
    cantos = pieza.cantos or {}
    bruto: dict[str, Any] = {
        "quantity": pieza.cantidad,
        "c": pieza.largo,
        "l": pieza.ancho,
        "function": pieza.nombre,
        "complement": pieza.grupo,
        "c1": cantos.get("c1"),
        "c2": cantos.get("c2"),
        "l1": cantos.get("l1"),
        "l2": cantos.get("l2"),
        "material": pieza.material,
    }
    for campo in ("machining", "startSide"):
        if pieza.extra.get(campo) is not None:
            bruto[campo] = pieza.extra[campo]
    return bruto


def exportar(lista: ListaCorte, *, sangria: int = 2, **_: object) -> str:
    """Escribe un JSON de Cortecloud con las piezas de ``lista``."""
    documento = {"parts": [_json_desde_pieza(p) for p in lista.piezas]}
    return json.dumps(documento, ensure_ascii=False, indent=sangria) + "\n"
