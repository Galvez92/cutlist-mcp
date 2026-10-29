/** Heurísticas de orden de las piezas antes de acomodarlas. */

import type { OrderingName } from "../types.js";
import type { PackItem } from "./algorithm.js";

export interface Ordering {
  name: OrderingName;
  compare: (a: PackItem, b: PackItem) => number;
}

/** Órdenes probados por `optimize` cuando el algoritmo es `auto`. */
export const ORDERINGS: Ordering[] = [
  { name: "area", compare: (a, b) => b.w * b.h - a.w * a.h },
  {
    name: "lado-mayor",
    compare: (a, b) =>
      Math.max(b.w, b.h) - Math.max(a.w, a.h) || b.w * b.h - a.w * a.h,
  },
  { name: "altura", compare: (a, b) => b.h - a.h || b.w - a.w },
  { name: "ancho", compare: (a, b) => b.w - a.w || b.h - a.h },
];

export function orderingByName(name: OrderingName): Ordering {
  const found = ORDERINGS.find((ordering) => ordering.name === name);
  if (!found) throw new Error(`Orden desconocido: ${name}`);
  return found;
}

/** Ordena copia de las piezas; desempata por clave para que sea determinista. */
export function sortItems<T extends PackItem>(
  items: T[],
  ordering: Ordering,
): T[] {
  return [...items].sort(
    (a, b) => ordering.compare(a, b) || a.key.localeCompare(b.key),
  );
}
