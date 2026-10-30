"""Importador del XML de Promob (Plugin Builder XML).

Promob exporta la lista de piezas de un presupuesto con «Enviar para > XML»,
pero ese XML del presupuesto no tiene esquema público ni una muestra
verificable: queda **por revisar**. Lo que sí está documentado y con un ejemplo
oficial es el **Plugin Builder XML**, que genera un programa por pieza con su
geometría y sus mecanizados; es el formato que lee este módulo.

Subconjunto leído (por revisar: no es todo el formato):

- Raíz `PROGRAM` (una o varias) con `PARTDESCRIPTION` y `HEADER` (`DX`, `DY`,
  `DZ`, en milímetros). `DX` x `DY` es la pieza.
- `CONTENT/HOLE` con `X`, `Y` y `DIAMETER`: barrenos, con su centro medido
  desde una esquina de la pieza.
- `CONTENT/SLOT` con `SX`, `SY`, `EX`, `EY` y `WIDTH`: ranuras, con su eje.
- `CONTENT/MACHINING` con `TYPE="Contour"` e `ISEXTERNALCONTOUR="True"`: el
  contorno de la pieza. Si no es rectangular se avisa y la pieza se corta como
  su rectángulo envolvente (`DX` x `DY`), porque el motor corta rectángulos.
  Los mecanizados interiores (`TYPE="Interior"`, bolsillos) no se importan.

El archivo no trae material ni veta, así que las piezas van al stock comodín y
se pueden girar; el `DZ` del `HEADER` es el espesor y se guarda en
`Part.thickness`. Un barreno vertical fuera del área, o un barreno horizontal
fuera del canto y del espesor, marcan la pieza inválida
(`Part.invalid_reasons`) y el motor no la ubica.

Fuente: «Builder - Plugin Builder XML», documentación y ejemplo oficial
`SID0036A.xml` de Promob,
https://suporte.promob.com/hc/pt-br/articles/31123182340497-Builder-Plugin-Builder-XML
(el ejemplo está copiado en `tests/fixtures/promob/SID0036A.xml`).
"""

from __future__ import annotations

import math
import xml.etree.ElementTree as ElementTree
from dataclasses import dataclass, field
from pathlib import Path

from .models import Drill, Machining, Part, Slot

FIXTURE = (
    Path(__file__).resolve().parent.parent / "tests" / "fixtures" / "promob" / "SID0036A.xml"
)


@dataclass
class PromobImport:
    """Piezas leídas del XML y avisos de lo que no se pudo usar."""

    parts: list[Part] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)


def load_fixture(path: str | Path = FIXTURE) -> PromobImport:
    """XML de ejemplo de Promob incluido en el repositorio (o el de `path`)."""
    path = Path(path)
    try:
        text = path.read_text(encoding="utf-8")
    except FileNotFoundError as error:
        raise ValueError(f"no se encontró el archivo {path}") from error
    except IsADirectoryError as error:
        raise ValueError(f"{path} es un directorio, no un archivo") from error
    except UnicodeDecodeError as error:
        raise ValueError(f"{path} no está codificado en UTF-8: {error}") from error
    except OSError as error:
        raise ValueError(f"no se pudo leer {path}: {error}") from error
    return parse_promob_xml(text)


def parse_promob_xml(text: str) -> PromobImport:
    """Piezas del XML de Promob (una `PROGRAM` por pieza)."""
    if not text or not text.strip():
        raise ValueError("el XML de Promob está vacío")
    try:
        root = ElementTree.fromstring(text)
    except ElementTree.ParseError as error:
        raise ValueError(f"el XML de Promob no es válido: {error}") from error

    programs = [root] if root.tag == "PROGRAM" else root.findall(".//PROGRAM")
    if not programs:
        raise ValueError(
            "no es un XML de Promob: falta el nodo PROGRAM con la pieza "
            "(Plugin Builder XML)"
        )

    imported = PromobImport()
    for number, program in enumerate(programs, start=1):
        imported.parts.append(_part(program, number, imported.warnings))
    return imported


def _part(program: ElementTree.Element, number: int, warnings: list[str]) -> Part:
    header = program.find("HEADER")
    if header is None:
        raise ValueError(f"pieza {number}: el XML de Promob no tiene HEADER")
    width = _measure(header, "DX", number)
    height = _measure(header, "DY", number)
    # DZ es el espesor del tablero: valida los barrenos al canto.
    thickness = _measure(header, "DZ", number) if "DZ" in header.attrib else None
    label = (program.get("PARTDESCRIPTION") or "").strip()

    content = program.find("CONTENT")
    drills: list[Drill] = []
    slots: list[Slot] = []
    if content is not None:
        for element in content:
            if element.tag == "HOLE":
                drills.append(_hole(element, number))
            elif element.tag == "SLOT":
                slots.append(_slot(element, number))
            elif element.tag == "MACHINING":
                _contour(element, width, height, label or f"pieza {number}", warnings)

    machining = Machining(drills=tuple(drills), slots=tuple(slots))
    return Part(
        width=width,
        height=height,
        label=label,
        material="",
        thickness=thickness,
        machining=None if machining.is_empty else machining,
    )


