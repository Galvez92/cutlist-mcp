/**
 * Utilidades de verificación para los tests: validez geométrica del layout y
 * comprobación de que un acomodo es realmente de guillotina.
 */

import { expect } from "vitest";

import { EPS, type Rect, type SheetLayout } from "../../src/index.js";

export function rectOf(placement: {
  x: number;
  y: number;
  width: number;
  height: number;
}): Rect {
  return {
    x: placement.x,
    y: placement.y,
    w: placement.width,
    h: placement.height,
  };
}

function overlaps(a: Rect, b: Rect): boolean {
  return (
    a.x < b.x + b.w - EPS &&
    b.x < a.x + a.w - EPS &&
    a.y < b.y + b.h - EPS &&
    b.y < a.y + a.h - EPS
  );
}

function gaps(a: Rect, b: Rect): { x: number; y: number } {
  const xGap = Math.max(b.x - (a.x + a.w), a.x - (b.x + b.w));
  const yGap = Math.max(b.y - (a.y + a.h), a.y - (b.y + b.h));
  return { x: xGap, y: yGap };
}

/**
 * Verifica una hoja: piezas dentro del área útil, sin solapes y con al menos
 * `kerf` de separación cuando las proyecciones se cruzan.
 */
export function assertSheetValid(sheet: SheetLayout): void {
  const margin = sheet.trim;
  const right = sheet.width - margin + EPS;
  const bottom = sheet.height - margin + EPS;

  for (const placement of sheet.placements) {
    expect(placement.width).toBeGreaterThan(0);
    expect(placement.height).toBeGreaterThan(0);
    expect(placement.x).toBeGreaterThanOrEqual(margin - EPS);
    expect(placement.y).toBeGreaterThanOrEqual(margin - EPS);
    expect(placement.x + placement.width).toBeLessThanOrEqual(right);
    expect(placement.y + placement.height).toBeLessThanOrEqual(bottom);
  }

  const rects = sheet.placements.map(rectOf);
  for (let i = 0; i < rects.length; i += 1) {
    for (let j = i + 1; j < rects.length; j += 1) {
      const a = rects[i];
      const b = rects[j];
      if (!a || !b) continue;
      expect(overlaps(a, b)).toBe(false);
      const gap = gaps(a, b);
      // Proyecciones cruzadas en un eje ⇒ separación ≥ kerf en el otro.
      if (gap.x < 0 && gap.y < 0) {
        throw new Error(
          `Piezas solapadas en la hoja ${sheet.index}: ${JSON.stringify(a)} / ${JSON.stringify(b)}`,
        );
      }
      if (gap.y < 0) expect(gap.x).toBeGreaterThanOrEqual(sheet.kerf - 1e-6);
      if (gap.x < 0) expect(gap.y).toBeGreaterThanOrEqual(sheet.kerf - 1e-6);
    }
  }
}

export function assertLayoutValid(sheetLayouts: SheetLayout[]): void {
  for (const sheet of sheetLayouts) assertSheetValid(sheet);
}

/**
 * ¿El conjunto de piezas se puede separar con cortes de guillotina?
 * Busca recursivamente un corte recto (vertical u horizontal) que atraviese
 * toda la región sin tocar ninguna pieza y que parta el conjunto en dos.
 */
