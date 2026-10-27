"""Contrato común de los importadores/exportadores y utilidades de tabla.

Todo módulo de formato expone:

- ``DESCRIPTOR``: :class:`DescriptorFormato` con el estado de verificación y las
  fuentes públicas consultadas.
- ``importar(texto, **opciones) -> ListaCorte`` (si el formato se puede leer).
- ``exportar(lista, **opciones) -> str`` (si el formato se puede escribir).

Regla del proyecto: ningún formato se inventa. Lo que no se pudo verificar en
documentación pública se declara en ``DescriptorFormato.por_revisar`` y se
propaga a la :class:`~cutlist.model.ListaCorte` como :class:`Aviso`.
"""

from __future__ import annotations

import csv
import io
import re
from dataclasses import dataclass

from ..model import Aviso, ErrorDato, Fuente, ListaCorte

DIRECCION_IMPORT = "import"
DIRECCION_EXPORT = "export"
DIRECCION_AMBOS = "ambos"


class ErrorFormato(ErrorDato):
    """El contenido no corresponde al formato esperado."""


@dataclass(frozen=True)
class DescriptorFormato:
    """Metadatos de un formato: dirección, estado de verificación y fuentes."""

    clave: str
    nombre: str
    direccion: str
    estado: str
    fuentes: tuple[Fuente, ...]
    por_revisar: tuple[str, ...] = ()
    extensiones: tuple[str, ...] = ()

    def avisos(self) -> list[Aviso]:
        """Avisos «por revisar» que acompañan a todo dato leído de este formato."""
        fuente = self.fuentes[0].url if self.fuentes else None
        return [Aviso(mensaje=m, fuente=fuente) for m in self.por_revisar]

    @property
    def permite_importar(self) -> bool:
        return self.direccion in (DIRECCION_IMPORT, DIRECCION_AMBOS)

    @property
    def permite_exportar(self) -> bool:
        return self.direccion in (DIRECCION_EXPORT, DIRECCION_AMBOS)


# --------------------------------------------------------------------------- #
# Alias de columnas (es / en / pt)
# --------------------------------------------------------------------------- #

ALIAS_CAMPOS: dict[str, tuple[str, ...]] = {
    "nombre": (
        "nombre", "nome", "name", "designation", "designacion", "designacao",
        "pieza", "part", "descripcion", "description", "funcion", "function",
        "item", "componente", "component",
    ),
    "largo": ("largo", "largo_mm", "length", "longitud", "comprimento", "compr", "long"),
    "ancho": ("ancho", "ancho_mm", "width", "largura", "anchura"),
    "cantidad": (
        "cantidad", "quantity", "qty", "cant", "quantidade", "qtde", "pcs",
        "piezas", "count",
    ),
    "espesor": ("espesor", "espesor_mm", "thickness", "espessura", "thick"),
    "material": ("material", "material_name", "materialname", "mat"),
    "veta": ("veta", "grain", "veio", "grain_direction", "sentido"),
    "grupo": (
        "grupo", "complement", "complemento", "modulo", "module", "movel",
        "cabinet", "ambiente",
    ),
    "notas": ("notas", "notes", "observaciones", "obs", "observacao"),
    "etiqueta": ("etiqueta", "tags", "tag", "labels", "label"),
    "canto_c1": ("canto_c1", "canto1", "edge_c1", "edge1", "c1", "borde_c1"),
    "canto_c2": ("canto_c2", "canto2", "edge_c2", "edge2", "c2", "borde_c2"),
    "canto_l1": ("canto_l1", "edge_l1", "l1", "borde_l1"),
    "canto_l2": ("canto_l2", "edge_l2", "l2", "borde_l2"),
}


def normalizar_nombre(texto: str) -> str:
    """Minúsculas, sin acentos ni signos, para comparar encabezados."""
    texto = str(texto).strip().lower()
    reemplazos = {"á": "a", "é": "e", "í": "i", "ó": "o", "ú": "u", "ü": "u",
                  "à": "a", "â": "a", "ã": "a", "ç": "c", "ñ": "n", "ê": "e",
                  "ô": "o", "õ": "o"}
    for origen, destino in reemplazos.items():
        texto = texto.replace(origen, destino)
    texto = re.sub(r"[^a-z0-9]+", "_", texto)
    return texto.strip("_")


def mapear_columnas(encabezados: list[str]) -> dict[str, int]:
    """Devuelve ``{campo_canónico: índice}`` a partir de los encabezados."""
    alias_inverso = {a: campo for campo, alias in ALIAS_CAMPOS.items() for a in alias}
    mapa: dict[str, int] = {}
    for indice, encabezado in enumerate(encabezados):
        campo = alias_inverso.get(normalizar_nombre(encabezado))
        if campo and campo not in mapa:
            mapa[campo] = indice
    return mapa


# --------------------------------------------------------------------------- #
# Conversión de valores
# --------------------------------------------------------------------------- #

_NUMERO_RE = re.compile(r"[-+]?\d[\d\s\u00a0.,]*")


