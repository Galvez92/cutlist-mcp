/**
 * Algoritmo guillotina.
 *
 * Mantiene, por hoja, una lista de rectángulos libres que no se solapan y que
 * provienen siempre de cortes de guillotina: cada rectángulo es una hoja (hoja
 * de la partición) y se parte con un corte que lo atraviesa de lado a lado.
 * La pieza se coloca en la esquina superior izquierda del rectángulo elegido,
 * de modo que las dos partes resultantes siguen siendo cortes rectos de
 * guillotina (no hay cortes en L).
 */

import { EPS } from "../geometry.js";
import type { Fit, PackContext, PackItem, SheetAlgorithm } from "./algorithm.js";
import { isBetterFit, rotationsFor } from "./algorithm.js";
import type { Rect } from "./rect.js";

/**
 * Kerf que hay que reservar a la derecha (o abajo) de la pieza: 0 cuando la
 * pieza consume el rectángulo completo, porque entonces queda a ras del borde
 * del rectángulo (que ya está separado del resto).
 */
function reservedKerf(available: number, piece: number, kerf: number): number {
  return available - piece > EPS ? kerf : 0;
}

export const guillotineAlgorithm: SheetAlgorithm = {
  kind: "guillotine",

  initFreeRects(usable: Rect): Rect[] {
    return [{ ...usable }];
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
        const w = rotated ? item.h : item.w;
        const h = rotated ? item.w : item.h;
        const needW = w + reservedKerf(rect.w, w, ctx.kerf);
        const needH = h + reservedKerf(rect.h, h, ctx.kerf);
        if (needW > rect.w + EPS || needH > rect.h + EPS) continue;

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

  commit(freeRects: Rect[], fit: Fit, _item: PackItem, ctx: PackContext): void {
    const rect = freeRects[fit.rectIndex];
    if (!rect) return;
    freeRects.splice(fit.rectIndex, 1);

    const restW = rect.w - fit.w;
    const restH = rect.h - fit.h;
    const kerfRight = restW > EPS ? ctx.kerf : 0;
    const kerfBottom = restH > EPS ? ctx.kerf : 0;
    const rightW = restW - kerfRight;
    const bottomH = restH - kerfBottom;

    // S1: corte horizontal (la banda inferior ocupa todo el ancho) y luego
    //     corte vertical en la fila de la pieza.
    // S2: corte vertical (la banda derecha ocupa todo el alto) y luego corte
    //     horizontal en la columna de la pieza.
    // Se elige la variante que deja más área libre (reserva menos kerf).
    const freeAreaS1 =
      (rightW > EPS ? rightW * fit.h : 0) + (bottomH > EPS ? rect.w * bottomH : 0);
    const freeAreaS2 =
      (rightW > EPS ? rightW * rect.h : 0) + (bottomH > EPS ? fit.w * bottomH : 0);

    if (freeAreaS1 >= freeAreaS2) {
      if (rightW > EPS) {
        freeRects.push({
          x: rect.x + fit.w + kerfRight,
          y: rect.y,
          w: rightW,
          h: fit.h,
        });
      }
      if (bottomH > EPS) {
        freeRects.push({
          x: rect.x,
          y: rect.y + fit.h + kerfBottom,
          w: rect.w,
          h: bottomH,
        });
      }
      return;
    }

    if (rightW > EPS) {
      freeRects.push({
        x: rect.x + fit.w + kerfRight,
        y: rect.y,
        w: rightW,
        h: rect.h,
      });
    }
    if (bottomH > EPS) {
      freeRects.push({
        x: rect.x,
        y: rect.y + fit.h + kerfBottom,
        w: fit.w,
        h: bottomH,
      });
    }
  },
};
