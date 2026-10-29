import { describe, expect, it } from "vitest";

import { type PartInput, type SheetInput, optimize } from "../src/index.js";
import { layoutFor } from "./helpers/datasets.js";
import { assertLayoutValid } from "./helpers/layout.js";

describe("algoritmo no guillotina (MaxRects)", () => {
  it("coloca todas las piezas del pedido de prueba", () => {
    const layout = layoutFor("maxrects");

    expect(layout.algorithm).toBe("maxrects");
    expect(layout.metrics.unplaced).toBe(0);
    expect(layout.metrics.placed).toBe(layout.metrics.partInstances);
    assertLayoutValid(layout.sheets);
  });

  it("no es peor que la guillotina en el pedido de prueba", () => {
    const guillotine = layoutFor("guillotine");
    const maxrects = layoutFor("maxrects");

    // El acomodo libre puede usar cortes en L; nunca debe gastar más tablero.
    expect(maxrects.metrics.sheetsUsed).toBeLessThanOrEqual(
      guillotine.metrics.sheetsUsed,
    );
    expect(maxrects.metrics.yieldPct).toBeGreaterThanOrEqual(
      guillotine.metrics.yieldPct - 0.01,
    );
  });

  it("respeta el kerf entre piezas vecinas", () => {
    const sheet: SheetInput = {
      id: "T",
      width: 1000,
      height: 1000,
      thickness: 18,
      kerf: 10,
      qty: 10,
    };
    const parts: PartInput[] = [
      { code: "A", width: 400, height: 400, qty: 4 },
    ];
    const layout = optimize({ parts, sheets: [sheet], algorithm: "maxrects" });

    expect(layout.metrics.unplaced).toBe(0);
    assertLayoutValid(layout.sheets);
  });

  it("es determinista", () => {
    const first = layoutFor("maxrects");
    const second = layoutFor("maxrects");

    expect(second.sheets.map((sheet) => sheet.placements)).toEqual(
      first.sheets.map((sheet) => sheet.placements),
    );
  });
});
