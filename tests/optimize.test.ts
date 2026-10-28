import { describe, expect, it } from "vitest";

import {
  type AlgorithmOption,
  OptimizeError,
  type PartInput,
  type SheetInput,
  optimize,
} from "../src/index.js";
import { assertLayoutValid } from "./helpers/layout.js";

function errorCodeOf(run: () => unknown): string {
  try {
    run();
  } catch (error) {
    return error instanceof OptimizeError ? error.code : "otro-error";
  }
  return "sin-error";
}

const SHEET_18: SheetInput = {
  id: "M18",
  width: 2500,
  height: 1830,
  thickness: 18,
  kerf: 0,
  qty: 5,
};

describe("optimize: agrupación y stock", () => {
  it("separa los materiales: cada pieza cae en un tablero de su material", () => {
    const sheets: SheetInput[] = [
      { ...SHEET_18, id: "ROBLE", material: "Roble 18 mm", qty: 2 },
      { ...SHEET_18, id: "BLANCO", material: "Blanco 18 mm", qty: 2 },
    ];
    const parts: PartInput[] = [
      { code: "R1", width: 1200, height: 600, qty: 2, material: "Roble 18 mm", thickness: 18 },
      { code: "B1", width: 800, height: 400, qty: 2, material: "Blanco 18 mm", thickness: 18 },
    ];

    const layout = optimize({ parts, sheets, algorithm: "auto" });

    expect(layout.metrics.unplaced).toBe(0);
    expect(layout.metrics.sheetsUsed).toBe(2);
    for (const sheet of layout.sheets) {
      for (const placement of sheet.placements) {
        expect(placement.material).toBe(sheet.material);
      }
    }
    assertLayoutValid(layout.sheets);
  });

  it("marca las piezas sin tablero compatible", () => {
    const sheets: SheetInput[] = [
      { ...SHEET_18, material: "Blanco 18 mm" },
    ];
    const parts: PartInput[] = [
      { code: "R1", width: 600, height: 400, qty: 3, material: "Roble 18 mm" },
    ];

    const layout = optimize({ parts, sheets });

    expect(layout.metrics.placed).toBe(0);
    expect(layout.unplaced).toHaveLength(1);
    expect(layout.unplaced[0]).toMatchObject({
      code: "R1",
      quantity: 3,
      reason: "sin-tablero-compatible",
    });
    expect(layout.unplaced[0]?.detail).toContain("600 × 400");
  });

  it("marca las piezas que no caben en ningún tablero", () => {
    const parts: PartInput[] = [{ code: "G", width: 3000, height: 500 }];

    const layout = optimize({ parts, sheets: [SHEET_18] });

    expect(layout.unplaced[0]).toMatchObject({
      code: "G",
      reason: "no-cabe-en-tablero",
    });
    expect(layout.unplaced[0]?.detail).toContain("2500 × 1830");
  });

  it("marca el stock insuficiente y usa las hojas disponibles", () => {
    const sheets: SheetInput[] = [{ ...SHEET_18, qty: 1 }];
    const parts: PartInput[] = [{ code: "P", width: 2500, height: 1000, qty: 2 }];

    const layout = optimize({ parts, sheets, algorithm: "guillotine" });

    expect(layout.metrics.sheetsUsed).toBe(1);
    expect(layout.unplaced[0]).toMatchObject({
      code: "P",
      quantity: 1,
      reason: "stock-insuficiente",
    });
  });

  it("no mezcla espesores distintos", () => {
    const sheets: SheetInput[] = [{ ...SHEET_18, thickness: 25 }];
    const parts: PartInput[] = [
      { code: "P18", width: 600, height: 400, thickness: 18 },
    ];

    const layout = optimize({ parts, sheets });

    expect(layout.unplaced[0]?.reason).toBe("sin-tablero-compatible");
  });

  it("sin espesor declarado la pieza admite cualquier tablero", () => {
    const layout = optimize({
      parts: [{ code: "P", width: 600, height: 400 }],
      sheets: [SHEET_18],
    });

    expect(layout.metrics.placed).toBe(1);
  });
});