export function isGuillotineCuttable(
  pieces: Rect[],
  bounds: Rect,
  failed: Set<string> = new Set(),
): boolean {
  if (pieces.length <= 1) return true;

  const key = pieces
    .map((piece) => `${piece.x},${piece.y},${piece.w},${piece.h}`)
    .sort()
    .join("|");
  if (failed.has(key)) return false;

  const tryAxis = (axis: "x" | "y"): boolean => {
    const positions = new Set<number>();
    for (const piece of pieces) {
      positions.add(axis === "x" ? piece.x : piece.y);
      positions.add(axis === "x" ? piece.x + piece.w : piece.y + piece.h);
    }
    for (const position of positions) {
      const lowerBound =
        axis === "x" ? bounds.x : bounds.y;
      const upperBound =
        axis === "x" ? bounds.x + bounds.w : bounds.y + bounds.h;
      if (position <= lowerBound + EPS || position >= upperBound - EPS) continue;

      const before: Rect[] = [];
      const after: Rect[] = [];
      let crosses = false;
      for (const piece of pieces) {
        const start = axis === "x" ? piece.x : piece.y;
        const end = axis === "x" ? piece.x + piece.w : piece.y + piece.h;
        if (start < position - EPS && end > position + EPS) {
          crosses = true;
          break;
        }
        if (end <= position + EPS) before.push(piece);
        else if (start >= position - EPS) after.push(piece);
      }
      if (crosses || before.length === 0 || after.length === 0) continue;

      const beforeBounds: Rect =
        axis === "x"
          ? { x: bounds.x, y: bounds.y, w: position - bounds.x, h: bounds.h }
          : { x: bounds.x, y: bounds.y, w: bounds.w, h: position - bounds.y };
      const afterBounds: Rect =
        axis === "x"
          ? {
              x: position,
              y: bounds.y,
              w: bounds.x + bounds.w - position,
              h: bounds.h,
            }
          : {
              x: bounds.x,
              y: position,
              w: bounds.w,
              h: bounds.y + bounds.h - position,
            };

      if (
        isGuillotineCuttable(before, beforeBounds, failed) &&
        isGuillotineCuttable(after, afterBounds, failed)
      ) {
        return true;
      }
    }
    return false;
  };

  const cuttable = tryAxis("x") || tryAxis("y");
  if (!cuttable) failed.add(key);
  return cuttable;
}

/** Rectángulo de área útil de una hoja (tablero menos recorte). */
export function usableRectOf(sheet: SheetLayout): Rect {
  return {
    x: sheet.trim,
    y: sheet.trim,
    w: sheet.width - sheet.trim * 2,
    h: sheet.height - sheet.trim * 2,
  };
}

// ── Constructores para las pruebas de DXF (rama formatos-import-export) ──
/** Construye objetos del motor (LayoutResult/SheetLayout/Placement) para las
 * pruebas de DXF, sin depender del optimizador. */
import type { LayoutResult, Placement } from "../../src/types.js";

export function makePlacement(args: {
  code: string;
  label?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  material?: string;
}): Placement {
  return {
    partId: args.code,
    code: args.code,
    label: args.label ?? args.code,
    x: args.x,
    y: args.y,
    width: args.width,
    height: args.height,
    rotated: false,
    grain: "none",
    grainInSheet: "none",
    edges: { top: 0, right: 0, bottom: 0, left: 0 },
    material: args.material,
    thickness: 18,
  };
}

export function makeSheet(args: {
  label: string;
  width: number;
  height: number;
  placements: Placement[];
  material?: string;
}): SheetLayout {
  return {
    sheetId: args.label,
    instance: 1,
    index: 1,
    label: args.label,
    width: args.width,
    height: args.height,
    thickness: 18,
    material: args.material,
    grain: "none",
    kerf: 3,
    trim: 0,
    placements: args.placements,
    usedArea: 0,
    sheetArea: 0,
    wasteArea: 0,
    yieldPct: 0,
  };
}

export function makeLayout(sheets: SheetLayout[]): LayoutResult {
  return {
    algorithm: "guillotine",
    ordering: "area",
    attempts: [],
    sheets,
    unplaced: [],
    cutList: [],
    labels: [],
    metrics: {
      distinctParts: 0,
      partInstances: 0,
      placed: 0,
      unplaced: 0,
      sheetsUsed: sheets.length,
      sheetArea: 0,
      usedArea: 0,
      wasteArea: 0,
      yieldPct: 0,
    },
    issues: [],
  };
}