def _hole(element: ElementTree.Element, number: int) -> Drill:
    return Drill(
        x=_coordinate(element, "X", number, "HOLE"),
        y=_coordinate(element, "Y", number, "HOLE"),
        diameter=_measure(element, "DIAMETER", number, "HOLE"),
        horizontal=_is_horizontal(element),
    )


def _slot(element: ElementTree.Element, number: int) -> Slot:
    return Slot(
        width=_measure(element, "WIDTH", number, "SLOT"),
        x0=_coordinate(element, "SX", number, "SLOT"),
        y0=_coordinate(element, "SY", number, "SLOT"),
        x1=_coordinate(element, "EX", number, "SLOT"),
        y1=_coordinate(element, "EY", number, "SLOT"),
    )


def _is_horizontal(element: ElementTree.Element) -> bool:
    """`FACENORMAL` con Z=0: el barreno va en un canto, no en la cara."""
    raw = (element.get("FACENORMAL") or "").strip().strip("()")
    parts = raw.split(";")
    if len(parts) != 3:
        return False
    try:
        return abs(float(parts[2].replace(",", "."))) < 1e-6
    except ValueError:
        return False


def _contour(
    element: ElementTree.Element,
    width: float,
    height: float,
    name: str,
    warnings: list[str],
) -> None:
    """Avisa si el contorno de la pieza no es el rectángulo DX x DY."""
    if (element.get("TYPE") or "").strip() != "Contour":
        return
    if (element.get("ISEXTERNALCONTOUR") or "").strip().lower() != "true":
        return

    points: list[tuple[float, float]] = []
    for child in element:
        if child.tag not in ("STARTPOINT", "LINEENDPOINT"):
            continue
        try:
            points.append((float(child.get("X")), float(child.get("Y"))))
        except (TypeError, ValueError):
            continue
    if len(points) < 3:
        _warn(
            warnings,
            f"la pieza «{name}» no trae el contorno exterior completo: "
            f"se corta como su rectángulo envolvente {width:g}x{height:g} mm",
        )
        return

    xs = [point[0] for point in points]
    ys = [point[1] for point in points]
    if (
        abs(min(xs)) > 0.01
        or abs(min(ys)) > 0.01
        or abs(max(xs) - width) > 0.01
        or abs(max(ys) - height) > 0.01
    ):
        _warn(
            warnings,
            f"el contorno exterior de «{name}» no coincide con "
            f"{width:g}x{height:g} mm: se usa el rectángulo envolvente del HEADER",
        )
    area = abs(_polygon_area(points))
    if area and abs(area - width * height) > 0.01 * width * height:
        _warn(
            warnings,
            f"la pieza «{name}» no es rectangular: se corta como su rectángulo "
            f"envolvente {width:g}x{height:g} mm",
        )


def _measure(
    element: ElementTree.Element, name: str, number: int, tag: str = "HEADER"
) -> float:
    raw = element.get(name)
    try:
        value = float(str(raw).replace(",", "."))
    except (TypeError, ValueError):
        raise ValueError(
            f"pieza {number}: falta la medida {name!r} ({tag}) o no es un número"
        ) from None
    if not math.isfinite(value) or value <= 0:
        raise ValueError(f"pieza {number}: medida {name!r} inválida en {tag}: {raw!r}")
    return value


def _coordinate(
    element: ElementTree.Element, name: str, number: int, tag: str
) -> float:
    raw = element.get(name)
    try:
        value = float(str(raw).replace(",", "."))
    except (TypeError, ValueError):
        raise ValueError(
            f"pieza {number}: falta la coordenada {name!r} de un {tag} o no es un número"
        ) from None
    if not math.isfinite(value):
        raise ValueError(
            f"pieza {number}: coordenada {name!r} inválida en {tag}: {raw!r}"
        )
    return value


def _warn(warnings: list[str], message: str) -> None:
    if message not in warnings:
        warnings.append(message)


def _polygon_area(points: list[tuple[float, float]]) -> float:
    """Área con signo del polígono (fórmula del cordón)."""
    total = 0.0
    for index, (x, y) in enumerate(points):
        next_x, next_y = points[(index + 1) % len(points)]
        total += x * next_y - next_x * y
    return total / 2.0
