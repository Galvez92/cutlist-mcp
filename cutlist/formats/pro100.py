"""PRO100 — importación del listado de piezas (TXT/CSV).

Documentación pública consultada:

- Exportación a CutList Plus: https://cutlistplus.com/Support/CAD/Pro100
  (PRO100 exporta la lista de piezas como CSV; el propio CutList Plus advierte que
  «no especifica el tipo de material de cada pieza» y remite al soporte de PRO100
  para los pasos de exportación).
- PRO100: «Отчёты и расчёты» guarda el listado de piezas en un archivo de texto
  (guía de usuario en ruso):
  https://sovetpro100.blogspot.com/2016/06/export-spiska-detaley-iz-programmi-pro100-v-raskroy-kuznetsova.html

Verificado: PRO100 exporta un listado de piezas en texto/CSV legible por otras
aplicaciones, y ese listado **no** incluye el tipo de material de cada pieza
(según CutList Plus).

No verificado: nombres de columna, orden, separador y decimales del archivo
exportado (no hay especificación pública; la guía de PRO100 se refiere a la
interfaz, no al layout del archivo). El importador exige declarar las columnas y,
si no se declaran, usa un orden por defecto marcado «por revisar».

No se implementa exportación: PRO100 no documenta importar listas de corte
externas.
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

CLAVE = "pro100"

COLUMNAS_POR_DEFECTO = ("nombre", "cantidad", "largo", "ancho", "espesor")

DESCRIPTOR = DescriptorFormato(
    clave=CLAVE,
    nombre="PRO100 (listado TXT/CSV)",
    direccion=DIRECCION_IMPORT,
    estado=POR_REVISAR,
    fuentes=(
        Fuente(
            "https://cutlistplus.com/Support/CAD/Pro100",
            "CutList Plus: PRO100 exporta la lista de piezas como CSV y ese archivo "
            "no especifica el tipo de material de cada pieza.",
        ),
        Fuente(
            "https://sovetpro100.blogspot.com/2016/06/export-spiska-detaley-iz-programmi-pro100-v-raskroy-kuznetsova.html",
            "Guía de usuario (ru): «Отчёты и расчёты» guarda el listado de piezas en "
            "un archivo de texto que otra aplicación puede leer.",
        ),
    ),
    por_revisar=(
        "El layout del listado exportado (nombres de columna, orden, separador) no "
        "está publicado: sin `columnas=` se asume el orden " +
        ", ".join(COLUMNAS_POR_DEFECTO) + ".",
        "El archivo de PRO100 no incluye el tipo de material de cada pieza "
        "(limitación documentada por CutList Plus): el material debe completarse "
        "aparte si el listado no lo trae.",
        "El archivo de proyecto .pro100 es propietario y no se lee; el camino "
        "soportado es el listado exportado.",
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
    """Lee el listado de piezas exportado por PRO100 (columnas declaradas)."""
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
                    " (layout del archivo PRO100 no publicado).",
                    fuente=DESCRIPTOR.fuentes[0].url,
                )
            else:
                campos = normalizar_columnas(columnas)
            datos = filas
        piezas: list[Pieza] = leer_piezas(datos, campos, decimal=decimal)
    except ErrorDato as exc:
        raise ErrorFormato(f"listado de PRO100: {exc}") from exc
    for pieza in piezas:
        lista.agregar(pieza)
    return propagar_avisos(DESCRIPTOR, lista)
