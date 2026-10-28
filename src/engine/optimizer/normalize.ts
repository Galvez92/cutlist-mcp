/** Normalización y validación de la entrada del motor. */

import { OptimizeError } from "../errors.js";
import { emptyEdges, finishedDimensions } from "../geometry.js";
import type {
  EdgeBanding,
  GrainDirection,
  Part,
  PartInput,
  SheetInput,
  SheetStock,
} from "../types.js";

const GRAINS: readonly GrainDirection[] = ["none", "horizontal", "vertical"];

function assertPositive(value: number, field: string, who: string): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new OptimizeError(
      "medida-invalida",
      `${who}: "${field}" debe ser un número mayor que 0 (recibido: ${value}).`,
    );
  }
}

function assertQuantity(value: number, who: string): void {
  if (!Number.isInteger(value) || value < 1) {
    throw new OptimizeError(
      "cantidad-invalida",
      `${who}: la cantidad debe ser un entero ≥ 1 (recibido: ${value}).`,
    );
  }
}

function normalizeEdges(
  edges: Partial<EdgeBanding> | undefined,
  who: string,
  width: number,
  height: number,
): EdgeBanding {
  const result = emptyEdges();
  if (!edges) return result;
  for (const side of ["top", "right", "bottom", "left"] as const) {
    const value = edges[side];
    if (value === undefined) continue;
    if (!Number.isFinite(value) || value < 0) {
      throw new OptimizeError(
        "canto-invalido",
        `${who}: el canto "${side}" debe ser un número ≥ 0 (recibido: ${value}).`,
      );
    }
    result[side] = value;
  }
  const finished = finishedDimensions({ width, height, edges: result });
  if (finished.width <= 0 || finished.height <= 0) {
    throw new OptimizeError(
      "canto-invalido",
      `${who}: los cantos (${result.left + result.right} mm × ${result.top + result.bottom} mm) no caben en una pieza de ${width} × ${height} mm.`,
    );
  }
  return result;
}

/** Piezas de entrada → piezas normalizadas (con `id`, `code` y defectos aplicados). */
export function normalizeParts(inputs: PartInput[]): Part[] {
  if (!Array.isArray(inputs) || inputs.length === 0) {
    throw new OptimizeError("sin-piezas", "Hay que enviar al menos una pieza.");
  }
  return inputs.map((input, index) => {
    const id = input.id ?? `P${String(index + 1).padStart(2, "0")}`;
    const who = `Pieza ${id}`;
    assertPositive(input.width, "width", who);
    assertPositive(input.height, "height", who);
    const qty = input.qty ?? 1;
    assertQuantity(qty, who);
    const grain = input.grain ?? "none";
    if (!GRAINS.includes(grain)) {
      throw new OptimizeError(
        "veta-invalida",
        `${who}: veta desconocida "${grain}" (use none, horizontal o vertical).`,
      );
    }
    return {
      id,
      code: input.code ?? id,
      label: input.label ?? "",
      width: input.width,
      height: input.height,
      qty,
      grain,
      edges: normalizeEdges(input.edges, who, input.width, input.height),
      material: input.material,
      thickness: input.thickness,
    };
  });
}

export interface SheetDefaults {
  kerf: number;
  trim: number;
}

/** Tableros de entrada → stock normalizado. */
export function normalizeSheets(
  inputs: SheetInput[],
  defaults: SheetDefaults,
): SheetStock[] {
  if (!Array.isArray(inputs) || inputs.length === 0) {
    throw new OptimizeError(
      "sin-tableros",
      "Hay que enviar al menos un tablero de stock.",
    );
  }
  return inputs.map((input, index) => {
    const id = input.id ?? `T${String(index + 1).padStart(2, "0")}`;
    const who = `Tablero ${id}`;
    assertPositive(input.width, "width", who);
    assertPositive(input.height, "height", who);
    assertPositive(input.thickness, "thickness", who);
    const qty = input.qty ?? 1;
    assertQuantity(qty, who);

    const kerf = input.kerf ?? defaults.kerf;
    if (!Number.isFinite(kerf) || kerf < 0) {
      throw new OptimizeError(
        "kerf-invalido",
        `${who}: el kerf debe ser un número ≥ 0 (recibido: ${kerf}).`,
      );
    }
    const trim = input.trim ?? defaults.trim;
    if (!Number.isFinite(trim) || trim < 0) {
      throw new OptimizeError(
        "recorte-invalido",
        `${who}: el margen de recorte debe ser un número ≥ 0 (recibido: ${trim}).`,
      );
    }
    if (trim * 2 >= Math.min(input.width, input.height)) {
      throw new OptimizeError(
        "recorte-invalido",
        `${who}: el margen de recorte (${trim} mm por lado) no deja área útil.`,
      );
    }
    const grain = input.grain ?? "none";
    if (!GRAINS.includes(grain)) {
      throw new OptimizeError(
        "veta-invalida",
        `${who}: veta desconocida "${grain}" (use none, horizontal o vertical).`,
      );
    }
    return {
      id,
      label: input.label ?? id,
      width: input.width,
      height: input.height,
      thickness: input.thickness,
      kerf,
      trim,
      grain,
      qty,
      material: input.material,
    };
  });
}
