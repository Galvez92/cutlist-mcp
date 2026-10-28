/** Construye objetos del motor (LayoutResult/SheetLayout/Placement) para las
 * pruebas de DXF, sin depender del optimizador. */
import type { LayoutResult, Placement, SheetLayout } from "../../src/types.js";

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
