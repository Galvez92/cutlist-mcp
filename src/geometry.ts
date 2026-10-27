/** Utilidades geométricas y de veta/cantos compartidas por el motor. */

import type {
  EdgeBanding,
  EdgeSide,
  GrainDirection,
  Part,
} from "./types.js";

/** Tolerancia en mm para comparaciones geométricas. */
export const EPS = 1e-6;

export const EDGE_SIDES: readonly EdgeSide[] = ["top", "right", "bottom", "left"];

/** Nombre en español de cada lado (etiquetas y lista de corte). */
export const EDGE_SIDE_NAMES: Record<EdgeSide, string> = {
  top: "arriba",
  right: "derecha",
  bottom: "abajo",
  left: "izquierda",
};

export function emptyEdges(): EdgeBanding {
  return { top: 0, right: 0, bottom: 0, left: 0 };
}

/**
 * Lado de la hoja que ocupa cada lado de la pieza cuando la pieza se gira 90°
 * en sentido horario: arriba→derecha, derecha→abajo, abajo→izquierda,
 * izquierda→arriba.
 */
export function sheetSideOfPartEdge(edge: EdgeSide, rotated: boolean): EdgeSide {
  if (!rotated) return edge;
  switch (edge) {
    case "top":
      return "right";
    case "right":
      return "bottom";
    case "bottom":
      return "left";
    case "left":
      return "top";
  }
}

/**
 * ¿Se puede girar la pieza 90° sobre este tablero?
 * - Sin veta en la pieza: siempre (si el usuario permite girar).
 * - Con veta en la pieza: solo si el tablero tampoco tiene veta.
 */
export function isRotatable(
  partGrain: GrainDirection,
  sheetGrain: GrainDirection,
  allowRotation: boolean,
): boolean {
  if (!allowRotation) return false;
  if (partGrain === "none") return true;
  return sheetGrain === "none";
}

/**
 * ¿La veta de la pieza es compatible con la del tablero?
 * Sin veta en cualquiera de los dos, siempre es compatible.
 */
export function isCompatibleGrain(
  partGrain: GrainDirection,
  sheetGrain: GrainDirection,
): boolean {
  if (partGrain === "none" || sheetGrain === "none") return true;
  return partGrain === sheetGrain;
}

/** Dirección de la veta dentro de la hoja (la pieza puede estar girada). */
export function grainInSheet(
  partGrain: GrainDirection,
  rotated: boolean,
): GrainDirection {
  if (partGrain === "none") return "none";
  if (!rotated) return partGrain;
  return partGrain === "horizontal" ? "vertical" : "horizontal";
}

/** Medidas terminadas: medidas de corte menos el canto de cada lado. */
export function finishedDimensions(
  part: Pick<Part, "width" | "height" | "edges">,
): { width: number; height: number } {
  return {
    width: part.width - part.edges.left - part.edges.right,
    height: part.height - part.edges.top - part.edges.bottom,
  };
}

/** ¿La pieza lleva algún canto? */
export function hasBanding(edges: EdgeBanding): boolean {
  return EDGE_SIDES.some((side) => edges[side] > 0);
}

/** Resumen legible de cantos: `arriba 0.4 mm · izquierda 0.4 mm`. */
export function edgeSummary(edges: EdgeBanding): string {
  const parts = EDGE_SIDES.filter((side) => edges[side] > 0).map(
    (side) => `${EDGE_SIDE_NAMES[side]} ${formatMm(edges[side])} mm`,
  );
  return parts.join(" · ");
}

/** Formatea milímetros sin decimales sobrantes (1173.5 -> "1173.5"). */
export function formatMm(value: number): string {
  const rounded = Math.round(value * 100) / 100;
  return `${rounded}`;
}

/** Formatea un porcentaje con un decimal. */
export function formatPct(value: number): string {
  return `${Math.round(value * 10) / 10} %`;
}

/** Redondea a 2 decimales (porcentajes y áreas del resultado). */
export function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
