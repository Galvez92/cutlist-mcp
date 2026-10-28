"""Modelos de datos del optimizador (unidades: milímetros)."""

from __future__ import annotations

from dataclasses import dataclass, field


@dataclass(frozen=True)
class Part:
    """Pieza a cortar."""

    ref: str
    name: str
    length: float  # medida a lo largo de la veta por defecto (campo `c` en Cortecloud)
    width: float  # campo `l` en Cortecloud
    material: str
    qty: int = 1
    grain: bool = True  # True = veta obligatoria a lo largo de `length`, no se gira
    edges: dict = field(default_factory=dict)


@dataclass(frozen=True)
class StockSheet:
    """Tablero en stock."""

    material: str
    length: float
    width: float
    thickness: float
    kerf: float = 4.0

    @property
    def area(self) -> float:
        return self.length * self.width


@dataclass
class PlacedPart:
    """Pieza ubicada dentro de una hoja."""

    ref: str
    name: str
    part_ref: str
    material: str
    x: float
    y: float
    length: float
    width: float
    rotated: bool = False
    edges: dict = field(default_factory=dict)

    @property
    def area(self) -> float:
        return self.length * self.width


@dataclass
class SheetLayout:
    """Una hoja (tablero) con sus piezas."""

    index: int
    stock: StockSheet
    placements: list[PlacedPart] = field(default_factory=list)

    @property
    def used_area(self) -> float:
        return sum(p.area for p in self.placements)

    @property
    def used_pct(self) -> float:
        if not self.stock.area:
            return 0.0
        return self.used_area / self.stock.area * 100


@dataclass
class MaterialLayout:
    """Resultado del nesting para un material."""

    material: str
    stock: StockSheet
    sheets: list[SheetLayout] = field(default_factory=list)

    @property
    def yield_pct(self) -> float:
        total = sum(s.stock.area for s in self.sheets)
        if not total:
            return 0.0
        return sum(s.used_area for s in self.sheets) / total * 100


@dataclass
class OptimizeResult:
    groups: list[MaterialLayout] = field(default_factory=list)
    unplaced: list[dict] = field(default_factory=list)

    @property
    def sheets(self) -> list[SheetLayout]:
        return [s for g in self.groups for s in g.sheets]

    @property
    def part_count(self) -> int:
        return sum(len(s.placements) for s in self.sheets)

    @property
    def yield_pct(self) -> float:
        total = sum(s.stock.area for s in self.sheets)
        if not total:
            return 0.0
        return sum(s.used_area for s in self.sheets) / total * 100
