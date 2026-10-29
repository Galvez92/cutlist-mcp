/** Rectángulos en mm, con origen arriba-izquierda. */

import { EPS } from "../geometry.js";

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function rectArea(rect: Rect): number {
  return rect.w * rect.h;
}

/** ¿Se solapan? Rectángulos que se tocan no se consideran solapados. */
export function rectsIntersect(a: Rect, b: Rect): boolean {
  return (
    a.x < b.x + b.w - EPS &&
    b.x < a.x + a.w - EPS &&
    a.y < b.y + b.h - EPS &&
    b.y < a.y + a.h - EPS
  );
}

export function rectContains(outer: Rect, inner: Rect): boolean {
  return (
    inner.x >= outer.x - EPS &&
    inner.y >= outer.y - EPS &&
    inner.x + inner.w <= outer.x + outer.w + EPS &&
    inner.y + inner.h <= outer.y + outer.h + EPS
  );
}

/** Área útil: el tablero menos el margen de recorte de cada borde. */
export function insetRect(rect: Rect, margin: number): Rect {
  return {
    x: rect.x + margin,
    y: rect.y + margin,
    w: rect.w - margin * 2,
    h: rect.h - margin * 2,
  };
}
