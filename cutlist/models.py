"""Modelos de datos del motor de corte.

Todas las medidas están en milímetros. Los nombres de los cantos (`c1`, `c2`,
`l1`, `l2`) siguen el formato real de Cortecloud documentado en
`docs/memoria/MEMORIA.md`.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from typing import Iterator

EPS = 1e-9

# Tolerancia al comparar medidas de mecanizado con las del perfil (en mm).
MACHINING_TOLERANCE = 1e-6


def _is_allowed(value: float, allowed: tuple[float, ...]) -> bool:
    return any(abs(value - candidate) <= MACHINING_TOLERANCE for candidate in allowed)


def _allowed_text(allowed: tuple[float, ...]) -> str:
    return "/".join(f"{value:g}" for value in allowed)


@dataclass(frozen=True)
class EdgeBanding:
    """Cantos de una pieza, con los nombres de campo de Cortecloud."""

    c1: str | None = None
    c2: str | None = None
    l1: str | None = None
    l2: str | None = None

    @property
    def is_empty(self) -> bool:
        return not any((self.c1, self.c2, self.l1, self.l2))

    def describe(self) -> str:
        pairs = (("c1", self.c1), ("c2", self.c2), ("l1", self.l1), ("l2", self.l2))
        return "; ".join(f"{name}={value}" for name, value in pairs if value)


@dataclass(frozen=True)
class Drill:
    """Barreno de una pieza: centro (mm) desde una esquina y diámetro."""

    x: float
    y: float
    diameter: float
    horizontal: bool = False


@dataclass(frozen=True)
class Slot:
    """Ranura de una pieza: ancho (mm) y, si se conoce, su eje.

    El XML de Promob trae el eje completo (`SX`, `SY`, `EX`, `EY`); el
    `furrowMachining` de Cortecloud sólo trae el ancho, así que ahí el eje
    queda en `None` (por revisar: la muestra real no documenta el inicio).
    """

    width: float
    x0: float | None = None
    y0: float | None = None
    x1: float | None = None
    y1: float | None = None

    @property
    def has_axis(self) -> bool:
        return None not in (self.x0, self.y0, self.x1, self.y1)


@dataclass(frozen=True)
class Machining:
    """Mecanizado de una pieza: barrenos y ranuras con su posición.

    Las medidas (diámetro, ancho) son las que restringe el perfil
    Cortecloud/Madijal; las coordenadas sirven para comprobar que el
    mecanizado cae dentro del área de la pieza.
    """

    drills: tuple[Drill, ...] = ()
    slots: tuple[Slot, ...] = ()

    @property
    def is_empty(self) -> bool:
        return not (self.drills or self.slots)

    @property
    def vertical_drills(self) -> tuple[float, ...]:
        return tuple(drill.diameter for drill in self.drills if not drill.horizontal)

    @property
    def horizontal_drills(self) -> tuple[float, ...]:
        return tuple(drill.diameter for drill in self.drills if drill.horizontal)

    @property
    def slot_widths(self) -> tuple[float, ...]:
        return tuple(slot.width for slot in self.slots)

    def outside(self, width: float, height: float) -> list[str]:
        """Mecanizados que caen, en todo o en parte, fuera del área de la pieza."""
        problems: list[str] = []
        tolerance = MACHINING_TOLERANCE
        for drill in self.drills:
            if drill.horizontal:
                # por revisar: en un canto el barreno viene proyectado sobre la
                # cara, así que su X/Y no se miden contra el área de la pieza.
                continue
            radius = drill.diameter / 2.0
            if (
                drill.x - radius < -tolerance
                or drill.y - radius < -tolerance
                or drill.x + radius > width + tolerance
                or drill.y + radius > height + tolerance
            ):
                problems.append(
                    f"barreno Ø{drill.diameter:g} mm en ({drill.x:g}; {drill.y:g}) "
                    f"fuera del área {width:g}x{height:g} mm"
                )
        for slot in self.slots:
            if not slot.has_axis:
                continue
            half = slot.width / 2.0
            length = math.hypot(slot.x1 - slot.x0, slot.y1 - slot.y0)
            if length:
                # El ancho se abre perpendicular al eje: una ranura puede
                # terminar justo en el borde de la pieza (ranura pasante).
                spread_x = abs(slot.y1 - slot.y0) / length * half
                spread_y = abs(slot.x1 - slot.x0) / length * half
            else:
                spread_x = spread_y = half
            if (
                min(slot.x0, slot.x1) - spread_x < -tolerance
                or min(slot.y0, slot.y1) - spread_y < -tolerance
                or max(slot.x0, slot.x1) + spread_x > width + tolerance
                or max(slot.y0, slot.y1) + spread_y > height + tolerance
            ):
                problems.append(
                    f"ranura de {slot.width:g} mm de ({slot.x0:g}; {slot.y0:g}) a "
                    f"({slot.x1:g}; {slot.y1:g}) fuera del área {width:g}x{height:g} mm"
                )
        return problems


@dataclass(frozen=True)
class Part:
    """Pieza a cortar.

    `grain` (veta) en `True` impide girar la pieza 90°.
    `width` es el lado `l` (ancho) y `height` el lado `c` (largo) de Cortecloud.
    """

    width: float
    height: float
    quantity: int = 1
    grain: bool = False
    label: str = ""
    edges: EdgeBanding | None = None
    material: str = ""
    machining: Machining | None = None

    def __post_init__(self) -> None:
        if self.width <= 0 or self.height <= 0:
            raise ValueError(f"pieza con medida no positiva: {self.width}x{self.height}")
        if self.quantity < 1:
            raise ValueError(f"cantidad de pieza inválida: {self.quantity}")

    @property
    def area(self) -> float:
        return self.width * self.height

    @property
    def max_side(self) -> float:
        return max(self.width, self.height)

    @property
    def edges_text(self) -> str:
        return self.edges.describe() if self.edges else ""

    @property
    def invalid_reasons(self) -> tuple[str, ...]:
        """Mecanizado fuera del área: la pieza no se puede cortar."""
        if self.machining is None:
            return ()
        return tuple(self.machining.outside(self.width, self.height))


@dataclass(frozen=True)
class Sheet:
    """Tablero en stock."""

    width: float
    height: float
    thickness: float = 18.0
    kerf: float = 4.0
    label: str = ""
    material: str = ""

    def __post_init__(self) -> None:
        if self.width <= 0 or self.height <= 0:
            raise ValueError(f"tablero con medida no positiva: {self.width}x{self.height}")
        if self.kerf < 0:
            raise ValueError(f"kerf negativo: {self.kerf}")

    @property
    def area(self) -> float:
        return self.width * self.height


@dataclass(frozen=True)
class Constraints:
    """Perfil de restricciones de corte (por ejemplo Cortecloud/Madijal).

    Los valores por defecto son los observados en uso real y documentados en
    `docs/memoria/MEMORIA.md`; no son reglas del motor para todos los casos.
    """

    min_piece: float = 65.0
    min_machined_length: float = 250.0
    max_piece_width: float = 2480.0
    max_piece_height: float = 1810.0
    slot_widths: tuple[float, ...] = (5.7, 6.2, 6.7, 7.0, 9.7, 12.7, 15.7, 18.7, 25.7)
    horizontal_drill_diameters: tuple[float, ...] = (3.0, 8.0)
    vertical_drill_diameters: tuple[float, ...] = (3.0, 5.0, 8.0, 10.0, 15.0, 20.0, 35.0)

    def violations(self, part: Part) -> list[str]:
        """Restricciones que la pieza no cumple (lista vacía si cumple todas)."""
        problems: list[str] = []
        short_side = min(part.width, part.height)
        long_side = max(part.width, part.height)
        if short_side < self.min_piece:
            problems.append(
                f"pieza bajo el mínimo de corte ({self.min_piece:g} mm): "
                f"{short_side:g} mm en «{part.label or 'sin nombre'}»"
            )
        fits = (
            part.width <= self.max_piece_width and part.height <= self.max_piece_height
        ) or (
            part.height <= self.max_piece_width and part.width <= self.max_piece_height
        )
        if not fits:
            problems.append(
                f"pieza sobre el máximo ({self.max_piece_width:g}x{self.max_piece_height:g} mm): "
                f"{part.width:g}x{part.height:g} en «{part.label or 'sin nombre'}»"
            )
        if long_side < self.min_machined_length:
            problems.append(
                f"pieza mecanizada menor a {self.min_machined_length:g} mm: "
                f"{long_side:g} mm en «{part.label or 'sin nombre'}»"
            )
        problems.extend(self._machining_violations(part))
        return problems

    def _machining_violations(self, part: Part) -> list[str]:
        """Ranuras y barrenos del mecanizado que el perfil no admite."""
        machining = part.machining
        if machining is None:
            return []

        name = part.label or "sin nombre"
        problems: list[str] = []
        for width in machining.slot_widths:
            if not _is_allowed(width, self.slot_widths):
                problems.append(
                    f"ranura de {width:g} mm no permitida en «{name}» "
                    f"(permitidas: {_allowed_text(self.slot_widths)} mm)"
                )
        for label, diameters, allowed in (
            ("barreno horizontal", machining.horizontal_drills, self.horizontal_drill_diameters),
            ("barreno vertical", machining.vertical_drills, self.vertical_drill_diameters),
        ):
            for diameter in diameters:
                if not _is_allowed(diameter, allowed):
                    problems.append(
                        f"{label} Ø{diameter:g} mm no permitido en «{name}» "
                        f"(permitidos: {_allowed_text(allowed)} mm)"
                    )
        return problems


@dataclass(frozen=True)
class Rect:
    """Rectángulo libre dentro de un tablero (origen arriba a la izquierda)."""

    x: float
    y: float
    w: float
    h: float

    @property
    def right(self) -> float:
        return self.x + self.w

    @property
    def bottom(self) -> float:
        return self.y + self.h

    @property
    def area(self) -> float:
        return self.w * self.h

    def intersects(self, other: "Rect") -> bool:
        return (
            self.x < other.right - EPS
            and other.x < self.right - EPS
            and self.y < other.bottom - EPS
            and other.y < self.bottom - EPS
        )

    def contains(self, other: "Rect") -> bool:
        return (
            self.x <= other.x + EPS
            and self.y <= other.y + EPS
            and self.right >= other.right - EPS
            and self.bottom >= other.bottom - EPS
        )


@dataclass(frozen=True)
class Piece:
    """Una unidad física de una pieza (las cantidades se expanden antes de empacar)."""

    part: Part
    number: int

    @property
    def label(self) -> str:
        return f"P{self.number:02d}"


@dataclass
class Placement:
    """Ubicación de una pieza dentro de un tablero."""

    piece: Piece
    x: float
    y: float
    width: float
    height: float
    rotated: bool = False


@dataclass
class SheetLayout:
    """Un tablero con sus piezas colocadas."""

    index: int
    sheet: Sheet
    placements: list[Placement]
    algorithm: str

    @property
    def used_area(self) -> float:
        return sum(p.width * p.height for p in self.placements)

    @property
    def yield_percent(self) -> float:
        return round(100.0 * self.used_area / self.sheet.area, 2)


@dataclass(frozen=True)
class CutRow:
    """Renglón de la lista de corte (piezas iguales agrupadas)."""

    width: float
    height: float
    quantity: int
    label: str
    grain: bool
    edges: str
    area: float


@dataclass
class OptimizationResult:
    """Resultado completo de una optimización."""

    layouts: list[SheetLayout]
    unplaced: list[Piece]
    cut_list: list[CutRow]
    warnings: list[str]
    algorithm: str
    invalid: list[Piece] = field(default_factory=list)

    @property
    def yield_percent(self) -> float:
        used = sum(layout.used_area for layout in self.layouts)
        total = sum(layout.sheet.area for layout in self.layouts)
        return round(100.0 * used / total, 2) if total > 0 else 0.0

    @property
    def piece_count(self) -> int:
        return sum(len(layout.placements) for layout in self.layouts)

    def to_dict(self) -> dict:
        return {
            "algorithm": self.algorithm,
            "yield_percent": self.yield_percent,
            "sheets_used": len(self.layouts),
            "piece_count": self.piece_count,
            "unplaced": [piece.label for piece in self.unplaced],
            "invalid": [piece.label for piece in self.invalid],
            "warnings": self.warnings,
            "sheets": [
                {
                    "index": layout.index,
                    "label": layout.sheet.label,
                    "material": layout.sheet.material,
                    "width": layout.sheet.width,
                    "height": layout.sheet.height,
                    "thickness": layout.sheet.thickness,
                    "kerf": layout.sheet.kerf,
                    "pieces": len(layout.placements),
                    "yield_percent": layout.yield_percent,
                }
                for layout in self.layouts
            ],
            "cut_list": [
                {
                    "width": row.width,
                    "height": row.height,
                    "quantity": row.quantity,
                    "label": row.label,
                    "grain": row.grain,
                    "edges": row.edges,
                    "area": row.area,
                }
                for row in self.cut_list
            ],
        }


def orientations(part: Part, allow_rotation: bool) -> Iterator[tuple[float, float, bool]]:
    """Orientaciones posibles de una pieza: (ancho, alto, girada)."""
    yield part.width, part.height, False
    if allow_rotation and not part.grain and abs(part.width - part.height) > EPS:
        yield part.height, part.width, True
