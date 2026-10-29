"""Importador CSV genérico de piezas.

El formato es **propio de cutlist-mcp** (no es el de Cortecloud ni el de otro
programa): un CSV simple que se puede escribir a mano o exportar desde una
planilla. Se aceptan encabezados en español e inglés, separador `,` o `;` y
decimales con punto o coma. Las medidas van en milímetros.

Columnas reconocidas
--------------------
ancho | width | w | l            medida 1 en mm (obligatoria)
alto  | height | h | c | largo    medida 2 en mm (obligatoria)
cantidad | quantity | qty | q    unidades (por defecto 1, entero positivo)
veta | grain                     sí/no: impide girar la pieza
etiqueta | label | nombre | pieza nombre de la pieza
material | stock                 material de la pieza (el motor lo corta del
                                 stock de ese material; ver `cutlist/stock.py`)
c1, c2, l1, l2                   cantos, texto libre (opcional)

Datos tal como los exporta una planilla (Google Sheets, Excel)
--------------------------------------------------------------
Se tolera el BOM UTF-8, los finales de línea CRLF, los campos entrecomillados
con comas, saltos de línea o comillas escapadas, y las filas o columnas vacías
que agregan los exportadores. Un texto pegado con tabulaciones (lo que copia
Google Sheets al portapapeles) se rechaza con un mensaje explícito, porque
mezclaría todas las columnas en una sola.
"""

from __future__ import annotations

import csv
import io
import math
import unicodedata

from .models import EdgeBanding, Part


def _normalize(name: str) -> str:
    """Minúsculas, sin acentos y con guiones bajos."""
    decomposed = unicodedata.normalize("NFKD", str(name))
    plain = decomposed.encode("ascii", "ignore").decode("ascii")
    return plain.strip().lower().replace("-", "_").replace(" ", "_")


ALIASES: dict[str, set[str]] = {
    canonical: {_normalize(alias) for alias in aliases}
    for canonical, aliases in {
        "width": {"ancho", "width", "w", "l"},
        "height": {"alto", "height", "h", "c", "largo"},
        "quantity": {"cantidad", "quantity", "qty", "q", "cant"},
        "grain": {"veta", "grain"},
        "label": {"etiqueta", "label", "nombre", "pieza", "function"},
        "material": {"material", "stock"},
        "c1": {"c1"},
        "c2": {"c2"},
        "l1": {"l1"},
        "l2": {"l2"},
    }.items()
}

LABELS = {
    "width": "ancho",
    "height": "alto",
    "quantity": "cantidad",
    "grain": "veta",
    "label": "etiqueta",
}

TRUE_VALUES = {"1", "si", "s", "true", "t", "yes", "y", "x", "verdadero"}

EXAMPLE_CSV = """ancho,alto,cantidad,veta,etiqueta
600,732,2,no,Pata costado exterior acento der
564,732,2,no,Costado interior der
600,1173.5,1,no,Cubierta superior
1500,250,3,si,Panel lateral
"""


def parse_parts_csv(text: str) -> list[Part]:
    """Convierte el texto de un CSV en piezas del motor."""
    text = (text or "").lstrip("\ufeff").strip()
    if not text:
        raise ValueError("el CSV necesita una fila de encabezados y al menos una pieza")

    header = text.splitlines()[0]
    if "\t" in header:
        raise ValueError(
            "el texto está separado por tabulaciones: exporta el CSV con comas o punto y coma"
        )

    delimiter = ";" if header.count(";") > header.count(",") else ","
    reader = csv.DictReader(io.StringIO(text), delimiter=delimiter)
    columns = _map_columns(reader.fieldnames or [])

    parts: list[Part] = []
    for row in reader:
        if _is_blank(row):
            continue
        parts.append(_row_to_part(row, columns, reader.line_num))
    if not parts:
        raise ValueError("el CSV no tiene piezas")
    return parts


def _map_columns(fieldnames: list[str]) -> dict[str, str]:
    """Nombre canónico -> encabezado real del archivo."""
    columns: dict[str, str] = {}
    for name in fieldnames:
        key = _normalize(name)
        for canonical, aliases in ALIASES.items():
            if key in aliases and canonical not in columns:
                columns[canonical] = name
    for required in ("width", "height"):
        if required not in columns:
            accepted = ", ".join(sorted(ALIASES[required]))
            raise ValueError(
                f"falta la columna de {LABELS[required]} (se acepta: {accepted})"
            )
    return columns


def _is_blank(row: dict) -> bool:
    """Fila sin ningún dato: las planillas suelen dejarlas al final."""
    cells: list = []
    for value in row.values():
        cells.extend(value if isinstance(value, list) else [value])
    return all(not str(cell or "").strip() for cell in cells)


def _row_to_part(row: dict, columns: dict[str, str], line: int) -> Part:
    try:
        return Part(
            width=_number(row.get(columns["width"]), "ancho"),
            height=_number(row.get(columns["height"]), "alto"),
            quantity=_quantity(row, columns),
            grain=_grain(row, columns),
            label=(_clean(row.get(columns["label"])) or "") if "label" in columns else "",
            material=(_clean(row.get(columns["material"])) or "")
            if "material" in columns
            else "",
            edges=_edges(row, columns),
        )
    except ValueError as error:
        raise ValueError(f"fila {line}: {error}") from error


def _quantity(row: dict, columns: dict[str, str]) -> int:
    if "quantity" not in columns:
        return 1
    raw = _clean(row.get(columns["quantity"]))
    if not raw:
        return 1
    value = _number(raw, "cantidad")
    if value <= 0 or value != int(value):
        raise ValueError(f"la cantidad debe ser un entero positivo: {raw!r}")
    return int(value)


def _grain(row: dict, columns: dict[str, str]) -> bool:
    if "grain" not in columns:
        return False
    return _normalize(_clean(row.get(columns["grain"])) or "") in TRUE_VALUES


def _edges(row: dict, columns: dict[str, str]) -> EdgeBanding | None:
    values = {
        key: _clean(row.get(columns[key]))
        for key in ("c1", "c2", "l1", "l2")
        if key in columns
    }
    return EdgeBanding(**values) if any(values.values()) else None


def _number(raw, field: str) -> float:
    text = (str(raw) if raw is not None else "").strip().replace(",", ".")
    if not text:
        raise ValueError(f"falta el valor de «{field}»")
    try:
        value = float(text)
    except ValueError as error:
        raise ValueError(f"valor no numérico en «{field}»: {raw!r}") from error
    if not math.isfinite(value):
        raise ValueError(f"valor no finito en «{field}»: {raw!r}")
    return value


def _clean(raw) -> str | None:
    value = str(raw).strip() if raw is not None else ""
    return value or None
