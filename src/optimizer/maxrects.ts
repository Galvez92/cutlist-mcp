/**
 * Algoritmo no guillotina (MaxRects).
 *
 * Lista de rectángulos libres máximos: al colocar una pieza se recorta ese
 * rectángulo en hasta cuatro restos. Permite cortes en L (no guillotina), por
 * lo que suele aprovechar mejor el tablero, pero en una escuadradora de panel
 * el operario tiene que recurrir a una sierra de mano para separar la pieza.
 *
 * El kerf se maneja inflando cada pieza y el área útil en `kerf`: la reserva
 * queda a la derecha y abajo de cada pieza, así que la pieza real nunca sale
 * del área útil y entre dos piezas siempre hay al menos `kerf`.
 */

import { EPS } from "../geometry.js";
import type { Fit, PackContext, PackItem, SheetAlgorithm } from "./algorithm.js";
import { isBetterFit, rotationsFor } from "./algorithm.js";
import type { Rect } from "./rect.js";
import { rectArea, rectContains, rectsIntersect } from "./rect.js";

/** Recorta los rectángulos libres que toca la pieza y poda los contenidos. */
function splitFreeRects(freeRects: Rect[], used: Rect): void {
  const next: Rect[] = [];

  for (const free of freeRects) {
    if (!rectsIntersect(free, used)) {
      next.push(free);
      continue;
    }
    if (used.x - free.x > EPS) {
      next.push({ x: free.x, y: free.y, w: used.x - free.x, h: free.h });
    }
    const freeRight = free.x + free.w;
    const usedRight = used.x + used.w;
    if (freeRight - usedRight > EPS) {
      next.push({ x: usedRight, y: free.y, w: freeRight - usedRight, h: free.h });
    }
    if (used.y - free.y > EPS) {
      next.push({ x: free.x, y: free.y, w: free.w, h: used.y - free.y });
    }
    const freeBottom = free.y + free.h;
    const usedBottom = used.y + used.h;
    if (freeBottom - usedBottom > EPS) {
      next.push({
        x: free.x,
        y: usedBottom,
        w: free.w,
        h: freeBottom - usedBottom,
      });
    }
  }

  const pruned = next.filter(
    (candidate, index) =>
      !next.some(
        (other, otherIndex) =>
          otherIndex !== index &&
          rectContains(other, candidate) &&
          rectArea(other) > rectArea(candidate) + EPS,
      ),
  );

  freeRects.length = 0;
  freeRects.push(...pruned);
}

export const maxRectsAlgorithm: SheetAlgorithm = {
  kind: "maxrects",

  initFreeRects(usable: Rect, ctx: PackContext): Rect[] {
    return [
      { x: usable.x, y: usable.y, w: usable.w + ctx.kerf, h: usable.h + ctx.kerf },
    ];
  },

  findPlacement(
    freeRects: Rect[],
    item: PackItem,
    ctx: PackContext,
  ): Fit | null {
    const rotations = rotationsFor(item, ctx);
    let best: Fit | null = null;

    for (let i = 0; i < freeRects.length; i += 1) {
      const rect = freeRects[i];
      if (!rect) continue;

      for (const rotated of rotations) {
        const w = (rotated ? item.h : item.w) + ctx.kerf;
        const h = (rotated ? item.w : item.h) + ctx.kerf;
        if (w > rect.w + EPS || h > rect.h + EPS) continue;

        const leftoverW = rect.w - w;
        const leftoverH = rect.h - h;
        const fit: Fit = {
          rectIndex: i,
          rotated,
          w,
          h,
          short: Math.min(leftoverW, leftoverH),
          long: Math.max(leftoverW, leftoverH),
          rectArea: rect.w * rect.h,
        };
        if (isBetterFit(fit, best)) best = fit;
      }
    }

    return best;
  },

  commit(freeRects: Rect[], fit: Fit, _item: PackItem, _ctx: PackContext): void {
    const rect = freeRects[fit.rectIndex];
    if (!rect) return;
    splitFreeRects(freeRects, {
      x: rect.x,
      y: rect.y,
      w: fit.w,
      h: fit.h,
    });
  },
};