describe("optimize: opciones", () => {
  it("respeta allowRotation = false", () => {
    const sheets: SheetInput[] = [
      { id: "T", width: 600, height: 1000, thickness: 18, kerf: 0 },
    ];
    const parts: PartInput[] = [{ code: "P", width: 1000, height: 500 }];

    const rotated = optimize({ parts, sheets, allowRotation: true });
    const fixed = optimize({ parts, sheets, allowRotation: false });

    expect(rotated.metrics.placed).toBe(1);
    expect(rotated.sheets[0]?.placements[0]?.rotated).toBe(true);
    expect(fixed.metrics.placed).toBe(0);
    expect(fixed.unplaced[0]?.reason).toBe("no-cabe-en-tablero");
  });

  it("aplica el margen de recorte (trim) al área útil", () => {
    const sheets: SheetInput[] = [
      { id: "T", width: 2500, height: 1830, thickness: 18, kerf: 4, trim: 10 },
    ];
    const parts: PartInput[] = [{ code: "P", width: 2400, height: 600, qty: 2 }];

    const layout = optimize({ parts, sheets, algorithm: "maxrects" });

    assertLayoutValid(layout.sheets);
    for (const sheet of layout.sheets) {
      for (const placement of sheet.placements) {
        expect(placement.x).toBeGreaterThanOrEqual(10);
        expect(placement.y).toBeGreaterThanOrEqual(10);
      }
    }
  });

  it("con algorithm explícito solo prueba ese algoritmo", () => {
    const layout = optimize({
      parts: [{ code: "P", width: 600, height: 400, qty: 2 }],
      sheets: [SHEET_18],
      algorithm: "guillotine",
    });

    expect(layout.algorithm).toBe("guillotine");
    expect(layout.attempts).toHaveLength(4);
    expect(layout.attempts.every((attempt) => attempt.algorithm === "guillotine")).toBe(true);
  });

  it("en auto prueba los dos algoritmos con los cuatro órdenes y devuelve el mejor", () => {
    const layout = optimize({
      parts: [{ code: "P", width: 600, height: 400, qty: 3 }],
      sheets: [SHEET_18],
    });

    expect(layout.attempts).toHaveLength(8);
    const best = layout.attempts[0];
    expect(best?.algorithm).toBe(layout.algorithm);
    expect(best?.ordering).toBe(layout.ordering);
    for (const attempt of layout.attempts) {
      expect(attempt.unplacedQuantity).toBeGreaterThanOrEqual(best?.unplacedQuantity ?? 0);
    }
  });

  it("calcula el aprovechamiento sobre el tablero completo", () => {
    const sheets: SheetInput[] = [{ ...SHEET_18, qty: 1 }];
    // Dos piezas de 1250 × 915 = mitad del tablero cada una.
    const parts: PartInput[] = [{ code: "P", width: 1250, height: 915, qty: 2 }];

    const layout = optimize({ parts, sheets, algorithm: "guillotine" });

    expect(layout.metrics.placed).toBe(2);
    expect(layout.metrics.yieldPct).toBeCloseTo(50, 1);
    expect(layout.metrics.wasteArea).toBeCloseTo(
      layout.metrics.sheetArea - layout.metrics.usedArea,
      1,
    );
  });

  it("el etiquetado cuenta instancias, no piezas distintas", () => {
    const layout = optimize({
      parts: [{ code: "P", width: 600, height: 400, qty: 3 }],
      sheets: [SHEET_18],
    });

    expect(layout.metrics.distinctParts).toBe(1);
    expect(layout.metrics.partInstances).toBe(3);
    expect(layout.labels).toHaveLength(3);
  });
});

describe("optimize: entradas inválidas", () => {
  it("exige piezas y tableros", () => {
    expect(errorCodeOf(() => optimize({ parts: [], sheets: [SHEET_18] }))).toBe(
      "sin-piezas",
    );
    expect(
      errorCodeOf(() =>
        optimize({ parts: [{ code: "P", width: 10, height: 10 }], sheets: [] }),
      ),
    ).toBe("sin-tableros");
  });

  it("rechaza medidas y cantidades inválidas", () => {
    expect(
      errorCodeOf(() =>
        optimize({ parts: [{ code: "P", width: 0, height: 10 }], sheets: [SHEET_18] }),
      ),
    ).toBe("medida-invalida");
    expect(
      errorCodeOf(() =>
        optimize({
          parts: [{ code: "P", width: 100, height: 100, qty: 0 }],
          sheets: [SHEET_18],
        }),
      ),
    ).toBe("cantidad-invalida");
  });

  it("rechaza cantos que no caben en la pieza", () => {
    expect(
      errorCodeOf(() =>
        optimize({
          parts: [
            { code: "P", width: 100, height: 100, edges: { left: 60, right: 60 } },
          ],
          sheets: [SHEET_18],
        }),
      ),
    ).toBe("canto-invalido");
  });

  it("rechaza un algoritmo desconocido", () => {
    expect(
      errorCodeOf(() =>
        optimize({
          parts: [{ code: "P", width: 600, height: 400 }],
          sheets: [SHEET_18],
          algorithm: "mágico" as AlgorithmOption,
        }),
      ),
    ).toBe("algoritmo-desconocido");
  });

  it("rechaza un recorte que no deja área útil", () => {
    expect(
      errorCodeOf(() =>
        optimize({
          parts: [{ code: "P", width: 600, height: 400 }],
          sheets: [{ id: "T", width: 100, height: 1000, thickness: 18, trim: 50 }],
        }),
      ),
    ).toBe("recorte-invalido");
  });
});
