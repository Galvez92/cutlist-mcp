"""Convierte una idea escrita a un módulo: ``"cajonera ancho=450 cajones=3"``.

Sintaxis (propia de esta herramienta, no es un formato de intercambio):
``tipo clave=valor clave=valor`` con el tipo entre los alias de
`cutlist.modules.ALIAS`. Los valores numéricos aceptan unidades en mm; las listas
van en JSON (``posiciones_repisas=[500,1000]`` o ``alturas_frente="[110,180]"``);
las cadenas con espacios se entrecomillan (``nombre="Clóset pieza 2"``).
"""

from __future__ import annotations

from typing import Any

from cutlist.modulo import Modulo
from cutlist.modules import ALIAS, MODULOS, construir_params, obtener


def parsear(texto: str) -> tuple[str, dict[str, Any]]:
    """Separa el texto en ``(tipo, valores)`` sin construir el módulo."""
    if not texto or not texto.strip():
        raise ValueError("no se escribió ninguna idea")
    partes = texto.split()
    crudo = partes[0].strip().lower()
    # Algunos alias llevan espacio ("bajo mesada", "mueble bajo").
    dos_palabras = " ".join(partes[:2]).lower() if len(partes) > 1 else ""
    if dos_palabras in ALIAS:
        tipo = ALIAS[dos_palabras]
        resto = partes[2:]
    else:
        tipo = ALIAS.get(crudo, crudo)
        resto = partes[1:]
    if tipo not in MODULOS:
        raise ValueError(
            f"módulo desconocido: {crudo!r}; disponibles: {sorted(MODULOS)} "
            f"(alias: {sorted(ALIAS)})"
        )

    valores: dict[str, Any] = {}
    cadenas = list(resto)
    for trozo in _separar_en_pares(cadenas):
        if "=" not in trozo and ":" not in trozo:
            raise ValueError(
                f"parámetro sin valor: {trozo!r}; use clave=valor (ej. ancho=450)"
            )
        separador = "=" if "=" in trozo else ":"
        clave, valor = trozo.split(separador, 1)
        clave = clave.strip()
        if not clave:
            raise ValueError(f"parámetro sin nombre: {trozo!r}")
        if clave in valores:
            raise ValueError(f"parámetro repetido: {clave}")
        valores[clave] = valor.strip()
    return (tipo, valores)


def _separar_en_pares(trozos: list[str]) -> list[str]:
    """Vuelve a unir los trozos que quedan dentro de comillas o corchetes."""
    pares: list[str] = []
    actual = ""
    profundidad = 0
    comillas: str | None = None
    for trozo in trozos:
        if actual:
            actual += " "
        actual += trozo
        for caracter in trozo:
            if comillas:
                if caracter == comillas:
                    comillas = None
            elif caracter in ("'", '"'):
                comillas = caracter
            elif caracter in "[(":
                profundidad += 1
            elif caracter in "])":
                profundidad -= 1
        if comillas is None and profundidad <= 0 and ("=" in actual or ":" in actual):
            pares.append(actual)
            actual = ""
            profundidad = 0
    if actual:
        pares.append(actual)
    return pares


def construir(tipo: str, valores: dict[str, Any]) -> Modulo:
    """Genera el módulo validando parámetros contra el registro."""
    registro = obtener(tipo)
    return registro.generar(construir_params(registro, valores))


def construir_desde_texto(texto: str) -> Modulo:
    """Atajo: idea escrita -> módulo."""
    tipo, valores = parsear(texto)
    return construir(tipo, valores)
