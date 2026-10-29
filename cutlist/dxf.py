"""Importador DXF: piezas desde un plano de corte.

Lee archivos **DXF ASCII** y convierte cada contorno cerrado en una pieza
rectangular con la medida de su rectángulo envolvente. La **capa** de cada
contorno es el `material` de la pieza, así el optimizador la reparte entre los
stocks igual que con el CSV (`cutlist/stock.py`); la capa `0`, que es la capa
por defecto de AutoCAD, cuenta como «sin material» (comodín).

Subconjunto leído (por revisar: no es todo el formato):

- `LWPOLYLINE` cerrada (código 70, bit 1) y `POLYLINE`/`VERTEX` cerradas.
- `LINE` sueltas que forman un contorno cerrado: se encadenan por extremos.
- `TEXT` y `MTEXT` cuyo punto de inserción cae dentro de un contorno: su texto
  pasa a ser la etiqueta de la pieza.
- Unidades del dibujo: `$INSUNITS` de la sección HEADER (1 pulgadas, 4 mm,
  5 cm, 6 m, ...). Sin unidades declaradas se asumen milímetros.

Las referencias `INSERT` (bloques) no se expanden y los contornos no
rectangulares se omiten con un aviso: el motor de nesting corta rectángulos.

Fuentes consultadas: *DXF Reference* (Autodesk), códigos de grupo
https://images.autodesk.com/adsk/files/autocad_2012_pdf_dxf-reference_enu.pdf y
lista de variables del HEADER (`$INSUNITS`)
https://documentation.help/AutoCAD-DXF/WS1a9193826455f5ff18cb41610ec0a2e719-7a6f.htm
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field

from .models import Part

# Unidades de dibujo ($INSUNITS) a milímetros, según la tabla del DXF Reference.
UNITS_MM = {
    1: 25.4,
    2: 304.8,
    3: 1_609_344.0,
    4: 1.0,
    5: 10.0,
    6: 1000.0,
    7: 1_000_000.0,
    8: 0.0000254,
    9: 0.0254,
    10: 914.4,
    14: 100.0,
    15: 10_000.0,
    16: 100_000.0,
}

TOLERANCE = 0.001  # mm: dos puntos más cerca que esto son el mismo vértice
MTEXT_CODES = re.compile(r"\\[A-Za-z][^;\\]*;|[{}]")
DEFAULT_LAYER = "0"


@dataclass
class DxfImport:
    """Piezas leídas del dibujo y avisos de lo que no se pudo usar."""

    parts: list[Part] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)


@dataclass(frozen=True)
class _Loop:
    points: list[tuple[float, float]]
    layer: str


@dataclass(frozen=True)
class _Text:
    x: float
    y: float
    text: str


def parse_dxf(text: str) -> DxfImport:
    """Piezas del archivo DXF (una por contorno cerrado)."""
    tags = _tags(text)
    entities, units = _split(tags)
    scale, warnings = _units(units)

    loops, segments = _shapes(entities)
    chained, unclosed = _chain(segments)
    loops = [*loops, *chained]
    if unclosed:
        warnings.append(
            f"{unclosed} línea(s) suelta(s) que no forman un contorno cerrado: se ignoran"
        )

    inserts = sum(1 for kind, _ in entities if kind == "INSERT")
    if inserts:
        warnings.append(
            f"{inserts} referencia(s) a bloques (INSERT) ignoradas: "
            f"por revisar, no se expanden los bloques"
        )

    texts = [
        _Text(x * scale, y * scale, value)
        for x, y, value in _texts(entities)
    ]

    boxes: list[tuple[float, float, float, float, float]] = []
    scaled_loops: list[list[tuple[float, float]]] = []
    for loop in loops:
        points = [(x * scale, y * scale) for x, y in loop.points]
        scaled_loops.append(points)
        xs = [point[0] for point in points]
        ys = [point[1] for point in points]
        x0, x1 = min(xs), max(xs)
        y0, y1 = min(ys), max(ys)
        boxes.append((x0, y0, x1, y1, x1 - x0))

    labels = _labels(texts, boxes, scale)

    imported = DxfImport(warnings=list(warnings))
    for index, points in enumerate(scaled_loops):
        x0, y0, x1, y1, _ = boxes[index]
        width, height = x1 - x0, y1 - y0
        if width <= 0 or height <= 0:
            continue
        polygon = abs(_polygon_area(points))
        if polygon and abs(polygon - width * height) > 0.01 * width * height:
            imported.warnings.append(
                f"se omite una forma no rectangular ({width:g} x {height:g} mm): "
                f"el motor de nesting corta rectángulos"
            )
            continue
        material = loops[index].layer.strip()
        if material == DEFAULT_LAYER:
            material = ""
        imported.parts.append(
            Part(
                width=round(width, 2),
                height=round(height, 2),
                label=labels.get(index, ""),
                material=material,
            )
        )

    if not imported.parts:
        raise ValueError(
            "el DXF no tiene piezas rectangulares utilizables: se leen contornos "
            "cerrados (LWPOLYLINE o POLYLINE cerradas, o líneas que formen un "
            "contorno); revisa que el dibujo tenga las piezas cerradas"
        )
    return imported


def _tags(text: str) -> list[tuple[int, str]]:
    """Pares (código, valor) del DXF ASCII."""
    if not text or not text.strip():
        raise ValueError("el DXF está vacío")
    if text.lstrip().startswith("AutoCAD Binary DXF"):
        raise ValueError(
            "el DXF es binario: guarda el dibujo como DXF ASCII (texto) y vuelve a importarlo"
        )

    lines = text.lstrip("\ufeff").splitlines()
    while lines and not lines[-1].strip():
        lines.pop()
    if len(lines) % 2:
        raise ValueError(
            "el DXF está incompleto: falta el valor de un código de grupo "
            f"(quedan {len(lines)} líneas)"
        )

    tags: list[tuple[int, str]] = []
    for index in range(0, len(lines), 2):
        raw = lines[index].strip()
        try:
            code = int(raw)
        except ValueError:
            raise ValueError(
                f"el DXF no es ASCII DXF: código de grupo inválido en la línea "
                f"{index + 1}: {raw!r}"
            ) from None
        tags.append((code, lines[index + 1].strip()))
    return tags


def _split(tags: list[tuple[int, str]]) -> tuple[list[tuple[str, list]], int | None]:
    """Entidades de la sección ENTITIES y unidades declaradas en el HEADER."""
    entities: list[tuple[str, list]] = []
    section: str | None = None
    index = 0
    while index < len(tags):
        code, value = tags[index]
        if code != 0:
            index += 1
            continue
        kind = value.strip()
        record: list[tuple[int, str]] = []
        index += 1
        while index < len(tags) and tags[index][0] != 0:
            record.append(tags[index])
            index += 1
        if kind == "SECTION":
            section = _value(record, 2, "")
        elif kind == "ENDSEC":
            section = None
        elif section == "ENTITIES":
            entities.append((kind, record))
    return entities, _units_declared(tags)


def _units_declared(tags: list[tuple[int, str]]) -> int | None:
    for index, (code, value) in enumerate(tags):
        if code == 9 and value.strip() == "$INSUNITS":
            for next_code, next_value in tags[index + 1 : index + 4]:
                if next_code == 70:
                    try:
                        return int(next_value)
                    except ValueError:
                        return None
            return None
    return None


def _units(units: int | None) -> tuple[float, list[str]]:
    if units is None or units == 0:
        return 1.0, ["el dibujo no declara unidades ($INSUNITS): se asumen milímetros"]
    scale = UNITS_MM.get(units)
    if scale is None:
        return 1.0, [
            f"unidades del dibujo desconocidas ($INSUNITS {units}): se asumen milímetros"
        ]
    return scale, []


def _shapes(entities):
    """Contornos cerrados y segmentos sueltos del dibujo."""
    loops: list[_Loop] = []
    segments: list[tuple[tuple[float, float], tuple[float, float], str]] = []
    index = 0
    while index < len(entities):
        kind, record = entities[index]
        layer = _value(record, 8, "")
        if kind == "LWPOLYLINE":
            points = _vertices(record)
            if _closed(record) or _is_closed(points):
                if len(points) >= 3:
                    loops.append(_Loop(_without_duplicate(points), layer))
            else:
                segments.extend(_segments(points, layer))
        elif kind == "POLYLINE":
            points: list[tuple[float, float]] = []
            index += 1
            while index < len(entities) and entities[index][0] == "VERTEX":
                points.extend(_vertices(entities[index][1]))
                index += 1
            if index < len(entities) and entities[index][0] == "SEQEND":
                index += 1
            if _closed(record) or _is_closed(points):
                if len(points) >= 3:
                    loops.append(_Loop(_without_duplicate(points), layer))
            else:
                segments.extend(_segments(points, layer))
            continue
        elif kind == "LINE":
            start = _point(record, 10, 20)
            end = _point(record, 11, 21)
            if start and end and start != end:
                segments.append((start, end, layer))
        index += 1
    return loops, segments


def _chain(segments):
    """Une segmentos de la misma capa en contornos cerrados."""
    by_layer: dict[str, list[tuple[tuple[float, float], tuple[float, float]]]] = {}
    for start, end, layer in segments:
        by_layer.setdefault(layer, []).append((start, end))

    loops: list[_Loop] = []
    unclosed = 0
    for layer, items in by_layer.items():
        used = [False] * len(items)
        for index, (start, end) in enumerate(items):
            if used[index]:
                continue
            used[index] = True
            points = [start, end]
            closed = False
            while True:
                if len(points) >= 4 and _near(points[0], points[-1]):
                    points.pop()
                    closed = True
                    break
                for other, (first, second) in enumerate(items):
                    if used[other]:
                        continue
                    if _near(points[-1], first):
                        used[other] = True
                        points.append(second)
                        break
                    if _near(points[-1], second):
                        used[other] = True
                        points.append(first)
                        break
                else:
                    break
            if closed and len(points) >= 3:
                loops.append(_Loop(points, layer))
            else:
                unclosed += 1
    return loops, unclosed


def _labels(texts: list[_Text], boxes: list[tuple], scale: float) -> dict[int, str]:
    """Etiqueta de cada contorno: el texto cuya inserción cae dentro de él."""
    labels: dict[int, str] = {}
    tolerance = TOLERANCE * max(1.0, scale)
    for text in texts:
        if not text.text:
            continue
        best: int | None = None
        for index, (x0, y0, x1, y1, _) in enumerate(boxes):
            if x0 - tolerance <= text.x <= x1 + tolerance and y0 - tolerance <= text.y <= y1 + tolerance:
                if best is None or (x1 - x0) * (y1 - y0) < _box_area(boxes[best]):
                    best = index
        if best is not None and best not in labels:
            labels[best] = text.text
    return labels


def _box_area(box: tuple) -> float:
    return (box[2] - box[0]) * (box[3] - box[1])


def _texts(entities) -> list[tuple[float, float, str]]:
    found: list[tuple[float, float, str]] = []
    for kind, record in entities:
        if kind == "TEXT":
            point = _point(record, 10, 20)
            value = _value(record, 1, "").strip()
            if point and value:
                found.append((point[0], point[1], value))
        elif kind == "MTEXT":
            point = _point(record, 10, 20)
            chunks = [value for code, value in record if code in (1, 3)]
            value = _clean_mtext(" ".join(chunks))
            if point and value:
                found.append((point[0], point[1], value))
    return found


def _clean_mtext(text: str) -> str:
    """Quita el formato del MTEXT (`\\fArial|b0;`, `\\P`, llaves)."""
    plain = MTEXT_CODES.sub("", text)
    return " ".join(plain.replace("\\P", " ").split())


def _vertices(record: list[tuple[int, str]]) -> list[tuple[float, float]]:
    xs = [_number(value) for code, value in record if code == 10]
    ys = [_number(value) for code, value in record if code == 20]
    return [
        (x, y)
        for x, y in zip(xs, ys)
        if x is not None and y is not None
    ]


def _segments(points, layer):
    return [
        (points[index], points[index + 1], layer)
        for index in range(len(points) - 1)
        if points[index] != points[index + 1]
    ]


def _point(record, x_code: int, y_code: int):
    x = _number(_value(record, x_code, ""))
    y = _number(_value(record, y_code, ""))
    return (x, y) if x is not None and y is not None else None


def _value(record: list[tuple[int, str]], code: int, default: str) -> str:
    for item_code, value in record:
        if item_code == code:
            return value
    return default


def _number(raw: str) -> float | None:
    try:
        return float(str(raw).strip().replace(",", "."))
    except (TypeError, ValueError):
        return None


def _closed(record: list[tuple[int, str]]) -> bool:
    try:
        return bool(int(_value(record, 70, "0")) & 1)
    except ValueError:
        return False


def _is_closed(points: list[tuple[float, float]]) -> bool:
    return len(points) >= 3 and _near(points[0], points[-1])


def _without_duplicate(points: list[tuple[float, float]]) -> list[tuple[float, float]]:
    return points[:-1] if _is_closed(points) else points


def _near(first: tuple[float, float], second: tuple[float, float]) -> bool:
    return (
        abs(first[0] - second[0]) <= TOLERANCE
        and abs(first[1] - second[1]) <= TOLERANCE
    )


def _polygon_area(points: list[tuple[float, float]]) -> float:
    """Área con signo del polígono (fórmula del cordón)."""
    total = 0.0
    for index, (x, y) in enumerate(points):
        next_x, next_y = points[(index + 1) % len(points)]
        total += x * next_y - next_x * y
    return total / 2.0
