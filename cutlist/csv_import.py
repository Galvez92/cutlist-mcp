"""Importador CSV genérico de piezas.

El formato es **propio de cutlist-mcp** (no es el de Cortecloud ni el de otro
programa): un CSV simple que se puede escribir a mano o exportar desde una
planilla. Se aceptan encabezados en español e inglés, separador `,` o `;` y
decimales con punto o coma. Las medidas van en milímetros.

Columnas reconocidas
--------------------
ancho | width | w | l            medida 1 en mm (obligatoria)
alto  | height | h | c | largo    medida 2 en mm (obligatoria)
cantidad | quantity | qty | q    unidades (por defecto 1)
veta | grain                     sí/no: impide girar la pieza
etiqueta | label | nombre | pieza nombre de la pieza
c1, c2, l1, l2                   cantos, texto libre (opcional)
"""

from __future__ import annotations

import csv
import io
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

TRUE_VALUES = {"1", "si", "s", "true", "t", "yes", "y", "x"}

EXAMPLE_CSV = """ancho,alto,cantidad,veta,etiqueta
600,732,2,no,Pata costado exterior acento der
564,732,2,no,Costado interior der
600,1173.5,1,no,Cubierta superior
1500,250,3,si,Panel lateral
"""


def parse_parts_csv(text: str) -> list[Part]:
    """Convierte el texto de un CSV en piezas del motor."""
    lines = [line for line in text.splitlines() if line.strip()]
    if len(lines) < 2:
        raise ValueError("el CSV necesita una fila de encabezados y al menos una pieza")

    delimiter = ";" if lines[0].count(";") > lines[0].count(",") else ","
    reader = csv.DictReader(io.StringIO("\n".join(lines)), delimiter=delimiter)
    columns = _map_columns(reader.fieldnames or [])

    return [
        _row_to_part(row, columns, line_number)
        for line_number, row in enumerate(reader, start=2)
    ]


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


def _row_to_part(row: dict, columns: dict[str, str], line: int) -> Part:
    quantity = 1
    if "quantity" in columns:
        raw = _clean(row.get(columns["quantity"]))
        if raw:
            quantity = int(_number(raw, "cantidad", line))

    grain = False
    if "grain" in columns:
        grain = _normalize(_clean(row.get(columns["grain"])) or "") in TRUE_VALUES

    edge_values = {
        key: _clean(row.get(columns[key]))
        for key in ("c1", "c2", "l1", "l2")
        if key in columns
    }
    edges = EdgeBanding(**edge_values) if any(edge_values.values()) else None

    label = _clean(row.get(columns["label"])) or "" if "label" in columns else ""

    try:
        return Part(
            width=_number(row.get(columns["width"]), "ancho", line),
            height=_number(row.get(columns["height"]), "alto", line),
            quantity=quantity,
            grain=grain,
            label=label,
            edges=edges,
        )
    except ValueError as error:
        raise ValueError(f"fila {line}: {error}") from error


def _number(raw, field: str, line: int) -> float:
    text = (raw or "").strip().replace(",", ".")
    if not text:
        raise ValueError(f"falta el valor de «{field}»")
    try:
        return float(text)
    except ValueError as error:
        raise ValueError(f"valor no numérico en «{field}»: {raw!r}") from error


def _clean(raw) -> str | None:
    value = (raw or "").strip()
    return value or None
