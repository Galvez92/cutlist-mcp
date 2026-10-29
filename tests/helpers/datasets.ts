/** Pedidos de prueba compartidos por varios tests. */

import {
  type AlgorithmOption,
  type LayoutResult,
  type PartInput,
  type SheetInput,
  optimize,
} from "../../src/index.js";

export const MDF_MATERIAL = "MDF 18 mm";

export const SHEET_2500x1830: SheetInput = {
  id: "MDF18",
  label: "MDF 18 mm",
  width: 2500,
  height: 1830,
  thickness: 18,
  kerf: 3,
  qty: 10,
  material: MDF_MATERIAL,
};

function part(
  code: string,
  width: number,
  height: number,
  qty: number,
): PartInput {
  return {
    code,
    label: `Pieza ${code}`,
    width,
    height,
    qty,
    material: MDF_MATERIAL,
    thickness: 18,
  };
}

/** 8 piezas distintas, 11 instancias, sin veta: caso base de los algoritmos. */
export const WORKSHOP_PARTS: PartInput[] = [
  part("A1", 1200, 600, 2),
  part("A2", 800, 400, 3),
  part("A3", 600, 400, 2),
  part("A4", 500, 500, 2),
  part("A5", 1150, 550, 2),
];

export function layoutFor(algorithm: AlgorithmOption): LayoutResult {
  return optimize({
    parts: WORKSHOP_PARTS,
    sheets: [SHEET_2500x1830],
    kerf: 3,
    algorithm,
  });
}
