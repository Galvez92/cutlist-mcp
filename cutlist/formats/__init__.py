"""Registro de formatos de importación/exportación.

Cada formato declara su dirección, su estado de verificación y las fuentes
públicas consultadas. Los datos no verificados viajan con la lista de corte como
avisos «por revisar» (ver :mod:`cutlist.model`).
"""

from __future__ import annotations

from pathlib import Path
from typing import Any

from ..model import Aviso, ListaCorte, POR_REVISAR
from . import cortecloud, csv_generico, dxf, opencutlist, polyboard, pro100, promob
from .base import DescriptorFormato, ErrorFormato

_MODULOS = (cortecloud, dxf, csv_generico, opencutlist, polyboard, pro100, promob)

FORMATOS: dict[str, DescriptorFormato] = {
    modulo.DESCRIPTOR.clave: modulo.DESCRIPTOR for modulo in _MODULOS
}
_MODULO_POR_CLAVE = {modulo.DESCRIPTOR.clave: modulo for modulo in _MODULOS}

__all__ = [
    "FORMATOS",
    "DescriptorFormato",
    "ErrorFormato",
    "descriptor",
    "exportar",
    "exportar_archivo",
    "formato_para_extension",
    "importar",
    "importar_archivo",
    "listar_formatos",
    "por_revisar",
]


def listar_formatos() -> tuple[DescriptorFormato, ...]:
    """Todos los formatos, con su estado y fuentes."""
    return tuple(FORMATOS[clave] for clave in claves())


def claves() -> tuple[str, ...]:
    return tuple(modulo.DESCRIPTOR.clave for modulo in _MODULOS)


def descriptor(clave: str) -> DescriptorFormato:
    try:
        return FORMATOS[clave]
    except KeyError as exc:
        raise ErrorFormato(
            f"formato desconocido: {clave!r}. Disponibles: {list(FORMATOS)}"
        ) from exc


def importar(texto: str, formato: str, **opciones: Any) -> ListaCorte:
    """Importa ``texto`` con el formato indicado."""
    modulo = _modulo(formato)
    if not descriptor(formato).permite_importar:
        raise ErrorFormato(f"el formato {formato!r} no tiene importador")
    return modulo.importar(texto, **opciones)


def exportar(objeto: Any, formato: str, **opciones: Any) -> str:
    """Exporta una lista de corte (o un layout, en DXF) al formato indicado."""
    modulo = _modulo(formato)
    if not descriptor(formato).permite_exportar:
        raise ErrorFormato(f"el formato {formato!r} no tiene exportador")
    return modulo.exportar(objeto, **opciones)


def formato_para_extension(ruta: str | Path) -> str | None:
    """Deduce el formato por la extensión del archivo.

    ``.csv`` y ``.txt`` los comparten varios formatos (CSV genérico, OpenCutList,
    PolyBoard, Promob, PRO100): aquí se devuelve el CSV genérico, así que para
    listados de esos programas hay que pasar ``formato=`` explícito.
    """
    sufijo = Path(ruta).suffix.lower()
    for modulo in _MODULOS:
        if sufijo in modulo.DESCRIPTOR.extensiones:
            return modulo.DESCRIPTOR.clave
    return None


def importar_archivo(
    ruta: str | Path, formato: str | None = None, **opciones: Any
) -> ListaCorte:
    """Lee un archivo del disco y lo importa (UTF-8, tolera BOM)."""
    clave = formato or formato_para_extension(ruta)
    if clave is None:
        raise ErrorFormato(f"no se pudo deducir el formato de {ruta!r}")
    texto = Path(ruta).read_text(encoding="utf-8-sig")
    return importar(texto, clave, **opciones)


def exportar_archivo(
    objeto: Any, ruta: str | Path, formato: str | None = None, **opciones: Any
) -> str:
    """Exporta y escribe el resultado en ``ruta`` (UTF-8)."""
    clave = formato or formato_para_extension(ruta)
    if clave is None:
        raise ErrorFormato(f"no se pudo deducir el formato de {ruta!r}")
    texto = exportar(objeto, clave, **opciones)
    Path(ruta).write_text(texto, encoding="utf-8")
    return texto


def por_revisar() -> dict[str, tuple[Aviso, ...]]:
    """Formatos con datos sin verificar, listos para mostrar al usuario."""
    return {
        clave: tuple(FORMATOS[clave].avisos())
        for clave in claves()
        if FORMATOS[clave].estado == POR_REVISAR
    }


def _modulo(clave: str) -> Any:
    try:
        return _MODULO_POR_CLAVE[clave]
    except KeyError as exc:
        raise ErrorFormato(
            f"formato desconocido: {clave!r}. Disponibles: {list(_MODULO_POR_CLAVE)}"
        ) from exc
