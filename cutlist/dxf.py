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
- `INSERT` de bloques: se expanden **recursivamente** con su punto de
  inserción (`10`/`20`), escala (`41`/`42`), rotación (`50`, en grados) y
  arreglo de filas/columnas (`70`/`71` con separación `44`/`45`), tomando como
  base el punto del `BLOCK` (`10`/`20`). Las entidades del bloque en la capa
  `0` toman la capa del `INSERT`, como en AutoCAD. Los bloques anidados se
  expanden hasta `MAX_BLOCK_DEPTH` niveles.
- Unidades del dibujo: `$INSUNITS` de la sección HEADER (1 pulgadas, 4 mm,
  5 cm, 6 m, ...). Sin unidades declaradas se asumen milímetros.

Los contornos no rectangulares —también los que están dentro de un bloque— se
incluyen como su **rectángulo envolvente** y se avisa, porque el motor de
nesting corta rectángulos.

Fuentes consultadas: *DXF Reference* (Autodesk), códigos de grupo de `INSERT`,
`BLOCK` y `ENDBLK`
https://images.autodesk.com/adsk/files/autocad_2012_pdf_dxf-reference_enu.pdf y
lista de variables del HEADER (`$INSUNITS`)
https://documentation.help/AutoCAD-DXF/WS1a9193826455f5ff18cb41610ec0a2e719-7a6f.htm
"""

from __future__ import annotations

import math
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
MAX_BLOCK_DEPTH = 8


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


@dataclass(frozen=True)
class _Entity:
    """Entidad ya agrupada; las `POLYLINE` guardan sus `VERTEX` en `vertices`."""

    kind: str
    record: list[tuple[int, str]]
    vertices: tuple[list[tuple[int, str]], ...] = ()


def parse_dxf(text: str) -> DxfImport:
    """Piezas del archivo DXF (una por contorno cerrado)."""
    tags = _tags(text)
    entities, blocks, units = _split(tags)
    scale, warnings = _units(units)

    expanded = _expand(entities, blocks, warnings, depth=0)
    loops, segments = _shapes(expanded)
    chained, unclosed = _chain(segments)
    loops = [*loops, *chained]
    if unclosed:
        warnings.append(
            f"{unclosed} línea(s) suelta(s) que no forman un contorno cerrado: se ignoran"
        )

    texts = [_Text(x * scale, y * scale, value) for x, y, value in _texts(expanded)]

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
                f"forma no rectangular ({width:g} x {height:g} mm): se incluye "
                f"como su rectángulo envolvente, el motor de nesting corta rectángulos"
            )
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
            "el DXF no tiene piezas utilizables: se leen contornos cerrados "
            "(LWPOLYLINE o POLYLINE cerradas, líneas que formen un contorno, o "
            "bloques INSERT con esos contornos); revisa que el dibujo tenga las "
            "piezas cerradas"
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


def _split(
    tags: list[tuple[int, str]],
) -> tuple[list[_Entity], dict[str, list[_Entity]], int | None]:
    """Entidades de ENTITIES, bloques de BLOCKS y unidades del HEADER."""
    entities: list[tuple[str, list]] = []
    blocks: dict[str, list[tuple[str, list]]] = {}
    section: str | None = None
    current: list[tuple[str, list]] | None = None
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
            current = None
        elif section == "BLOCKS":
            if kind == "BLOCK":
                current = blocks.setdefault(_value(record, 2, "").strip(), [])
                current.append((kind, record))
            elif kind == "ENDBLK":
                current = None
            elif current is not None:
                current.append((kind, record))
        elif section == "ENTITIES":
            entities.append((kind, record))
    return (
        _group(entities),
        {name: _group(items) for name, items in blocks.items()},
        _units_declared(tags),
    )


def _group(items: list[tuple[str, list]]) -> list[_Entity]:
    """Agrupa cada POLYLINE con sus VERTEX; deja el resto como entidades sueltas."""
    units: list[_Entity] = []
    index = 0
    while index < len(items):
        kind, record = items[index]
        if kind != "POLYLINE":
            units.append(_Entity(kind, record))
            index += 1
            continue
        vertices: list[list[tuple[int, str]]] = []
        index += 1
        while index < len(items) and items[index][0] == "VERTEX":
            vertices.append(items[index][1])
            index += 1
        if index < len(items) and items[index][0] == "SEQEND":
            index += 1
        units.append(_Entity(kind, record, tuple(vertices)))
    return units


def _expand(
    entities: list[_Entity],
    blocks: dict[str, list[_Entity]],
    warnings: list[str],
    depth: int,
    parent_layer: str = "",
) -> list[_Entity]:
    """Sustituye cada INSERT por el contenido de su bloque ya transformado."""
    expanded: list[_Entity] = []
    for entity in entities:
        if entity.kind != "INSERT":
            expanded.append(_with_layer(entity, parent_layer))
            continue

        name = _value(entity.record, 2, "").strip()
        definition = blocks.get(name)
        if not definition:
            _warn(
                warnings,
                f"referencia a un bloque inexistente o vacío ({name or 'sin nombre'}): "
                f"se ignora",
            )
            continue
        if depth >= MAX_BLOCK_DEPTH:
            _warn(
                warnings,
                f"el bloque «{name}» se anida más de {MAX_BLOCK_DEPTH} niveles: "
                f"se corta la expansión",
            )
            continue

        base = _point(definition[0].record, 10, 20) or (0.0, 0.0)
        insertion = _point(entity.record, 10, 20) or (0.0, 0.0)
        layer = _value(entity.record, 8, "").strip()
        if layer == DEFAULT_LAYER and parent_layer:
            layer = parent_layer
        scale_x = _number(_value(entity.record, 41, "1")) or 1.0
        scale_y = _number(_value(entity.record, 42, "1")) or 1.0
        angle = math.radians(_number(_value(entity.record, 50, "0")) or 0.0)
        body = _expand(definition[1:], blocks, warnings, depth + 1, layer)

        for offset in _insert_offsets(entity.record):
            origin = (insertion[0] + offset[0], insertion[1] + offset[1])
            for item in body:
                expanded.append(
                    _transformed(item, base, origin, scale_x, scale_y, angle)
                )
    return expanded


def _insert_offsets(record: list[tuple[int, str]]) -> list[tuple[float, float]]:
    """Desplazamientos del arreglo de un INSERT (columnas 70 y filas 71)."""
    columns = max(1, _integer(_value(record, 70, "1")))
    rows = max(1, _integer(_value(record, 71, "1")))
    spacing_x = _number(_value(record, 44, "0")) or 0.0
    spacing_y = _number(_value(record, 45, "0")) or 0.0
    return [
        (column * spacing_x, row * spacing_y)
        for row in range(rows)
        for column in range(columns)
    ]


def _transformed(
    entity: _Entity,
    base: tuple[float, float],
    origin: tuple[float, float],
    scale_x: float,
    scale_y: float,
    angle: float,
) -> _Entity:
    """Copia la entidad aplicando escala, rotación y traslación del INSERT."""
    cos_a, sin_a = math.cos(angle), math.sin(angle)

    def move(x: float, y: float) -> tuple[float, float]:
        local_x = (x - base[0]) * scale_x
        local_y = (y - base[1]) * scale_y
        return (
            origin[0] + local_x * cos_a - local_y * sin_a,
            origin[1] + local_x * sin_a + local_y * cos_a,
        )

    record = _move_points(entity.record, move, 10, 20)
    if entity.kind == "LINE":
        record = _move_points(record, move, 11, 21)
    vertices = tuple(
        _move_points(vertex, move, 10, 20) for vertex in entity.vertices
    )
    return _Entity(entity.kind, record, vertices)


def _move_points(
    record: list[tuple[int, str]],
    move,
    x_code: int,
    y_code: int,
) -> list[tuple[int, str]]:
    """Reemplaza cada par (x_code, y_code) de coordenadas por su transformado."""
    result = list(record)
    index = 0
    while index + 1 < len(result):
        code, value = result[index]
        next_code, next_value = result[index + 1]
        if code == x_code and next_code == y_code:
            x = _number(value)
            y = _number(next_value)
            if x is not None and y is not None:
                new_x, new_y = move(x, y)
                result[index] = (code, _format(new_x))
                result[index + 1] = (next_code, _format(new_y))
            index += 2
            continue
        index += 1
    return result


def _with_layer(entity: _Entity, parent_layer: str) -> _Entity:
    """Las entidades de un bloque en la capa 0 toman la capa del INSERT."""
    if not parent_layer:
        return entity
    layer = _value(entity.record, 8, DEFAULT_LAYER).strip()
    if layer != DEFAULT_LAYER:
        return entity
    return _Entity(entity.kind, _set_value(entity.record, 8, parent_layer))


def _set_value(
    record: list[tuple[int, str]], code: int, value: str
) -> list[tuple[int, str]]:
    result: list[tuple[int, str]] = []
    found = False
    for item_code, item_value in record:
        if item_code == code and not found:
            result.append((code, value))
            found = True
        else:
            result.append((item_code, item_value))
    if not found:
        result.append((code, value))
    return result


def _warn(warnings: list[str], message: str) -> None:
    if message not in warnings:
        warnings.append(message)


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


def _shapes(entities: list[_Entity]):
    """Contornos cerrados y segmentos sueltos del dibujo."""
    loops: list[_Loop] = []
    segments: list[tuple[tuple[float, float], tuple[float, float], str]] = []
    for entity in entities:
        layer = _value(entity.record, 8, "")
        if entity.kind == "LWPOLYLINE":
            points = _vertices(entity.record)
            if _closed(entity.record) or _is_closed(points):
                if len(points) >= 3:
                    loops.append(_Loop(_without_duplicate(points), layer))
            else:
                segments.extend(_segments(points, layer))
        elif entity.kind == "POLYLINE":
            points: list[tuple[float, float]] = []
            for vertex in entity.vertices:
                points.extend(_vertices(vertex))
            if _closed(entity.record) or _is_closed(points):
                if len(points) >= 3:
                    loops.append(_Loop(_without_duplicate(points), layer))
            else:
                segments.extend(_segments(points, layer))
        elif entity.kind == "LINE":
            start = _point(entity.record, 10, 20)
            end = _point(entity.record, 11, 21)
            if start and end and start != end:
                segments.append((start, end, layer))
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


def _texts(entities: list[_Entity]) -> list[tuple[float, float, str]]:
    found: list[tuple[float, float, str]] = []
    for entity in entities:
        if entity.kind == "TEXT":
            point = _point(entity.record, 10, 20)
            value = _value(entity.record, 1, "").strip()
            if point and value:
                found.append((point[0], point[1], value))
        elif entity.kind == "MTEXT":
            point = _point(entity.record, 10, 20)
            chunks = [value for code, value in entity.record if code in (1, 3)]
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


def _integer(raw: str) -> int:
    try:
        return int(str(raw).strip())
    except (TypeError, ValueError):
        return 1


def _format(value: float) -> str:
    """Coordenada transformada, sin decimales de ruido."""
    return f"{value:.6f}".rstrip("0").rstrip(".") or "0"


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
