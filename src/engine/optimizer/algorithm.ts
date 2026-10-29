/**
 * Interfaz común de los algoritmos de acomodo.
 *
 * Un algoritmo mantiene, por hoja, una lista de rectángulos libres. La
 * búsqueda (`findPlacement`) no muta el estado; la mutación ocurre en
 * `commit`, de modo que el mismo paquete pueda usarse para "probar" si una
 * pieza cabe en una hoja vacía sin abrirla.
 */

import { EPS, isRotatable } from "../geometry.js";
import type { AlgorithmKind, GrainDirection } from "../types.js";
import type { Rect } from "./rect.js";

/** Pieza a acomodar (medidas reales, sin kerf). */
export interface PackItem {
  /** Clave única de la instancia (parte id + nº de instancia). */
  key: string;
  w: number;
  h: number;
  grain: GrainDirection;
}

/** Contexto de la hoja que se está llenando. */
export interface PackContext {
  kerf: number;
  allowRotation: boolean;
  sheetGrain: GrainDirection;
  /** Área útil de la hoja (tablero menos `trim`). */
  usable: Rect;
}

/**
 * Hueco elegido. `w`/`h` son las medidas usadas internamente por el algoritmo
 * (MaxRects las infla con el kerf), así que el llamador NO debe usarlas para
 * dibujar: las medidas reales son `item.w`/`item.h` según `rotated`.
 */
export interface Fit {
  /** Índice del rectángulo libre usado. */
  rectIndex: number;
  rotated: boolean;
  w: number;
  h: number;
  /** Lado corto sobrante (criterio principal). */
  short: number;
  /** Lado largo sobrante (desempate). */
  long: number;
  /** Área del rectángulo libre (segundo desempate). */
  rectArea: number;
}

export interface SheetAlgorithm {
  kind: AlgorithmKind;
  /** Estado inicial de rectángulos libres de una hoja. */
  initFreeRects(usable: Rect, ctx: PackContext): Rect[];
  /** Mejor hueco para la pieza, o `null` si no cabe. */
  findPlacement(freeRects: Rect[], item: PackItem, ctx: PackContext): Fit | null;
  /** Consume el hueco elegido y actualiza los rectángulos libres. */
  commit(freeRects: Rect[], fit: Fit, item: PackItem, ctx: PackContext): void;
}

/** Orientaciones a probar: solo se gira si la veta lo permite. */
export function rotationsFor(item: PackItem, ctx: PackContext): boolean[] {
  if (Math.abs(item.w - item.h) <= EPS) return [false];
  return isRotatable(item.grain, ctx.sheetGrain, ctx.allowRotation)
    ? [false, true]
    : [false];
}

/**
 * Criterio de elección: Best-Short-Side-Fit (minimiza el lado corto sobrante),
 * con desempate por lado largo y luego por rectángulo más ajustado.
 */
export function isBetterFit(candidate: Fit, current: Fit | null): boolean {
  if (!current) return true;
  if (candidate.short < current.short - EPS) return true;
  if (candidate.short > current.short + EPS) return false;
  if (candidate.long < current.long - EPS) return true;
  if (candidate.long > current.long + EPS) return false;
  return candidate.rectArea < current.rectArea - EPS;
}
