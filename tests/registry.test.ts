import { describe, it, expect } from "vitest";
import * as formats from "../src/formats/index.js";
import { FormatError } from "../src/formats/base.js";
import { CutList, Piece, PARCIAL, POR_REVISAR, VERIFICADO } from "../src/formats/model.js";
import { fixture, fixturePath } from "./helpers/fixtures.js";
import { makeLayout, makePlacement, makeSheet } from "./helpers/layout.js";
import { mkdtempSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const CLAVES_ESPERADAS = new Set([
  "cortecloud", "csv_generico", "dxf", "opencutlist", "polyboard", "pro100", "promob",
]);

describe("Registro de formatos", () => {
  it("lista los siete formatos pedidos", () => {
    expect(new Set(formats.claves())).toEqual(CLAVES_ESPERADAS);
    expect(new Set(formats.listarFormatos().map((d) => d.clave))).toEqual(CLAVES_ESPERADAS);
  });

  it("cada formato declara estado y fuente", () => {
    for (const descriptor of formats.listarFormatos()) {
      expect(descriptor.fuentes.length).toBeGreaterThan(0);
      for (const fuente of descriptor.fuentes) {
        expect(fuente.url).toBeTruthy();
        expect(fuente.descripcion).toBeTruthy();
      }
      expect([VERIFICADO, PARCIAL, POR_REVISAR]).toContain(descriptor.estado);
      if (descriptor.estado !== VERIFICADO) {
        expect(descriptor.porRevisar.length).toBeGreaterThan(0);
      }
    }
  });

  it("por revisar enumera solo los no verificados", () => {
    const pendientes = formats.porRevisar();
    expect(new Set(Object.keys(pendientes))).toEqual(new Set(["promob", "pro100"]));
    for (const avisos of Object.values(pendientes)) {
      expect(avisos.length).toBeGreaterThan(0);
      expect(avisos.every((a) => !!a.fuente)).toBe(true);
    }
  });

  it("importar por clave marca el origen", () => {
    const lista = formats.importar(fixture("csv_generico/piezas_basico.csv"), "csv_generico");
    expect(lista.origen).toBe("csv_generico");
    expect(lista.piezas.length).toBe(5);
  });

  it("formato desconocido", () => {
    expect(() => formats.importar("", "no_existe")).toThrow(FormatError);
    expect(() => formats.exportar(new CutList(), "no_existe")).toThrow(FormatError);
    expect(() => formats.descriptor("no_existe")).toThrow(FormatError);
  });

  it("los formatos de solo lectura no se exportan", () => {
    const lista = new CutList({ piezas: [new Piece({ nombre: "Pieza", largo: 300, ancho: 200 })] });
    for (const clave of ["polyboard", "promob", "pro100"]) {
      expect(() => formats.exportar(lista, clave)).toThrow(FormatError);
    }
  });

  it("DXF solo se exporta desde un layout", () => {
    const layout = makeLayout([
      makeSheet({
        label: "H1",
        width: 2500,
        height: 1830,
        placements: [makePlacement({ code: "P-01", x: 0, y: 0, width: 300, height: 200 })],
      }),
    ]);
    const texto = formats.exportar(layout, "dxf");
    expect(texto).toContain("POLYLINE");
    expect(() =>
      formats.exportar(new CutList({ piezas: [new Piece({ nombre: "Pieza", largo: 300, ancho: 200 })] }), "dxf"),
    ).toThrow(FormatError);
  });

  it("importar archivo deduce la extensión", () => {
    const lista = formats.importarArchivo(fixturePath("cortecloud/escritorio_D_simple.json"));
    expect(lista.origen).toBe("cortecloud");
    expect(() => formats.importarArchivo(fixturePath("README.md"))).toThrow(FormatError);
    expect(formats.formatoParaExtension("piezas.xlsx")).toBeNull();
  });

  it("exportar archivo escribe y se puede releer", () => {
    const lista = formats.importarArchivo(fixturePath("cortecloud/escritorio_D_simple.json"));
    const carpeta = mkdtempSync(join(tmpdir(), "cutlist-"));
    try {
      const destino = join(carpeta, "piezas.csv");
      formats.exportarArchivo(lista, destino, "csv_generico");
      expect(existsSync(destino)).toBe(true);
      const vuelta = formats.importarArchivo(destino, "csv_generico");
      expect(vuelta.piezas.length).toBe(lista.piezas.length);
    } finally {
      rmSync(carpeta, { recursive: true, force: true });
    }
  });

  it("exportar Cortecloud a JSON es relegible", () => {
    const lista = formats.importarArchivo(fixturePath("cortecloud/escritorio_D_simple.json"));
    const texto = formats.exportar(lista, "cortecloud");
    expect((JSON.parse(texto) as { parts: Array<Record<string, unknown>> }).parts[0].quantity).toBe(
      lista.piezas[0].cantidad,
    );
  });
});
