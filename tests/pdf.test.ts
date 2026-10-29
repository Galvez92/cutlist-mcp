import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";

import {
  type PartInput,
  type SheetInput,
  renderLayoutPdf,
  optimize,
} from "../src/index.js";
import { layoutFor } from "./helpers/datasets.js";

const SHEET = { id: "T", width: 2500, height: 1830, thickness: 18, kerf: 3, qty: 5 };

function rawOf(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("latin1");
}

function parseXref(raw: string): { offsets: { number: number; offset: number }[]; size: number } {
  const marker = raw.lastIndexOf("startxref");
  const startxref = Number(raw.slice(marker + "startxref".length).trim().split("\n")[0]);
  const section = raw.slice(startxref);
  expect(section.startsWith("xref")).toBe(true);

  const lines = section.split("\n");
  const [first, count] = (lines[1] ?? "").split(" ").map(Number);
  expect(first).toBe(0);
  expect(count).toBeGreaterThan(0);

  const offsets: { number: number; offset: number }[] = [];
  for (let index = 0; index < (count ?? 0); index += 1) {
    const line = lines[2 + index] ?? "";
    // Cada entrada de la tabla xref ocupa exactamente 20 bytes (19 + "\n").
    expect(line).toHaveLength(19);
    expect(line).toMatch(/^\d{10} \d{5} [nf] $/);
    const parts = line.split(" ");
    if (index === 0) {
      expect(parts[2]).toBe("f");
      continue;
    }
    expect(parts[2]).toBe("n");
    offsets.push({ number: index, offset: Number(parts[0]) });
  }
  return { offsets, size: count ?? 0 };
}

describe("salida PDF", () => {
  it("es un PDF que carga un lector y trae lista de corte + una página por hoja", async () => {
    const layout = layoutFor("auto");
    const bytes = renderLayoutPdf(layout);
    const document = await PDFDocument.load(bytes);

    expect(document.getPageCount()).toBe(1 + layout.sheets.length);
    const first = document.getPage(0).getSize();
    expect(first.width).toBe(842);
    expect(first.height).toBe(595);
  });

  it("tiene estructura válida: tabla xref, /Length y fin de archivo", async () => {
    const layout = layoutFor("auto");
    const raw = rawOf(renderLayoutPdf(layout));

    expect(raw.startsWith("%PDF-1.4")).toBe(true);
    expect(raw.trimEnd().endsWith("%%EOF")).toBe(true);
    expect(/\/Type \/Catalog/.test(raw)).toBe(true);
    expect(/\/BaseFont \/Helvetica\b/.test(raw)).toBe(true);

    const { offsets, size } = parseXref(raw);
    expect(Number(/\/Size (\d+)/.exec(raw)?.[1])).toBe(size);
    for (const entry of offsets) {
      const header = `${entry.number} 0 obj`;
      expect(raw.slice(entry.offset, entry.offset + header.length)).toBe(header);
    }

    let streams = 0;
    const pattern = /(\d+) 0 obj\n([\s\S]*?)\nendobj\n/g;
    for (const match of raw.matchAll(pattern)) {
      const body = match[2] ?? "";
      const streamIndex = body.indexOf("stream\n");
      if (streamIndex === -1) continue;
      const declared = Number(/\/Length (\d+)/.exec(body)?.[1]);
      const content = body.slice(streamIndex + "stream\n".length, body.lastIndexOf("\nendstream"));
      expect(content.length).toBe(declared);
      streams += 1;
    }
    expect(streams).toBeGreaterThan(0);
  });

  it("dibuja la lista de corte y las etiquetas de las piezas (con acentos)", async () => {
    const parts: PartInput[] = [
      { code: "Z1", label: "Zócalo", width: 1180, height: 100, qty: 2, edges: { top: 0.4 } },
    ];
    const layout = optimize({ parts, sheets: [SHEET], algorithm: "guillotine" });
    const raw = rawOf(renderLayoutPdf(layout));

    expect(raw).toContain("Lista de corte");
    expect(raw).toContain("Zócalo");
    expect(raw).toContain("Hoja 1 de 1");
    await expect(PDFDocument.load(renderLayoutPdf(layout))).resolves.toBeDefined();
  });

  it("pagina la lista de corte cuando hay muchas piezas", async () => {
    const parts: PartInput[] = Array.from({ length: 45 }, (_, index) => ({
      code: `P${index + 1}`,
      label: `Pieza ${index + 1}`,
      width: 600,
      height: 400,
      qty: 1,
    }));
    const sheets: SheetInput[] = [
      { id: "T", width: 2500, height: 1830, thickness: 18, kerf: 3, qty: 20 },
    ];
    const layout = optimize({ parts, sheets, algorithm: "guillotine" });
    const bytes = renderLayoutPdf(layout);
    const document = await PDFDocument.load(bytes);

    expect(layout.cutList).toHaveLength(45);
    expect(document.getPageCount()).toBeGreaterThan(1 + layout.sheets.length);
  });

  it("mantiene el PDF válido cuando no se colocó ninguna pieza", async () => {
    const layout = optimize({
      parts: [{ code: "G", width: 4000, height: 400 }],
      sheets: [SHEET],
    });
    const bytes = renderLayoutPdf(layout);
    const document = await PDFDocument.load(bytes);

    expect(layout.sheets).toHaveLength(0);
    expect(document.getPageCount()).toBe(1);
    expect(rawOf(bytes)).toContain("sin colocar");
  });

  it("puede omitir la lista de corte y ajustar la página", async () => {
    const layout = layoutFor("auto");
    const bytes = renderLayoutPdf(layout, {
      includeCutList: false,
      pageWidth: 1191,
      pageHeight: 842,
    });
    const document = await PDFDocument.load(bytes);

    expect(document.getPageCount()).toBe(layout.sheets.length);
    expect(document.getPage(0).getSize().width).toBe(1191);
    expect(rawOf(bytes)).not.toContain("Lista de corte");
  });
});
