"""Motor de nesting por cortes de guillotina.

Estrategia: las piezas se ordenan de mayor a menor y cada una se ubica en el
rectángulo libre que deja el menor sobrante (best short side fit). Cada
rectángulo libre se divide en dos con un corte recto, de modo que el layout
resultante se puede cortar con sierra escuadradora (guillotina). El kerf queda
como separación entre piezas.

El resultado depende del orden de las piezas y de la dirección del corte, así
que se prueban varias combinaciones y se devuelve la que usa menos tableros y
aprovecha más material.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Callable

from .models import (
    MaterialLayout,
    OptimizeResult,
    Part,
    PlacedPart,
    SheetLayout,
    StockSheet,
)

EPS = 1e-9

# Criterios de orden (de mayor a menor prioridad).
_SORT_KEYS: tuple[Callable[[Part], tuple], ...] = (
    lambda p: (max(p.length, p.width), p.length * p.width),
    lambda p: (p.length * p.width, max(p.length, p.width)),
    lambda p: (p.length, p.width),
    lambda p: (p.width, p.length),
)

# Dirección del corte de guillotina al dividir el sobrante.
_SPLIT_MODES = ("auto", "vertical", "horizontal")


@dataclass
class _FreeRect:
    x: float
    y: float
    w: float
    h: float


def _orientations(part: Part, allow_rotation: bool):
    """Orientaciones posibles de la pieza: (largo, ancho, girada)."""
    yield part.length, part.width, False
    if allow_rotation and not part.grain and abs(part.length - part.width) > EPS:
        yield part.width, part.length, True


def _best_fit(free_rects: list[_FreeRect], part: Part, allow_rotation: bool):
    """Rectángulo libre y orientación con el menor sobrante."""
    best = None
    for index, rect in enumerate(free_rects):
        for length, width, rotated in _orientations(part, allow_rotation):
            if length <= rect.w + EPS and width <= rect.h + EPS:
                score = (
                    min(rect.w - length, rect.h - width),
                    max(rect.w - length, rect.h - width),
                )
                if best is None or score < best[0]:
                    best = (score, index, length, width, rotated)
    return best


def _split(
    free_rects: list[_FreeRect],
    rect: _FreeRect,
    length: float,
    width: float,
    kerf: float,
    mode: str,
) -> None:
    """Divide el rectángulo sobrante en dos con un corte de guillotina."""
    right = rect.w - length - kerf
    bottom = rect.h - width - kerf
    if mode == "vertical":
        vertical = True
    elif mode == "horizontal":
        vertical = False
    else:
        vertical = right >= bottom
    if vertical:
        if right > EPS:
            free_rects.append(_FreeRect(rect.x + length + kerf, rect.y, right, rect.h))
        if bottom > EPS:
            free_rects.append(_FreeRect(rect.x, rect.y + width + kerf, length, bottom))
    else:
        if right > EPS:
            free_rects.append(_FreeRect(rect.x + length + kerf, rect.y, right, width))
        if bottom > EPS:
            free_rects.append(_FreeRect(rect.x, rect.y + width + kerf, rect.w, bottom))


def _expand(parts: list[Part]) -> list[Part]:
    """Una copia por unidad física (cantidad expandida)."""
    copies: list[Part] = []
    for part in parts:
        for _ in range(max(1, part.qty)):
            copies.append(part)
    return copies


def _place(
    sheet: SheetLayout,
    free_rects: list[_FreeRect],
    part: Part,
    allow_rotation: bool,
    kerf: float,
    mode: str,
) -> bool:
    fit = _best_fit(free_rects, part, allow_rotation)
    if fit is None:
        return False
    _, index, length, width, rotated = fit
    rect = free_rects.pop(index)
    sheet.placements.append(
        PlacedPart(
            ref=part.ref,
            name=part.name,
            part_ref=part.ref,
            material=part.material,
            x=rect.x,
            y=rect.y,
            length=length,
            width=width,
            rotated=rotated,
            edges=dict(part.edges),
        )
    )
    _split(free_rects, rect, length, width, kerf, mode)
    return True


def _optimize_once(
    parts: list[Part],
    stocks: list[StockSheet],
    kerf: float,
    allow_rotation: bool,
    sort_key: Callable[[Part], tuple],
    split_mode: str,
) -> OptimizeResult:
    stock_by_material = {stock.material: stock for stock in stocks}
    by_material: dict[str, list[Part]] = {}
    for part in parts:
        by_material.setdefault(part.material, []).append(part)

    result = OptimizeResult()

    for material, group in by_material.items():
        stock = stock_by_material.get(material)
        if stock is None:
            result.unplaced.extend(
                {
                    "ref": part.ref,
                    "name": part.name,
                    "material": material,
                    "reason": "sin tablero definido para el material",
                }
                for part in group
            )
            continue

        stock = StockSheet(
            material=stock.material,
            length=stock.length,
            width=stock.width,
            thickness=stock.thickness,
            kerf=kerf,
        )
        layout = MaterialLayout(material=material, stock=stock)
        free_rects: list[list[_FreeRect]] = []

        copies = _expand(group)
        copies.sort(key=sort_key, reverse=True)

        for part in copies:
            placed = False
            for sheet, rects in zip(layout.sheets, free_rects):
                if _place(sheet, rects, part, allow_rotation, kerf, split_mode):
                    placed = True
                    break
            if placed:
                continue
            sheet = SheetLayout(index=len(layout.sheets) + 1, stock=stock)
            rects = [_FreeRect(0.0, 0.0, stock.length, stock.width)]
            if _place(sheet, rects, part, allow_rotation, kerf, split_mode):
                layout.sheets.append(sheet)
                free_rects.append(rects)
            else:
                result.unplaced.append(
                    {
                        "ref": part.ref,
                        "name": part.name,
                        "material": material,
                        "reason": "la pieza no cabe en el tablero",
                    }
                )

        result.groups.append(layout)

    return result


def _score(result: OptimizeResult) -> tuple:
    """Menos piezas sin ubicar, menos tableros y más aprovechamiento."""
    return (len(result.unplaced), len(result.sheets), -round(result.yield_pct, 4))


def optimize(
    parts: list[Part],
    stocks: list[StockSheet],
    kerf: float = 4.0,
    allow_rotation: bool = True,
) -> OptimizeResult:
    """Ubica las piezas en tableros, agrupadas por material."""
    best: OptimizeResult | None = None
    for sort_key in _SORT_KEYS:
        for split_mode in _SPLIT_MODES:
            candidate = _optimize_once(parts, stocks, kerf, allow_rotation, sort_key, split_mode)
            if best is None or _score(candidate) < _score(best):
                best = candidate
    assert best is not None
    return best
