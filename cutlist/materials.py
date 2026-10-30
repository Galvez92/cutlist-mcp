"""Optimización por material.

Cada material se corta de su propio tablero, así que se optimiza grupo por grupo
y luego se juntan los tableros en un solo resultado (el que se pinta). Un grupo
puede tener varios stocks del mismo material (medidas distintas): el optimizador
los usa en orden hasta colocar todas las piezas.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol, Sequence

from .models import Constraints, OptimizationResult, Part, Sheet, SheetLayout
from .optimizer import optimize


class MaterialGroupLike(Protocol):
    """Grupo de piezas de un mismo material con los stocks donde se cortan."""

    material: str
    parts: list[Part]

    @property
    def sheets(self) -> list[Sheet]: ...


@dataclass(frozen=True)
class MaterialSummary:
    material: str
    yield_percent: float
    sheets_used: int
    piece_count: int
    unplaced: int
    invalid: int = 0


@dataclass(frozen=True)
class MaterialOptimization:
    result: OptimizationResult
    materials: list[MaterialSummary]

    def to_dict(self) -> dict:
        payload = self.result.to_dict()
        payload["materials"] = [
            {
                "material": summary.material,
                "yield_percent": summary.yield_percent,
                "sheets_used": summary.sheets_used,
                "piece_count": summary.piece_count,
                "unplaced": summary.unplaced,
                "invalid": summary.invalid,
            }
            for summary in self.materials
        ]
        return payload


def optimize_by_material(
    groups: Sequence[MaterialGroupLike],
    algorithm: str = "guillotine",
    constraints: Constraints | None = None,
    max_sheets: int = 30,
) -> MaterialOptimization:
    """Optimiza cada grupo sobre sus stocks y devuelve el resultado unido."""
    layouts: list[SheetLayout] = []
    unplaced = []
    invalid = []
    cut_rows = []
    warnings: list[str] = []
    summaries: list[MaterialSummary] = []

    for group in groups:
        result = optimize(
            group.parts,
            list(group.sheets),
            algorithm=algorithm,
            constraints=constraints,
            max_sheets=max_sheets,
        )
        for layout in result.layouts:
            layouts.append(
                SheetLayout(
                    index=len(layouts) + 1,
                    sheet=layout.sheet,
                    placements=layout.placements,
                    algorithm=layout.algorithm,
                )
            )
        unplaced.extend(result.unplaced)
        invalid.extend(result.invalid)
        cut_rows.extend(result.cut_list)
        for warning in result.warnings:
            if warning not in warnings:
                warnings.append(warning)
        summaries.append(
            MaterialSummary(
                material=group.material,
                yield_percent=result.yield_percent,
                sheets_used=len(result.layouts),
                piece_count=result.piece_count,
                unplaced=len(result.unplaced),
                invalid=len(result.invalid),
            )
        )

    return MaterialOptimization(
        result=OptimizationResult(
            layouts=layouts,
            unplaced=unplaced,
            cut_list=cut_rows,
            warnings=warnings,
            algorithm=algorithm,
            invalid=invalid,
        ),
        materials=summaries,
    )
