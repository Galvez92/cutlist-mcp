"""Lector/escritor de listados delimitados con columnas declaradas.

PolyBoard, Promob y PRO100 exportan listados de piezas en texto/CSV **cuya
estructura no está publicada** (campos, orden, separador y decimales son
configurables por el usuario en cada programa). En lugar de inventar un orden de
columnas, este módulo pide las columnas declaradas y, si no se declaran, usa un
orden por defecto marcado «por revisar» en cada formato.
"""

from __future__ import annotations

from collections.abc import Iterable, Sequence

from ..model import ErrorDato, Pieza
from .base import (
    a_booleano,
    a_entero,
    a_numero,
    a_numero_opcional,
    escribir_tabla,
    formatear_numero,
    mapear_columnas,
    normalizar_nombre,
)

CAMPOS_VALIDOS = (
    "nombre", "largo", "ancho", "cantidad", "espesor", "material", "veta",
    "grupo", "etiqueta", "notas", "canto_c1", "canto_c2", "canto_l1", "canto_l2",
)

CAMPOS_OBLIGATORIOS = ("nombre", "largo", "ancho")


def normalizar_columnas(columnas: Iterable[str | None]) -> tuple[str | None, ...]:
    """Valida y normaliza una lista ordenada de nombres de campo canónicos.

    Una posición ``None`` representa una columna del archivo que no usamos: se
    mantiene para que las demás no se desalineen.
    """
    limpias: list[str | None] = []
    for columna in columnas:
        if columna is None or not str(columna).strip():
            limpias.append(None)
            continue
        nombre = normalizar_nombre(columna)
        if nombre not in CAMPOS_VALIDOS:
            raise ErrorDato(
                f"columna desconocida: {columna!r}. Válidas: {list(CAMPOS_VALIDOS)}"
            )
        limpias.append(nombre)
    faltantes = [c for c in CAMPOS_OBLIGATORIOS if c not in limpias]
    if faltantes:
        raise ErrorDato(f"faltan columnas obligatorias: {faltantes}")
    return tuple(limpias)


def columnas_desde_encabezado(encabezados: Sequence[str]) -> tuple[str | None, ...]:
    """Convierte un encabezado real en el orden de campos canónicos.

    Las columnas que no reconocemos quedan como ``None`` en su posición.
    """
    mapa = mapear_columnas(list(encabezados))
    if not mapa:
        raise ErrorDato(
            f"no se reconoció ninguna columna en el encabezado: {list(encabezados)}"
        )
    posiciones: list[str | None] = [None] * len(encabezados)
    for campo, indice in mapa.items():
        posiciones[indice] = campo
    return normalizar_columnas(posiciones)


def leer_piezas(
    filas: Iterable[Sequence[str]],
    columnas: Sequence[str | None],
    *,
    decimal: str | None = None,
    nombre_defecto: str = "sin nombre",
) -> list[Pieza]:
    """Convierte filas de celdas en piezas, usando el orden de ``columnas``."""
    columnas = tuple(columnas)
    piezas: list[Pieza] = []
    for numero, fila in enumerate(filas, start=1):
        valores = {
            columna: (str(fila[i]).strip() if i < len(fila) else "")
            for i, columna in enumerate(columnas)
            if columna is not None
        }
        try:
            piezas.append(_pieza_desde_valores(valores, decimal, nombre_defecto, numero))
        except ErrorDato as exc:
            raise ErrorDato(f"fila {numero}: {exc}") from exc
    return piezas


def _pieza_desde_valores(
    valores: dict[str, str],
    decimal: str | None,
    nombre_defecto: str,
    numero: int,
) -> Pieza:
    def valor(campo: str) -> str | None:
        dato = valores.get(campo, "")
        return dato or None

    return Pieza(
        nombre=valor("nombre") or f"{nombre_defecto} {numero}",
        largo=a_numero(valor("largo"), decimal=decimal),
        ancho=a_numero(valor("ancho"), decimal=decimal),
        cantidad=a_entero(valor("cantidad"), decimal=decimal),
        espesor=a_numero_opcional(valor("espesor"), decimal=decimal),
        material=valor("material"),
        veta=a_booleano(valor("veta")),
        grupo=valor("grupo"),
        etiqueta=valor("etiqueta"),
        notas=valor("notas"),
        cantos={c.replace("canto_", ""): valor(c)
                for c in ("canto_c1", "canto_c2", "canto_l1", "canto_l2")},
    )


def escribir_listado(
    piezas: Sequence[Pieza],
    columnas: Sequence[str],
    *,
    separador: str = ";",
    decimal: str = ".",
    encabezado: bool = True,
) -> str:
    """Escribe un listado delimitado con las columnas declaradas.

    Sólo lo usan las pruebas y la conversión entre listados: los formatos que
    dependen de él (PolyBoard, Promob, PRO100) son de sólo lectura, así que no se
    expone desde el registro.
    """
    columnas = tuple(columnas)
    filas = [[_campo_como_texto(pieza, columna, decimal) for columna in columnas]
             for pieza in piezas]
    encabezados = list(columnas) if encabezado else []
    return escribir_tabla(encabezados, filas, separador)


def _campo_como_texto(pieza: Pieza, columna: str, decimal: str) -> str:
    if columna == "nombre":
        return pieza.nombre
    if columna in ("largo", "ancho", "espesor"):
        return formatear_numero(getattr(pieza, columna), decimal)
    if columna == "cantidad":
        return str(pieza.cantidad)
    if columna == "veta":
        return "" if pieza.veta is None else ("si" if pieza.veta else "no")
    if columna in ("canto_c1", "canto_c2", "canto_l1", "canto_l2"):
        return (pieza.cantos or {}).get(columna.replace("canto_", "")) or ""
    return getattr(pieza, columna, "") or ""
