import { describe, expect, it } from "vitest";

import {
  type LayoutResult,
  type PartInput,
  renderLayoutSvg,
  renderSheetSvg,
  optimize,
} from "../src/index.js";
import { layoutFor } from "./helpers/datasets.js";

const SHEET = { id: "T", width: 2500, height: 1830, thickness: 18, kerf: 3 };

function countMatches(text: string, pattern: RegExp): number {
  return text.match(pattern)?.length ?? 0;
}

function expectWellFormedSvg(svg: string): void {
  expect(svg.startsWith("<svg")).toBe(true);
  expect(svg.endsWith("</svg>")).toBe(true);
  expect(svg).not.toContain("NaN");
  expect(svg).not.toContain("undefined");
  expect(svg).not.toContain("null");
  expect(countMatches(svg, /<g[\s>]/g)).toBe(countMatches(svg, /<\/g>/g));

  for (const rect of svg.match(/<rect[^>]*\/>/g) ?? []) {
    for (const attribute of ["x", "y", "width", "height"]) {
      const value = new RegExp(`${attribute}="([^"]*)"`).exec(rect)?.[1];
      expect(value, `${attribute} en ${rect}`).toMatch(/^-?\d+(\.\d+)?$/);
    }
  }
}

function layoutWithEdges(): LayoutResult {
  const parts: PartInput[] = [
    {
      code: "C1",
      label: "Costado & <prueba>",
      width: 600,
      height: 400,
      qty: 2,
      edges: { top: 0.4, right: 0.4 },
    },
  ];
  return optimize({ parts, sheets: [SHEET], algorithm: "guillotine" });
}

describe("salida SVG", () => {
  it("genera un SVG bien formado por hoja", () => {
    const layout = layoutFor("auto");

    for (const sheet of layout.sheets) {
      expectWellFormedSvg(renderSheetSvg(sheet));
    }
  });

  it("genera un SVG con todas las hojas apiladas", () => {
    const layout = layoutFor("auto");
    const svg = renderLayoutSvg(layout);

    expectWellFormedSvg(svg);
    for (const sheet of layout.sheets) {
      const header = `Hoja ${sheet.index} · ${sheet.width} × ${sheet.height} × ${sheet.thickness} mm`;
      expect(svg).toContain(header);
    }
    for (const placement of layout.sheets.flatMap((sheet) => sheet.placements)) {
      expect(svg).toContain(placement.code);
    }
  });

  it("dibuja una marca por cada canto de la pieza", () => {
    const svg = renderLayoutSvg(layoutWithEdges());

    // 2 piezas × 2 cantos = 4 marcas de canto, con el mismo color.
    expect(countMatches(svg, /stroke="rgb\(180 83 9\)"/g)).toBe(4);
  });

  it("escapa el texto de las etiquetas", () => {
    const svg = renderLayoutSvg(layoutWithEdges());

    expect(svg).toContain("Costado &amp; &lt;prueba&gt;");
    expect(svg).not.toContain("Costado & <prueba>");
  });

  it("usa identificadores de recorte únicos y usados", () => {
    const layout = layoutFor("auto");
    const svg = renderLayoutSvg(layout);
    const ids = [...svg.matchAll(/<clipPath id="([^"]+)"/g)].map(
      (match) => match[1],
    );
    const used = [...svg.matchAll(/clip-path="url\(#([^)]+)\)"/g)].map(
      (match) => match[1],
    );

    expect(ids.length).toBeGreaterThan(0);
    expect(new Set(ids).size).toBe(ids.length);
    expect(used.sort()).toEqual([...ids].sort());
  });

  it("puede omitir etiquetas, cantos y veta", () => {
    const svg = renderLayoutSvg(layoutWithEdges(), {
      showLabels: false,
      showEdges: false,
      showGrain: false,
    });

    expectWellFormedSvg(svg);
    expect(countMatches(svg, /stroke="rgb\(180 83 9\)"/g)).toBe(0);
    expect(svg).not.toContain("<clipPath");
  });

  it("explica el caso sin hojas", () => {
    const layout = optimize({
      parts: [{ code: "G", width: 3000, height: 400 }],
      sheets: [SHEET],
    });

    expect(layout.sheets).toHaveLength(0);
    expectWellFormedSvg(renderLayoutSvg(layout));
    expect(renderLayoutSvg(layout)).toContain("Sin hojas");
  });
});
