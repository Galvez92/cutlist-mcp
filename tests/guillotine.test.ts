import { describe, expect, it } from "vitest";

import { type PartInput, type SheetInput, optimize } from "../src/index.js";
import { layoutFor } from "./helpers/datasets.js";
import { assertLayoutValid, isGuillotineCuttable, rectOf, usableRectOf } from "./helpers/layout.js";

describe("algoritmo guillotina", () => {
  it("coloca todas las piezas del pedido de prueba dentro de los tableros", () => {
    const layout = layoutFor("guillotine");

    expect(layout.algorithm).toBe("guillotine");
    expect(layout.metrics.unplaced).toBe(0);
    expect(layout.metrics.placed).toBe(layout.metrics.partInstances);
    assertLayoutValid(layout.sheets);
  });

  it("genera un acomodo cortable con cortes de guillotina", () => {
    const layout = layoutFor("guillotine");

    for (const sheet of layout.sheets) {
      const rects = sheet.placements.map(rectOf);
      expect(isGuillotineCuttable(rects, usableRectOf(sheet))).toBe(true);
    }
  });

  it("es determinista: el mismo pedido da el mismo layout", () => {
    const first = layoutFor("guillotine");
    const second = layoutFor("guillotine");

    expect(second.sheets.map((sheet) => sheet.placements)).toEqual(
      first.sheets.map((sheet) => sheet.placements),
    );
  });

  it("respeta el kerf entre piezas contiguas", () => {
    const sheet: SheetInput = {
      id: "T",
      width: 1000,
      height: 1000,
      thickness: 18,
      kerf: 10,
      qty: 5,
    };
    // 500 + kerf 10 = 510 > mitad del tablero: solo cabe una por hoja.
    const parts: PartInput[] = [{ code: "X", width: 500, height: 1000, qty: 2 }];
    const layout = optimize({ parts, sheets: [sheet], algorithm: "guillotine" });

    expect(layout.sheets).toHaveLength(2);
    expect(layout.metrics.unplaced).toBe(0);
    assertLayoutValid(layout.sheets);
  });

  it("deja que una pieza use el tablero completo sin sumarle kerf", () => {
    const sheet: SheetInput = {
      id: "T",
      width: 1000,
      height: 1000,
      thickness: 18,
      kerf: 10,
    };
    const parts: PartInput[] = [{ code: "X", width: 1000, height: 1000 }];
    const layout = optimize({ parts, sheets: [sheet], algorithm: "guillotine" });

    expect(layout.metrics.placed).toBe(1);
    expect(layout.sheets).toHaveLength(1);
    expect(layout.sheets[0]?.placements[0]).toMatchObject({
      x: 0,
      y: 0,
      width: 1000,
      height: 1000,
    });
  });

  it("no gira piezas con veta sobre un tablero con veta", () => {
    const sheet: SheetInput = {
      id: "T",
      width: 2500,
      height: 1830,
      thickness: 18,
      grain: "horizontal",
      kerf: 0,
    };
    const parts: PartInput[] = [
      { code: "V", width: 900, height: 1800, grain: "horizontal" },
    ];
    const layout = optimize({ parts, sheets: [sheet], algorithm: "guillotine" });

    // 900 × 1800 cabe sin girar; girada (1800 × 900) también cabría, pero la
    // veta lo prohíbe.
    expect(layout.metrics.placed).toBe(1);
    expect(layout.sheets[0]?.placements[0]).toMatchObject({
      width: 900,
      height: 1800,
      rotated: false,
      grainInSheet: "horizontal",
    });
  });

  it("no acepta piezas con veta contraria a la del tablero", () => {
    const sheet: SheetInput = {
      id: "T",
      width: 2500,
      height: 1830,
      thickness: 18,
      grain: "horizontal",
    };
    const parts: PartInput[] = [
      { code: "V", width: 900, height: 400, grain: "vertical" },
    ];
    const layout = optimize({ parts, sheets: [sheet], algorithm: "guillotine" });

    expect(layout.metrics.placed).toBe(0);
    expect(layout.unplaced[0]?.reason).toBe("sin-tablero-compatible");
  });
});
