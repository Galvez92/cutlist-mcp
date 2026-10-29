"""Motor de optimización de corte de tableros de cutlist-mcp.

API pública:

    from cutlist import Part, Sheet, optimize

    parts = [Part(width=600, height=732, label="costado")]
    sheets = [Sheet(width=2500, height=1830, thickness=18, kerf=4)]
    result = optimize(parts, sheets, algorithm="guillotine")
"""

from .models import (
    Constraints,
    CutRow,
    EdgeBanding,
    OptimizationResult,
    Part,
    Piece,
    Placement,
    Sheet,
    SheetLayout,
)
from .optimizer import ALGORITHMS, optimize
from .svg import render_svg

__all__ = [
    "ALGORITHMS",
    "Constraints",
    "CutRow",
    "EdgeBanding",
    "OptimizationResult",
    "Part",
    "Piece",
    "Placement",
    "Sheet",
    "SheetLayout",
    "optimize",
    "render_svg",
]
