"""Modelos de datos del motor de corte.

Todas las medidas están en milímetros. Los nombres de los cantos (`c1`, `c2`,
`l1`, `l2`) siguen el formato real de Cortecloud documentado en
`docs/memoria/MEMORIA.md`.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Iterator

EPS = 1e-9


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


@dataclass(frozen=True)
class Sheet:
    """Tablero en stock."""

    width: float
    height: float
    thickness: float = 18.0
    kerf: float = 4.0
    label: str = ""

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
            "warnings": self.warnings,
            "sheets": [
                {
                    "index": layout.index,
                    "label": layout.sheet.label,
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
