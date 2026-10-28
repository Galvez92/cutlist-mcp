import { describe, expect, it } from "vitest";

import { buildLabels, labelForPlacement, optimize } from "../src/index.js";

const SHEET = { id: "T", width: 2500, height: 1830, thickness: 18, kerf: 3 };

describe("etiquetas", () => {
  it("arma el texto de la etiqueta con código, medida, cantos y hoja", () => {
    const layout = optimize({
      parts: [
        {
          code: "PU1",
          label: "Puerta",
          width: 446,
          height: 1790,
          edges: { left: 0.4, right: 0.4, top: 0.4, bottom: 0.4 },
          material: "Melamina blanca 18 mm",
          thickness: 18,
        },
      ],
      sheets: [{ ...SHEET, material: "Melamina blanca 18 mm" }],
    });

    const sheet = layout.sheets[0];
    const placement = sheet?.placements[0];
    expect(sheet && placement).toBeTruthy();
    const label = labelForPlacement(placement!, sheet!);

    expect(label.lines[0]).toBe("PU1 · 446 × 1790 mm");
    expect(label.lines[1]).toBe("Puerta");
    expect(label.lines[2]).toContain("Cantos: arriba 0.4 mm");
    expect(label.lines.at(-1)).toBe("Hoja 1");
    expect(label.materialText).toBe("Melamina blanca 18 mm · 18 mm");
    expect(label.rotated).toBe(false);
  });

  it("avisa cuando la pieza va girada y refleja la veta real en la hoja", () => {
    const layout = optimize({
      parts: [{ code: "P", width: 1000, height: 500 }],
      sheets: [{ id: "T", width: 600, height: 1000, thickness: 18, kerf: 0 }],
    });

    const sheet = layout.sheets[0];
    const placement = sheet?.placements[0];
    const label = labelForPlacement(placement!, sheet!);

    expect(placement?.rotated).toBe(true);
    expect(label.sheetText).toBe("Hoja 1 · girada 90°");
  });

  it("indica la veta de la pieza y la de su hoja cuando hay veta", () => {
    // El tablero tiene veta horizontal, así que la pieza con veta horizontal
    // no se puede girar y su veta en la hoja sigue siendo horizontal.
    const layout = optimize({
      parts: [
        { code: "V", width: 900, height: 400, grain: "horizontal", qty: 1 },
      ],
      sheets: [
        { id: "T", width: 2500, height: 1830, thickness: 18, grain: "horizontal" },
      ],
    });

    const sheet = layout.sheets[0]!;
    const label = labelForPlacement(sheet.placements[0]!, sheet);

    expect(label.lines).toContain("Veta horizontal (→)");
  });

  it("genera una etiqueta por pieza colocada", () => {
    const layout = optimize({
      parts: [
        { code: "A", width: 600, height: 400, qty: 3 },
        { code: "B", width: 3000, height: 400, qty: 2 },
      ],
      sheets: [SHEET],
      algorithm: "guillotine",
    });

    expect(layout.labels).toHaveLength(3);
    expect(buildLabels(layout)).toEqual(layout.labels);
    expect(layout.labels.every((label) => label.code === "A")).toBe(true);
  });
});
