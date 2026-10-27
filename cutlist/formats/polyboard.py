"""PolyBoard (Wood Designer) — importación de la lista de corte CSV/TXT.

Documentación pública consultada:

- Exportación de la lista de corte: https://wooddesigner.org/help-centre/polyboard-cutting-list-export/
- Formateo de listas para otras aplicaciones: https://wooddesigner.org/formating-cutting-lists-for-other-applications/

Verificado en la documentación: la lista de corte se exporta a ``.csv`` o
``.txt`` desde *Cutting list menu > CSV/TXT export*, y los campos, su orden, el
separador y los decimales se configuran en *Cutting list options > Format*
(la captura de la documentación muestra ``;`` seleccionado).

No verificado: el conjunto y orden de columnas por defecto, el separador decimal
por defecto y el efecto de las opciones *Overall vs net dimensions*, *Including
oversizing* y *Grouped vs individual* sobre el archivo. Por eso el importador
exige declarar las columnas (``columnas=...``) y, si no se declaran, usa un orden
por defecto marcado «por revisar».

No se implementa exportación: PolyBoard no documenta importar listas de corte
externas (importa modelos DXF/3DS).
"""

from __future__ import annotations

from ..model import ErrorDato, Fuente, ListaCorte, PARCIAL
from .base import (
    DIRECCION_IMPORT,
    DescriptorFormato,
    ErrorFormato,
    leer_tabla,
    propagar_avisos,
)
from .listado import columnas_desde_encabezado, leer_piezas, normalizar_columnas

CLAVE = "polyboard"

# Orden asumido mientras no se verifique con un archivo real (ver por_revisar).
COLUMNAS_POR_DEFECTO = ("nombre", "largo", "ancho", "cantidad", "espesor", "material")

DESCRIPTOR = DescriptorFormato(
    clave=CLAVE,
    nombre="PolyBoard (lista de corte CSV/TXT)",
    direccion=DIRECCION_IMPORT,
    estado=PARCIAL,
    fuentes=(
        Fuente(
            "https://wooddesigner.org/help-centre/polyboard-cutting-list-export/",
            "Wood Designer: exportación de la lista de corte a CSV/TXT y opciones de "
            "formato (campos, orden, separador).",
        ),
        Fuente(
            "https://wooddesigner.org/formating-cutting-lists-for-other-applications/",
            "Wood Designer: 2 vías de salida (ASCII y PP Report) para otras "
            "aplicaciones.",
        ),
    ),
    por_revisar=(
        "No hay conjunto ni orden de columnas por defecto publicados: sin "
        "`columnas=` el importador usa " + ", ".join(COLUMNAS_POR_DEFECTO) +
        " (orden asumido).",
        "Se asume separador «;» (la captura oficial muestra «;») y decimal coma; "
        "ambos son configurables en PolyBoard.",
        "Según las opciones *Overall vs net dimensions*, *Including oversizing* y "
        "*Grouped vs individual*, las cotas pueden ser brutas o netas y las piezas "
        "idénticas pueden venir agrupadas o sueltas; no está verificado cuál es la "
        "salida por defecto.",
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
    """Lee un listado de PolyBoard declarando el orden de las columnas."""
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
                    " (PolyBoard permite configurar campos y orden).",
                    fuente=DESCRIPTOR.fuentes[0].url,
                )
            else:
                campos = normalizar_columnas(columnas)
            datos = filas
        piezas = leer_piezas(datos, campos, decimal=decimal)
    except ErrorDato as exc:
        raise ErrorFormato(f"listado de PolyBoard: {exc}") from exc
    for pieza in piezas:
        lista.agregar(pieza)
    return propagar_avisos(DESCRIPTOR, lista)
