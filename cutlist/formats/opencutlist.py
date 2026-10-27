"""OpenCutList (SketchUp) — CSV de piezas (importación y exportación).

Documentación pública consultada:

- Exportar a CSV: https://docs.opencutlist.org/features/parts/export-to-csv
- Columnas y fórmulas: https://docs.opencutlist.org/features/parts/export-to-csv/customization
- Importar CSV: https://docs.opencutlist.org/features/import

Verificado en la documentación:

- El separador puede ser tabulador, coma o punto y coma; la codificación UTF-8.
- Al importar, los campos obligatorios son *Designation, Length, Width,
  Thickness*; *Quantity*, *Material* y *Tags* son opcionales y sin columna de
  cantidad se asume 1.
- Sin unidad, las dimensiones se interpretan en las unidades del modelo.

No verificado: los títulos nativos de columna de una exportación real (son
configurables y traducibles) y el uso de unidades dentro del archivo.
"""

from __future__ import annotations

from ..model import Fuente, ListaCorte, PARCIAL, Pieza
from .base import (
    DIRECCION_AMBOS,
    DescriptorFormato,
    ErrorFormato,
    a_entero,
    a_numero,
    a_numero_opcional,
    celda,
    escribir_tabla,
    formatear_numero,
    leer_tabla,
    mapear_columnas,
    propagar_avisos,
)

CLAVE = "opencutlist"

ENCABEZADOS_SALIDA = ("Designation", "Length", "Width", "Thickness",
                      "Quantity", "Material", "Tags")

OBLIGATORIOS = ("nombre", "largo", "ancho", "espesor")

DESCRIPTOR = DescriptorFormato(
    clave=CLAVE,
    nombre="SketchUp / OpenCutList (CSV)",
    direccion=DIRECCION_AMBOS,
    estado=PARCIAL,
    fuentes=(
        Fuente(
            "https://docs.opencutlist.org/features/parts/export-to-csv",
            "Documentación de OpenCutList: exportación a CSV/XLSX, separadores y "
            "codificación.",
        ),
        Fuente(
            "https://docs.opencutlist.org/features/import",
            "Documentación de OpenCutList: importación CSV, campos obligatorios "
            "(Designation, Length, Width, Thickness) y opcionales.",
        ),
        Fuente(
            "https://docs.opencutlist.org/features/parts/export-to-csv/customization",
            "Columnas nativas, fórmulas y orden configurable; los títulos son "
            "editables por el usuario.",
        ),
    ),
    por_revisar=(
        "Los títulos de columna de una exportación real son configurables y "
        "traducibles: el importador acepta encabezados en es/en, pero no se pudo "
        "verificar el texto por defecto que escribe OpenCutList.",
        "Las dimensiones se escriben sin unidad; OpenCutList las interpreta en las "
        "unidades del modelo, por lo que al importar hay que elegir milímetros.",
        "El archivo .skp (formato binario de SketchUp) no se lee: el camino "
        "soportado es la exportación CSV de OpenCutList.",
    ),
    extensiones=(".csv",),
)


def importar(
    texto: str,
    *,
    separador: str | None = None,
    decimal: str | None = None,
    encabezado: bool = True,
    **_: object,
) -> ListaCorte:
    """Lee un CSV exportado por OpenCutList."""
    filas = leer_tabla(texto, separador)
    if not filas:
        raise ErrorFormato("el CSV está vacío")
    if not encabezado:
        raise ErrorFormato("OpenCutList exporta con encabezado; hace falta el encabezado")
    mapa = mapear_columnas(filas[0])
    faltantes = [campo for campo in OBLIGATORIOS if campo not in mapa]
    if faltantes:
        raise ErrorFormato(
            "faltan columnas obligatorias de OpenCutList (Designation, Length, "
            "Width, Thickness): " + ", ".join(faltantes) + f" (encabezado: {filas[0]})"
        )
    lista = ListaCorte(metadatos={"formato": CLAVE})
    for numero, fila in enumerate(filas[1:], start=2):
        try:
            lista.agregar(_pieza_desde_fila(fila, mapa, decimal))
        except ValueError as exc:
            raise ErrorFormato(f"fila {numero}: {exc}") from exc
    return propagar_avisos(DESCRIPTOR, lista)


def _pieza_desde_fila(fila: list[str], mapa: dict[str, int], decimal: str | None) -> Pieza:
    def valor(campo: str) -> str | None:
        return celda(fila, mapa.get(campo))

    cantidad = valor("cantidad")
    return Pieza(
        nombre=valor("nombre") or "sin nombre",
        largo=a_numero(valor("largo"), decimal=decimal),
        ancho=a_numero(valor("ancho"), decimal=decimal),
        cantidad=a_entero(cantidad, decimal=decimal) if cantidad else 1,
        espesor=a_numero_opcional(valor("espesor"), decimal=decimal),
        material=valor("material"),
        etiqueta=valor("etiqueta"),
    )


def exportar(
    lista: ListaCorte,
    *,
    separador: str = ";",
    decimal: str = ".",
    encabezado: bool = True,
    incluir_etiquetas: bool = True,
    **_: object,
) -> str:
    """Escribe un CSV que OpenCutList puede importar (campos documentados)."""
    filas: list[list[str]] = []
    for pieza in lista.piezas:
        filas.append([
            pieza.nombre,
            formatear_numero(pieza.largo, decimal),
            formatear_numero(pieza.ancho, decimal),
            formatear_numero(pieza.espesor, decimal),
            str(pieza.cantidad),
            pieza.material or "",
            (pieza.etiqueta or "") if incluir_etiquetas else "",
        ])
    encabezados = list(ENCABEZADOS_SALIDA) if encabezado else []
    if not incluir_etiquetas:
        filas = [fila[:-1] for fila in filas]
        encabezados = encabezados[:-1] if encabezados else []
    return escribir_tabla(encabezados, filas, separador)
