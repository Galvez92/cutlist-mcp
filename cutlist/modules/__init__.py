"""Registro de módulos paramétricos: cajonera, clóset, cocina y librero."""

from __future__ import annotations

import json
from dataclasses import dataclass, fields
from typing import Any, Callable

from cutlist.modulo import Modulo
from cutlist.modules.cajonera import CAMPOS as CAMPOS_CAJONERA
from cutlist.modules.cajonera import ParamsCajonera, generar as generar_cajonera
from cutlist.modules.closet import CAMPOS as CAMPOS_CLOSET
from cutlist.modules.closet import ParamsCloset, generar as generar_closet
from cutlist.modules.cocina import CAMPOS as CAMPOS_COCINA
from cutlist.modules.cocina import ParamsCocina, generar as generar_cocina
from cutlist.modules.librero import CAMPOS as CAMPOS_LIBRERO
from cutlist.modules.librero import ParamsLibrero, generar as generar_librero


@dataclass(frozen=True)
class ModuloRegistrado:
    """Un tipo de módulo: título, parámetros y generador."""

    tipo: str
    titulo: str
    descripcion: str
    params: type
    generar: Callable[[Any], Modulo]
    campos: dict[str, str]

    def campos_ui(self) -> list[dict]:
        """Parámetros con tipo, valor por omisión y descripción (para la vista previa)."""
        lista = []
        for campo in fields(self.params):
            anotacion = str(campo.type)
            default = campo.default
            lista.append(
                {
                    "nombre": campo.name,
                    "anotacion": anotacion,
                    "tipo": _tipo_simple(anotacion),
                    "default": list(default) if isinstance(default, tuple) else default,
                    "descripcion": self.campos.get(campo.name, ""),
                }
            )
        return lista


def _tipo_simple(anotacion: str) -> str:
    if "tuple" in anotacion:
        return "lista"
    if "bool" in anotacion:
        return "bool"
    if anotacion == "int":
        return "int"
    if "float" in anotacion:
        return "float_opcional" if "None" in anotacion else "float"
    return "texto"


def _coercionar(valor: Any, anotacion: str) -> Any:
    """Convierte un valor de texto o JSON al tipo del parámetro."""
    if isinstance(valor, str):
        texto = valor.strip()
        if texto[:1] == texto[-1:] and texto[:1] in ("'", '"'):
            texto = texto[1:-1]
        if "tuple" in anotacion:
            if texto.lower() in ("", "none", "null", "sin", "ninguno"):
                return None
            return tuple(float(v) for v in json.loads(texto))
        if "bool" in anotacion:
            return texto.lower() in ("1", "true", "si", "sí", "verdadero", "yes")
        if "None" in anotacion:
            if texto.lower() in ("", "none", "null", "sin", "ninguno"):
                return None
            return float(texto)
        if "float" in anotacion:
            return float(texto)
        if anotacion == "int":
            return int(float(texto))
        return texto
    if valor is None:
        return None
    if "tuple" in anotacion:
        return tuple(float(v) for v in valor)
    if "bool" in anotacion:
        return bool(valor)
    if "float" in anotacion:
        return float(valor)
    if anotacion == "int":
        return int(valor)
    return str(valor)


def construir_params(registro: ModuloRegistrado, valores: dict) -> Any:
    """Crea el dataclass de parámetros de un módulo, validando nombres y tipos."""
    validos = {campo.name: str(campo.type) for campo in fields(registro.params)}
    desconocidos = sorted(set(valores) - set(validos))
    if desconocidos:
        raise ValueError(
            f"parámetro(s) desconocido(s) para {registro.tipo}: {desconocidos}. "
            f"Válidos: {sorted(validos)}"
        )
    convertidos = {
        nombre: _coercionar(valor, validos[nombre])
        for nombre, valor in valores.items()
        if valor is not None or "None" in validos[nombre]
    }
    return registro.params(**convertidos)


def generar_modulo(tipo: str, valores: dict) -> Modulo:
    """Genera un módulo a partir de valores sueltos (JSON o texto)."""
    registro = obtener(tipo)
    return registro.generar(construir_params(registro, valores))


def obtener(tipo: str) -> ModuloRegistrado:
    clave = tipo.strip().lower()
    if clave not in MODULOS:
        raise ValueError(f"módulo desconocido: {tipo!r}; disponibles: {sorted(MODULOS)}")
    return MODULOS[clave]


CAJONERA = ModuloRegistrado(
    tipo="cajonera",
    titulo="Cajonera",
    descripcion="Torre de cajones con frentes cubrientes.",
    params=ParamsCajonera,
    generar=generar_cajonera,
    campos=CAMPOS_CAJONERA,
)
CLOSET = ModuloRegistrado(
    tipo="closet",
    titulo="Clóset",
    descripcion="Armario con repisas, barral y puertas batientes o correderas.",
    params=ParamsCloset,
    generar=generar_closet,
    campos=CAMPOS_CLOSET,
)
COCINA = ModuloRegistrado(
    tipo="cocina",
    titulo="Mueble bajo de cocina",
    descripcion="Bajo mesada con zócalo, puertas o cajones (medidas de ARAUCO #17).",
    params=ParamsCocina,
    generar=generar_cocina,
    campos=CAMPOS_COCINA,
)
LIBRERO = ModuloRegistrado(
    tipo="librero",
    titulo="Librero",
    descripcion="Estantería con tapa y base entre costados y repisas.",
    params=ParamsLibrero,
    generar=generar_librero,
    campos=CAMPOS_LIBRERO,
)

MODULOS = {registro.tipo: registro for registro in (CAJONERA, CLOSET, COCINA, LIBRERO)}

#: Alias aceptados al nombrar un módulo en texto libre.
ALIAS = {
    "cajonera": "cajonera",
    "cajonero": "cajonera",
    "closet": "closet",
    "clóset": "closet",
    "placard": "closet",
    "ropero": "closet",
    "cocina": "cocina",
    "bajo mesada": "cocina",
    "bajomesada": "cocina",
    "mueble bajo": "cocina",
    "librero": "librero",
    "biblioteca": "librero",
    "estanteria": "librero",
    "estantería": "librero",
}

__all__ = [
    "ALIAS",
    "CAJONERA",
    "CLOSET",
    "COCINA",
    "LIBRERO",
    "MODULOS",
    "ModuloRegistrado",
    "construir_params",
    "generar_modulo",
    "obtener",
]
