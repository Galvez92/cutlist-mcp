"""Asignación de materiales: qué stock se corta para cada pieza.

El motor recibe las piezas —cada una con su `material`— y un catálogo de stocks
(`Sheet` con `material`, medidas, espesor y kerf). Cada pieza se corta del stock
de su material; un mismo material puede tener varios stocks (medidas distintas)
y el optimizador los usa en el orden del catálogo.

Reglas, en este orden:
1. Pieza con material: los stocks de ese material, sin distinguir mayúsculas,
   acentos ni espacios de más.
2. Si no hay stock de ese material: un stock comodín, es decir uno con
   `material` vacío (sirve para cualquier pieza).
3. Una pieza sin material va al comodín; si no hay comodín y el catálogo tiene
   un solo stock, va a ese stock.
4. En cualquier otro caso la pieza queda sin asignar y se avisa qué material
   falta; nunca se mezclan dos materiales en el mismo tablero.
"""

from __future__ import annotations

import unicodedata
from dataclasses import dataclass, field
from typing import Sequence

from .materials import MaterialOptimization, optimize_by_material
from .models import Constraints, Part, Sheet
from .optimizer import expand_pieces


def normalize_material(name: str) -> str:
    """Texto comparable de un material: sin mayúsculas, acentos ni espacios de más."""
    decomposed = unicodedata.normalize("NFKD", str(name or ""))
    plain = decomposed.encode("ascii", "ignore").decode("ascii")
    return " ".join(plain.split()).lower()


@dataclass(frozen=True)
class StockGroup:
    """Piezas de un mismo material y los stocks de los que se cortan."""

    material: str
    sheets: list[Sheet]
    parts: list[Part]

    @property
    def piece_count(self) -> int:
        return sum(part.quantity for part in self.parts)


@dataclass
class StockAssignment:
    """Reparto de las piezas entre los stocks del catálogo."""

    groups: list[StockGroup] = field(default_factory=list)
    unassigned: list[Part] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)


def group_by_stock(parts: Sequence[Part], sheets: Sequence[Sheet]) -> StockAssignment:
    """Agrupa las piezas por material y les asigna su stock."""
    sheets = list(sheets)
    if not sheets:
        raise ValueError("se requiere al menos un stock")

    generic = [sheet for sheet in sheets if not normalize_material(sheet.material)]
    named: dict[str, tuple[str, list[Sheet]]] = {}
    for sheet in sheets:
        key = normalize_material(sheet.material)
        if key:
            named.setdefault(key, (sheet.material.strip(), []))[1].append(sheet)
    single = sheets[0] if len(sheets) == 1 else None

    grouped: dict[str, tuple[list[Sheet], list[Part]]] = {}
    unassigned: list[Part] = []
    missing: dict[str, int] = {}
    without_material = 0

    for part in parts:
        key = normalize_material(part.material)
        if key and key in named:
            material, stock_sheets = named[key]
        elif generic:
            material, stock_sheets = part.material.strip() or "sin material", generic
        elif not key and single is not None:
            material, stock_sheets = "sin material", [single]
        else:
            unassigned.append(part)
            if key:
                missing[part.material.strip()] = missing.get(part.material.strip(), 0) + part.quantity
            else:
                without_material += part.quantity
            continue
        grouped.setdefault(material, (stock_sheets, []))[1].append(part)

    available = ", ".join(material for material, _ in named.values()) or "ninguno"
    warnings = [
        f"{quantity} pieza(s) del material «{material}» sin ubicar: no hay stock de ese "
        f"material (stocks con material: {available})"
        for material, quantity in missing.items()
    ]
    if without_material:
        warnings.append(
            f"{without_material} pieza(s) sin material sin ubicar: hay varios stocks y ninguno "
            f"es comodín; indica el material de la pieza o agrega un stock sin material "
            f"(stocks con material: {available})"
        )

    return StockAssignment(
        groups=[
            StockGroup(material=material, sheets=stock_sheets, parts=group_parts)
            for material, (stock_sheets, group_parts) in grouped.items()
        ],
        unassigned=unassigned,
        warnings=warnings,
    )


def optimize_with_stock(
    parts: Sequence[Part],
    sheets: Sequence[Sheet],
    algorithm: str = "guillotine",
    constraints: Constraints | None = None,
    max_sheets: int = 30,
) -> MaterialOptimization:
    """Asigna cada pieza al stock de su material y optimiza material por material."""
    assignment = group_by_stock(parts, sheets)
    optimization = optimize_by_material(
        assignment.groups,
        algorithm=algorithm,
        constraints=constraints,
        max_sheets=max_sheets,
    )
    result = optimization.result
    result.unplaced = [*result.unplaced, *expand_pieces(assignment.unassigned)]
    result.warnings = [*assignment.warnings, *result.warnings]
    return optimization
