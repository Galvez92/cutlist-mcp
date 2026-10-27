"""Promob — importación del listado de piezas (TXT/CSV).

Documentación pública consultada:

- Exportar el orçamento/listagem a otros sistemas:
  https://suporte.promob.com/hc/pt-br/articles/31120346591505-KB-Promob-Como-exportar-dados-do-or%C3%A7amento-para-outros-softwares
  (herramienta *Enviar para*: e-mail, *Arquivos* → XML o TXT, *Planos de Corte*).
- Integración de Cut Pro con optimizadores de corte:
  https://suporte.promob.com/hc/pt-br/articles/31117846533905-Cut-Pro-Configura%C3%A7%C3%B5es-de-Otimizadores-de-Corte
  (el archivo de integración es ``*.csv``; el usuario configura **separador**,
  **separador decimal**, **unidad de medida**, **crear cabecera**, **un solo
  archivo**, columnas y su orden, por optimizador).
- Ejemplo de integración de terceros (Cut Planning) que confirma las dos salidas:
  https://cutplanning.tawk.help/article/promob-plus

Verificado: Promob exporta la listagem como **XML** o **TXT**, y su módulo Cut Pro
genera un **CSV** para optimizadores con separador, decimal, unidad y cabecera
configurables por el usuario.

No verificado (por eso el formato queda «por revisar»): el esquema del XML de
listagem y el orden/columnas por defecto del CSV de cada optimizador (son
configurables, no hay lista publicada). El importador exige declarar las columnas
y, si no se declaran, usa un orden por defecto marcado «por revisar».

No se implementa un importador de XML de Promob: su estructura no está publicada;
queda pendiente hasta contar con una muestra real.
"""

from __future__ import annotations

from ..model import ErrorDato, Fuente, ListaCorte, Pieza, POR_REVISAR
from .base import (
    DIRECCION_IMPORT,
    DescriptorFormato,
    ErrorFormato,
    leer_tabla,
    propagar_avisos,
)
from .listado import columnas_desde_encabezado, leer_piezas, normalizar_columnas

CLAVE = "promob"

COLUMNAS_POR_DEFECTO = (
    "nombre", "cantidad", "largo", "ancho", "espesor", "material",
    "grupo", "veta", "canto_c1", "canto_c2", "canto_l1", "canto_l2",
)

DESCRIPTOR = DescriptorFormato(
    clave=CLAVE,
    nombre="Promob (listado TXT/CSV)",
    direccion=DIRECCION_IMPORT,
    estado=POR_REVISAR,
    fuentes=(
        Fuente(
            "https://suporte.promob.com/hc/pt-br/articles/31120346591505-KB-Promob-Como-exportar-dados-do-or%C3%A7amento-para-outros-softwares",
            "Promob: «Enviar para» exporta a XML/TXT y a sistemas de plano de corte.",
        ),
        Fuente(
            "https://suporte.promob.com/hc/pt-br/articles/31117846533905-Cut-Pro-Configura%C3%A7%C3%B5es-de-Otimizadores-de-Corte",
            "Promob Cut Pro: el archivo de integración es CSV y el separador, "
            "separador decimal, unidad de medida, cabecera y columnas los configura "
            "el usuario por optimizador.",
        ),
        Fuente(
            "https://cutplanning.tawk.help/article/promob-plus",
            "Ejemplo real de integración de un optimizador (Cut Planning) que "
            "importa la listagem XML o TXT de Promob.",
        ),
    ),
    por_revisar=(
        "El esquema del XML de listagem de Promob no está publicado: el importador "
        "XML queda pendiente hasta tener una muestra real.",
        "Las columnas y su orden en el CSV de integración los define el usuario en "
        "el Configurador de Cut Pro; sin `columnas=` se asume el orden " +
        ", ".join(COLUMNAS_POR_DEFECTO) + ".",
        "Separador, separador decimal (por defecto se asume «;» y coma) y unidad de "
        "medida son configurables en Promob y deben declararse si difieren.",
        "No está verificado que Promob importe listas de corte externas, así que no "
        "se implementa exportación hacia Promob.",
    ),
    extensiones=(".csv", ".txt"),
)


def importar(
    texto: str,
    *,
    columnas: tuple[str, ...] | list[str] | None = None,
    encabezado: bool = False,
    separador: str | None = None,
    decimal: str | None = None,
    **_: object,
) -> ListaCorte:
    """Lee el listado de piezas exportado por Promob (columnas declaradas)."""
    filas = leer_tabla(texto, separador)
    if not filas:
        raise ErrorFormato("el listado está vacío")
    lista = ListaCorte(metadatos={"formato": CLAVE, "separador": separador or "auto"})
    try:
        if encabezado:
            campos = columnas_desde_encabezado(filas[0])
            datos = filas[1:]
        else:
            if columnas is None:
                campos = normalizar_columnas(COLUMNAS_POR_DEFECTO)
                lista.avisar(
                    "Columnas declaradas por defecto " + ", ".join(campos) +
                    " (en Promob se configuran por optimizador).",
                    fuente=DESCRIPTOR.fuentes[1].url,
                )
            else:
                campos = normalizar_columnas(columnas)
            datos = filas
        piezas: list[Pieza] = leer_piezas(datos, campos, decimal=decimal)
    except ErrorDato as exc:
        raise ErrorFormato(f"listado de Promob: {exc}") from exc
    for pieza in piezas:
        lista.agregar(pieza)
    return propagar_avisos(DESCRIPTOR, lista)
