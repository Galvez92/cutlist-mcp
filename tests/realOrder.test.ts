/**
 * Prueba con el pedido REAL de Cortecloud que está en el repositorio
 * (`tests/fixtures/cortecloud/escritorio_D_simple.json`).
 *
 * Campos verificados del formato (ver docs/memoria/MEMORIA.md): `quantity`,
 * `c` (largo, mm), `l` (ancho, mm), `function`, `material`, cantos `c1`,`c2`,
 * `l1`,`l2` (texto del canto o null).
 *
 * Por revisar (no verificado con documentación pública):
 * - qué lado físico corresponde a c1/c2/l1/l2 (aquí: c1→izquierda, c2→derecha,
 *   l1→arriba, l2→abajo), y
 * - la dirección de veta, que el archivo no declara.
 */

import { readFileSync } from "node:fs";

import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";

import {
  CORTECLOUD_MADIJAL_PROFILE,
  type PartInput,
  type SheetInput,
  normalizeParts,
  optimize,
  renderLayoutPdf,
  renderLayoutSvg,
  validateParts,
} from "../src/index.js";
import { assertLayoutValid } from "./helpers/layout.js";

interface CortecloudPart {
  quantity: number;
  c: number;
  l: number;
  function: string;
  material: string;
  c1: string | null;
  c2: string | null;
  l1: string | null;
  l2: string | null;
}

const fixture = JSON.parse(
  readFileSync(
    new URL("./fixtures/cortecloud/escritorio_D_simple.json", import.meta.url),
    "utf8",
  ),
) as { parts: CortecloudPart[] };

/** Espesor del canto a partir del texto real: "... 0.4 x 22 mm ...". */
function bandingThickness(text: string | null): number {
  if (!text) return 0;
  const match = /(\d+(?:[.,]\d+)?)\s*x\s*\d+(?:[.,]\d+)?\s*mm/i.exec(text);
  if (!match?.[1]) throw new Error(`Canto con formato inesperado: ${text}`);
  return Number(match[1].replace(",", "."));
}

/** Medidas y espesor del tablero a partir del texto de material real. */
function sheetFromMaterial(material: string): SheetInput {
  const size = /\((\d+)\s*x\s*(\d+)\)/.exec(material);
  const thickness = /(\d+(?:[.,]\d+)?)\s*mm/.exec(material);
  if (!size?.[1] || !size[2] || !thickness?.[1]) {
    throw new Error(`Material sin medidas reconocibles: ${material}`);
  }
  return {
    id: material,
    label: material,
    width: Number(size[1]),
    height: Number(size[2]),
    thickness: Number(thickness[1].replace(",", ".")),
    // Kerf de ejemplo: el archivo de Cortecloud no declara el kerf de la sierra.
    kerf: 3,
    qty: 20,
    material,
  };
}

function toParts(): PartInput[] {
  return fixture.parts.map((part) => ({
    label: part.function,
    material: part.material,
    width: part.l,
    height: part.c,
    qty: part.quantity,
    edges: {
      left: bandingThickness(part.c1),
      right: bandingThickness(part.c2),
      top: bandingThickness(part.l1),
      bottom: bandingThickness(part.l2),
    },
  }));
}

function toSheets(): SheetInput[] {
  return [...new Set(fixture.parts.map((part) => part.material))].map(
    sheetFromMaterial,
  );
}

describe("pedido real de Cortecloud (escritorio D)", () => {
  it("el fixture sigue siendo el pedido real (21 piezas distintas, 30 unidades, 2 materiales)", () => {
    expect(fixture.parts).toHaveLength(21);
    expect(
      fixture.parts.reduce((sum, part) => sum + part.quantity, 0),
    ).toBe(30);
    expect(new Set(fixture.parts.map((part) => part.material)).size).toBe(2);
  });

  it("acomoda las 30 piezas reales sin dejar ninguna fuera", () => {
    const layout = optimize({
      parts: toParts(),
      sheets: toSheets(),
      kerf: 3,
      algorithm: "auto",
    });

    expect(layout.metrics.partInstances).toBe(30);
    expect(layout.metrics.placed).toBe(30);
    expect(layout.metrics.unplaced).toBe(0);
    // Dos materiales ⇒ mínimo dos tableros (uno por material); el motor no
    // gasta ninguno de más en este pedido.
    expect(layout.metrics.sheetsUsed).toBe(2);
    expect(layout.metrics.yieldPct).toBeGreaterThan(50);
    expect(layout.metrics.yieldPct).toBeLessThanOrEqual(100);
    assertLayoutValid(layout.sheets);
  });

  it("no mezcla los dos materiales del pedido", () => {
    const layout = optimize({ parts: toParts(), sheets: toSheets(), kerf: 3 });

    const materials = new Set(layout.sheets.map((sheet) => sheet.material));
    expect(materials.size).toBe(2);
    for (const sheet of layout.sheets) {
      for (const placement of sheet.placements) {
        expect(placement.material).toBe(sheet.material);
      }
    }
  });

  it("la lista de corte cuadra con el pedido real", () => {
    const layout = optimize({ parts: toParts(), sheets: toSheets(), kerf: 3 });

    expect(layout.cutList).toHaveLength(21);
    expect(layout.cutList.reduce((sum, row) => sum + row.quantity, 0)).toBe(30);
    expect(layout.cutList.reduce((sum, row) => sum + row.placed, 0)).toBe(30);
    expect(layout.labels).toHaveLength(30);
    // El canto real de las cubiertas es de 0.4 mm y aparece en la lista.
    const withEdges = layout.cutList.filter((row) => row.edgeSummary !== "");
    expect(withEdges.length).toBeGreaterThan(0);
    expect(withEdges[0]?.edgeSummary).toContain("0.4 mm");
  });

  it("las medidas reales del pedido no violan el perfil observado", () => {
    const parts = normalizeParts(toParts());
    const issues = validateParts(parts, CORTECLOUD_MADIJAL_PROFILE);

    expect(issues.map((issue) => issue.code)).not.toContain("pieza-bajo-minimo");
    expect(issues.map((issue) => issue.code)).not.toContain("pieza-sobre-maximo");
    // El perfil sigue marcado «por revisar» (no hay documentación pública).
    expect(issues.map((issue) => issue.code)).toContain("perfil-por-revisar");
  });

  it("saca SVG y PDF del pedido real", async () => {
    const layout = optimize({ parts: toParts(), sheets: toSheets(), kerf: 3 });
    const svg = renderLayoutSvg(layout);
    const pdf = renderLayoutPdf(layout);
    const document = await PDFDocument.load(pdf);

    expect(svg).toContain("Hoja 1 ·");
    expect(svg).not.toContain("NaN");
    expect(document.getPageCount()).toBe(1 + layout.sheets.length);
  });
});
