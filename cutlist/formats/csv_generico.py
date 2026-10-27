"""CSV genérico — formato propio de cutlist-mcp (importación y exportación).

Especificado en ``docs/formatos/csv-generico.md``: encabezado obligatorio, un
registro por pieza, separador y decimal configurables. Al ser un formato propio y
documentado por el proyecto, su estado es *verificado*.
"""

from __future__ import annotations

from ..model import Fuente, ListaCorte, Pieza, VERIFICADO
from .base import (
    DIRECCION_AMBOS,
    DescriptorFormato,
    ErrorFormato,
    a_booleano,
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

CLAVE = "csv_generico"

ENCABEZADOS = (
    "nombre", "largo", "ancho", "cantidad", "espesor", "material", "veta",
    "grupo", "etiqueta", "notas", "canto_c1", "canto_c2", "canto_l1", "canto_l2",
)

OBLIGATORIOS = ("nombre", "largo", "ancho")

DESCRIPTOR = DescriptorFormato(
    clave=CLAVE,
    nombre="CSV genérico (formato propio)",
    direccion=DIRECCION_AMBOS,
    estado=VERIFICADO,
    fuentes=(
        Fuente(
            "docs/formatos/csv-generico.md",
            "Especificación del formato CSV propio: columnas, obligatoriedad, "
            "unidad (mm) y convención de cantos C/L.",
        ),
    ),
    extensiones=(".csv", ".txt"),
)


def importar(
    texto: str,
    *,
    separador: str | None = None,
    decimal: str | None = None,
    encabezado: bool = True,
    **_: object,
) -> ListaCorte:
    """Lee un CSV propio; el encabezado es obligatorio."""
    filas = leer_tabla(texto, separador)
    if not filas:
        raise ErrorFormato("el CSV está vacío")
    if not encabezado:
        raise ErrorFormato("el CSV genérico requiere encabezado de columnas")
    mapa = mapear_columnas(filas[0])
    faltantes = [campo for campo in OBLIGATORIOS if campo not in mapa]
    if faltantes:
        raise ErrorFormato(
            "faltan columnas obligatorias: " + ", ".join(faltantes) +
            f" (encabezado leído: {filas[0]})"
        )
    lista = ListaCorte(metadatos={"formato": CLAVE, "separador": separador or "auto"})
    for numero, fila in enumerate(filas[1:], start=2):
        try:
            lista.agregar(_pieza_desde_fila(fila, mapa, decimal))
        except ValueError as exc:
            raise ErrorFormato(f"fila {numero}: {exc}") from exc
    return propagar_avisos(DESCRIPTOR, lista)


def _pieza_desde_fila(fila: list[str], mapa: dict[str, int], decimal: str | None) -> Pieza:
    def valor(campo: str) -> str | None:
        return celda(fila, mapa.get(campo))

    return Pieza(
        nombre=valor("nombre") or "sin nombre",
        largo=a_numero(valor("largo"), decimal=decimal),
        ancho=a_numero(valor("ancho"), decimal=decimal),
        cantidad=a_entero(valor("cantidad"), decimal=decimal),
        espesor=a_numero_opcional(valor("espesor"), decimal=decimal),
        material=valor("material"),
        veta=a_booleano(valor("veta")),
        grupo=valor("grupo"),
        etiqueta=valor("etiqueta"),
        notas=valor("notas"),
        cantos={
            clave.replace("canto_", ""): valor(clave)
            for clave in ("canto_c1", "canto_c2", "canto_l1", "canto_l2")
        },
    )


def exportar(
    lista: ListaCorte,
    *,
    separador: str = ";",
    decimal: str = ",",
    encabezado: bool = True,
    unidad: bool = False,
    **_: object,
) -> str:
    """Escribe la lista en el CSV propio (por defecto ``;`` y decimal coma)."""
    filas: list[list[str]] = []
    for pieza in lista.piezas:
        cantos = pieza.cantos or {}
        filas.append([
            pieza.nombre,
            formatear_numero(pieza.largo, decimal),
            formatear_numero(pieza.ancho, decimal),
            str(pieza.cantidad),
            formatear_numero(pieza.espesor, decimal),
            pieza.material or "",
            "" if pieza.veta is None else ("si" if pieza.veta else "no"),
            pieza.grupo or "",
            pieza.etiqueta or "",
            pieza.notas or "",
            cantos.get("c1") or "",
            cantos.get("c2") or "",
            cantos.get("l1") or "",
            cantos.get("l2") or "",
        ])
    encabezados = list(ENCABEZADOS) if encabezado else []
    if unidad:
        encabezados = [f"{c}_mm" if c in ("largo", "ancho", "espesor") else c
                       for c in encabezados]
    return escribir_tabla(encabezados, filas, separador)