def _inferir_decimal(texto: str) -> str:
    if "," in texto and "." in texto:
        return "," if texto.rfind(",") > texto.rfind(".") else "."
    return "," if "," in texto else "."


def a_numero(valor: object, decimal: str | None = None) -> float:
    """Convierte a float aceptando ``1.234,56`` / ``1,234.56`` / ``732 mm``."""
    if isinstance(valor, bool):
        raise ErrorDato(f"no es un número: {valor!r}")
    if isinstance(valor, (int, float)):
        return float(valor)
    if valor is None:
        raise ErrorDato("falta un valor numérico")
    texto = str(valor).strip()
    if not texto:
        raise ErrorDato("falta un valor numérico")
    coincidencia = _NUMERO_RE.search(texto)
    if not coincidencia:
        raise ErrorDato(f"no es un número: {valor!r}")
    limpio = coincidencia.group(0).replace("\u00a0", "").replace(" ", "")
    separador = decimal or _inferir_decimal(limpio)
    if separador == ",":
        limpio = limpio.replace(".", "").replace(",", ".")
    else:
        limpio = limpio.replace(",", "")
    try:
        return float(limpio)
    except ValueError as exc:  # pragma: no cover - defensivo
        raise ErrorDato(f"no es un número: {valor!r}") from exc


def a_numero_opcional(valor: object, decimal: str | None = None) -> float | None:
    if valor is None or str(valor).strip() == "":
        return None
    return a_numero(valor, decimal=decimal)


def a_entero(valor: object, decimal: str | None = None, defecto: int = 1) -> int:
    if valor is None or str(valor).strip() == "":
        return defecto
    numero = a_numero(valor, decimal=decimal)
    if numero < 1:
        raise ErrorDato(f"cantidad inválida: {valor!r}")
    return int(round(numero))


_TRUE = {"1", "si", "sí", "s", "true", "t", "yes", "y", "x", "con", "sim"}
_FALSE = {"0", "no", "n", "false", "f", "sin", "nao", "não"}


def a_booleano(valor: object) -> bool | None:
    if valor is None:
        return None
    texto = normalizar_nombre(str(valor))
    if not texto:
        return None
    if texto in _TRUE:
        return True
    if texto in _FALSE:
        return False
    return None


def formatear_numero(valor: float | int | None, decimal: str = ".") -> str:
    if valor is None:
        return ""
    numero = float(valor)
    if numero == int(numero):
        texto = str(int(numero))
    else:
        texto = repr(round(numero, 4)).rstrip("0").rstrip(".")
    return texto.replace(".", decimal) if decimal == "," else texto


# --------------------------------------------------------------------------- #
# Lectura y escritura de tablas
# --------------------------------------------------------------------------- #

SEPARADORES = (";", ",", "\t", "|")


def detectar_separador(texto: str, por_defecto: str = ";") -> str:
    """Elige el separador más probable en la primera línea con contenido."""
    for linea in texto.splitlines():
        if not linea.strip():
            continue
        conteos = {s: linea.count(s) for s in SEPARADORES}
        mejor = max(conteos, key=lambda s: conteos[s])
        if conteos[mejor] > 0:
            return mejor
        if len(linea.split()) > 1:
            return " "
        return por_defecto
    return por_defecto


def leer_tabla(
    texto: str,
    separador: str | None = None,
    *,
    ignorar_comentarios: bool = True,
) -> list[list[str]]:
    """Lee un texto delimitado y devuelve filas de celdas (sin líneas vacías)."""
    separador = separador or detectar_separador(texto)
    lineas = [
        linea for linea in texto.splitlines()
        if linea.strip() and not (ignorar_comentarios and linea.lstrip().startswith("#"))
    ]
    if separador == " ":
        return [linea.split() for linea in lineas]
    lector = csv.reader(io.StringIO("\n".join(lineas)), delimiter=separador,
                        quotechar='"', skipinitialspace=True)
    return [[celda.strip() for celda in fila] for fila in lector if fila]


def celda(fila: list[str], indice: int | None, defecto: str | None = None) -> str | None:
    """Devuelve la celda ``indice`` de ``fila`` o ``defecto`` si no existe."""
    if indice is None or indice >= len(fila):
        return defecto
    valor = fila[indice].strip()
    return valor or defecto


def escribir_tabla(
    encabezados: list[str],
    filas: list[list[str]],
    separador: str = ";",
    *,
    fin_linea: str = "\r\n",
) -> str:
    """Escribe una tabla delimitada, con encabezado, terminación configurable."""
    salida = io.StringIO()
    escritor = csv.writer(salida, delimiter=separador, lineterminator=fin_linea,
                          quoting=csv.QUOTE_MINIMAL)
    if encabezados:
        escritor.writerow(encabezados)
    for fila in filas:
        escritor.writerow(fila)
    return salida.getvalue()


def propagar_avisos(descriptor: DescriptorFormato, lista: ListaCorte) -> ListaCorte:
    """Marca la lista con los «por revisar» del formato y con su origen."""
    lista.origen = descriptor.clave
    lista.avisos.extend(descriptor.avisos())
    return lista
