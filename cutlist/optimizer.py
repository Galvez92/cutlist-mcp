"""Orquestación del nesting.

Expande cantidades, reparte las piezas entre tableros, calcula el
aprovechamiento, la lista de corte y los avisos del perfil de restricciones.
"""

from __future__ import annotations

from typing import Callable, Sequence

from . import guillotine, maxrects
from .models import (
    Constraints,
    CutRow,
    OptimizationResult,
    Part,
    Piece,
    Placement,
    Sheet,
    SheetLayout,
)

Pack = Callable[[Sequence[Piece], Sheet, bool], tuple[list[Placement], list[Piece]]]

ALGORITHMS: dict[str, Pack] = {
    "guillotine": guillotine.pack,
    "nonguillotine": maxrects.pack,
}


def optimize(
    parts: Sequence[Part],
    sheets: Sequence[Sheet],
    algorithm: str = "guillotine",
    allow_rotation: bool = True,
    max_sheets: int = 30,
    constraints: Constraints | None = None,
) -> OptimizationResult:
    """Optimiza el corte de `parts` sobre los tableros de `sheets`."""
    if algorithm not in ALGORITHMS:
        raise ValueError(
            f"algoritmo desconocido: {algorithm!r} (opciones: {', '.join(ALGORITHMS)})"
        )
    if not sheets:
        raise ValueError("se requiere al menos un tablero en stock")
    if max_sheets < 1:
        raise ValueError(f"max_sheets inválido: {max_sheets}")

    pack = ALGORITHMS[algorithm]
    pending = sorted(
        expand_pieces(parts), key=lambda piece: (-piece.part.max_side, -piece.part.area)
    )
    layouts: list[SheetLayout] = []

    while pending and len(layouts) < max_sheets:
        progress = False
        for sheet in sheets:
            if not pending or len(layouts) >= max_sheets:
                break
            placed, pending = pack(pending, sheet, allow_rotation)
            if placed:
                layouts.append(
                    SheetLayout(
                        index=len(layouts) + 1,
                        sheet=sheet,
                        placements=placed,
                        algorithm=algorithm,
                    )
                )
                progress = True
        if not progress:
            break

    return OptimizationResult(
        layouts=layouts,
        unplaced=list(pending),
        cut_list=_cut_list(layouts),
        warnings=_warnings(pending, parts, constraints),
        algorithm=algorithm,
    )


def expand_pieces(parts: Sequence[Part]) -> list[Piece]:
    """Una `Piece` por unidad física de cada pieza."""
    pieces: list[Piece] = []
    for part in parts:
        for _ in range(part.quantity):
            pieces.append(Piece(part=part, number=len(pieces) + 1))
    return pieces


def _cut_list(layouts: Sequence[SheetLayout]) -> list[CutRow]:
    groups: dict[tuple, int] = {}
    for layout in layouts:
        for placement in layout.placements:
            part = placement.piece.part
            key = (part.width, part.height, part.label, part.grain, part.edges_text)
            groups[key] = groups.get(key, 0) + 1

    rows = [
        CutRow(
            width=width,
            height=height,
            quantity=quantity,
            label=label,
            grain=grain,
            edges=edges,
            area=round(width * height * quantity, 2),
        )
        for (width, height, label, grain, edges), quantity in groups.items()
    ]
    rows.sort(key=lambda row: (-row.area, row.label, row.width, row.height))
    return rows


def _warnings(
    unplaced: Sequence[Piece], parts: Sequence[Part], constraints: Constraints | None
) -> list[str]:
    warnings: list[str] = []
    seen: set[str] = set()

    if unplaced:
        warnings.append(
            f"{len(unplaced)} pieza(s) sin ubicar: no caben en el stock indicado "
            f"o se alcanzó el máximo de tableros (por ejemplo {unplaced[0].label})"
        )

    if constraints is not None:
        for part in parts:
            for problem in constraints.violations(part):
                if problem not in seen:
                    seen.add(problem)
                    warnings.append(problem)

    return warnings
