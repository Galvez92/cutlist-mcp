"""Colocación guillotina.

Cada tablero se divide con cortes rectos de borde a borde: los espacios libres
que quedan siempre se pueden obtener con una guillotina, así que el operador
puede cortar sin desarmar la pieza de trabajo.
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
        rect = free.pop(index)
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
        free.extend(_split(rect, width, height, sheet.kerf))

    return placed, remaining


def _best_fit(
    free: Sequence[Rect], piece: Piece, allow_rotation: bool
) -> tuple[int, float, float, bool] | None:
    """Mejor hueco: menor área sobrante y, en empate, menor lado corto."""
    best = None
    best_score = None
    for index, rect in enumerate(free):
        for width, height, rotated in orientations(piece.part, allow_rotation):
            if width > rect.w + EPS or height > rect.h + EPS:
                continue
            score = (
                rect.area - width * height,
                min(rect.w - width, rect.h - height),
            )
            if best_score is None or score < best_score:
                best_score = score
                best = (index, width, height, rotated)
    return best


def _split(rect: Rect, width: float, height: float, kerf: float) -> list[Rect]:
    """Divide el hueco usado en dos rectángulos, respetando el kerf."""
    used_w = width + kerf if width + kerf <= rect.w + EPS else width
    used_h = height + kerf if height + kerf <= rect.h + EPS else height
    rem_w = rect.w - used_w
    rem_h = rect.h - used_h

    if rem_w >= rem_h:
        candidates = [
            Rect(rect.x + used_w, rect.y, rem_w, rect.h),
            Rect(rect.x, rect.y + used_h, width, rem_h),
        ]
    else:
        candidates = [
            Rect(rect.x + used_w, rect.y, rem_w, height),
            Rect(rect.x, rect.y + used_h, rect.w, rem_h),
        ]
    return [candidate for candidate in candidates if candidate.w > EPS and candidate.h > EPS]
