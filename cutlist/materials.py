"""Optimización por material.

Cada material se corta de su propio tablero, así que se optimiza grupo por grupo
y luego se juntan los tableros en un solo resultado (el que se pinta).
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Sequence

from .cortecloud import MaterialGroup
from .models import Constraints, OptimizationResult, SheetLayout
from .optimizer import optimize


@dataclass(frozen=True)
class MaterialSummary:
    material: str
    yield_percent: float
    sheets_used: int
    piece_count: int
    unplaced: int


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
            }
            for summary in self.materials
        ]
        return payload


def optimize_by_material(
    groups: Sequence[MaterialGroup],
    algorithm: str = "guillotine",
    constraints: Constraints | None = None,
    max_sheets: int = 30,
) -> MaterialOptimization:
    """Optimiza cada grupo sobre su tablero y devuelve el resultado unido."""
    layouts: list[SheetLayout] = []
    unplaced = []
    cut_rows = []
    warnings: list[str] = []
    summaries: list[MaterialSummary] = []

    for group in groups:
        result = optimize(
            group.parts,
            [group.sheet],
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
            )
        )

    return MaterialOptimization(
        result=OptimizationResult(
            layouts=layouts,
            unplaced=unplaced,
            cut_list=cut_rows,
            warnings=warnings,
            algorithm=algorithm,
        ),
        materials=summaries,
    )
