"""Colocación no guillotina (MaxRects).

Los espacios libres pueden quedar en forma de L, lo que permite mejores
aprovechamientos que la guillotina cuando el orden de los cortes no está
restringido.
"""

from __future__ import annotations

from typing import Sequence

from .models import EPS, Piece, Placement, Rect, Sheet, orientations


def pack(
    pieces: Sequence[Piece], sheet: Sheet, allow_rotation: bool = True
) -> tuple[list[Placement], list[Piece]]:
    """Coloca piezas en un tablero. Devuelve (colocadas, sobrantes)."""
    free: list[Rect] = [Rect(0.0, 0.0, sheet.width, sheet.height)]
    placed: list[Placement] = []
    remaining: list[Piece] = []

    for piece in pieces:
        best = _best_fit(free, piece, allow_rotation)
        if best is None:
            remaining.append(piece)
            continue
        index, width, height, rotated = best
        rect = free[index]
        placed.append(
            Placement(
                piece=piece,
                x=rect.x,
                y=rect.y,
                width=width,
                height=height,
                rotated=rotated,
            )
        )
        used = Rect(
            rect.x,
            rect.y,
            min(rect.w, width + sheet.kerf),
            min(rect.h, height + sheet.kerf),
        )
        free = _prune([sub for candidate in free for sub in _subtract(candidate, used)])

    return placed, remaining


def _best_fit(
    free: Sequence[Rect], piece: Piece, allow_rotation: bool
) -> tuple[int, float, float, bool] | None:
    """Mejor hueco: mejor ajuste del lado corto (best short side fit)."""
    best = None
    best_score = None
    for index, rect in enumerate(free):
        for width, height, rotated in orientations(piece.part, allow_rotation):
            if width > rect.w + EPS or height > rect.h + EPS:
                continue
            leftover_w = rect.w - width
            leftover_h = rect.h - height
            score = (min(leftover_w, leftover_h), max(leftover_w, leftover_h))
            if best_score is None or score < best_score:
                best_score = score
                best = (index, width, height, rotated)
    return best


def _subtract(free_rect: Rect, used: Rect) -> list[Rect]:
    """Parte un hueco libre alrededor del bloque recién usado."""
    if not free_rect.intersects(used):
        return [free_rect]

    parts: list[Rect] = []
    above = used.y - free_rect.y
    if above > EPS:
        parts.append(Rect(free_rect.x, free_rect.y, free_rect.w, above))
    below = free_rect.bottom - used.bottom
    if below > EPS:
        parts.append(Rect(free_rect.x, used.bottom, free_rect.w, below))
    left = used.x - free_rect.x
    if left > EPS:
        parts.append(Rect(free_rect.x, free_rect.y, left, free_rect.h))
    right = free_rect.right - used.right
    if right > EPS:
        parts.append(Rect(used.right, free_rect.y, right, free_rect.h))
    return parts


def _prune(rects: Sequence[Rect]) -> list[Rect]:
    """Quita huecos contenidos en otro mayor."""
    pruned: list[Rect] = []
    for index, rect in enumerate(rects):
        if any(
            other.area > rect.area + EPS and other.contains(rect)
            for other_index, other in enumerate(rects)
            if other_index != index
        ):
            continue
        pruned.append(rect)
    return pruned
