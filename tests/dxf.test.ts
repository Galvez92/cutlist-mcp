import { describe, it, expect } from "vitest";
import * as dxf from "../src/formats/dxf.js";
import { FormatError } from "../src/formats/base.js";
import { PARCIAL } from "../src/formats/model.js";
import { fixture } from "./helpers/fixtures.js";
import { makeLayout, makePlacement, makeSheet } from "./helpers/layout.js";
import type { LayoutResult } from "../src/types.js";

function layoutDeEjemplo(): LayoutResult {
  return makeLayout([
    makeSheet({
      label: "H1",
      width: 2500,
      height: 1830,
      material: "Moscato 2 C 18 mm 771L ARAUCO",
      placements: [
        makePlacement({ code: "P-01", label: "Pata costado exterior acento der", x: 10, y: 10, width: 732, height: 600 }),
        makePlacement({ code: "P-02", label: "Lateral cajón", x: 800, y: 10, width: 450, height: 75 }),
      ],
    }),
  ]);
}

describe("Exportación DXF", () => {
  it("escribe DXF R12 con polilíneas", () => {
    const texto = dxf.exportar(layoutDeEjemplo());
    expect(texto).toContain("AC1009");
    expect(texto).toContain("$INSUNITS");
    expect(texto).toContain("POLYLINE");
    expect(texto).toContain("VERTEX");
    expect(texto).toContain("SEQEND");
    expect(texto).toContain("PIEZAS");
    expect(texto).toContain("P-01");
    expect(texto.trim().endsWith("EOF")).toBe(true);
    expect(() =>
      dxf.exportar({ sheets: [] } as unknown as LayoutResult),
    ).toThrow(FormatError);
    expect(() =>
      dxf.exportar({ hojas: [] } as unknown as LayoutResult),
    ).toThrow(FormatError);
  });

  it("ida y vuelta recupera las piezas colocadas", () => {
    const texto = dxf.exportar(layoutDeEjemplo());
    const lista = dxf.importar(texto);
    expect(lista.piezas.map((p) => p.nombre)).toEqual(["P-01", "P-02"]);
    expect([lista.piezas[0].largo, lista.piezas[0].ancho]).toEqual([732, 600]);
    expect([lista.piezas[1].largo, lista.piezas[1].ancho]).toEqual([450, 75]);
    expect(lista.piezas.every((p) => p.grupo === "PIEZAS")).toBe(true);
  });

  it("las capas propias se excluyen salvo que se pida lo contrario", () => {
    const texto = dxf.exportar(layoutDeEjemplo());
    const todas = dxf.importar(texto, { excluirCapas: [] });
    expect(todas.piezas.length).toBe(3);
    expect(new Set(todas.piezas.map((p) => p.grupo)).has("HOJA")).toBe(true);
    const soloPiezas = dxf.importar(texto, { soloCapa: "PIEZAS" });
    expect(soloPiezas.piezas.length).toBe(2);
  });

  it("exporta sin etiquetas", () => {
    const texto = dxf.exportar(layoutDeEjemplo(), { incluirEtiquetas: false });
    expect(texto).not.toContain("P-01");
    expect(dxf.importar(texto).piezas.length).toBe(2);
  });
});

describe("Lectura DXF", () => {
  it("lee rectángulos formados por LINE", () => {
    const lista = dxf.importar(fixture("dxf/rectangulo_lineas.dxf"));
    expect(lista.piezas.length).toBe(2);
    expect(lista.piezas[0].nombre).toBe("Costado interior der");
    expect([lista.piezas[0].largo, lista.piezas[0].ancho]).toEqual([500, 300]);
    expect(lista.piezas[1].nombre).toBe("contorno 2");
    expect([lista.piezas[1].largo, lista.piezas[1].ancho]).toEqual([200, 100]);
    expect(lista.piezas.every((p) => p.grupo === "PIEZAS")).toBe(true);
  });

  it("la posición se guarda en extra", () => {
    const pieza = dxf.importar(fixture("dxf/rectangulo_lineas.dxf")).piezas[1];
    expect(pieza.extra).toStrictEqual({ x: 600, y: 0 });
  });

  it("errores", () => {
    expect(() => dxf.importar("0\nSECTION\n2\nENTITIES\n0\nENDSEC\n0\nEOF\n")).toThrow(FormatError);
    expect(() => dxf.importar("archivo que no es dxf\n")).toThrow(FormatError);
    expect(() => dxf.importar("0\nSECTION\n2\nENTITIES\n0\nLINE\n8x\nPIEZAS\n0\nENDSEC\n0\nEOF\n")).toThrow(FormatError);
  });

  it("marca por revisar y cita Autodesk", () => {
    const lista = dxf.importar(fixture("dxf/rectangulo_lineas.dxf"));
    expect(lista.porRevisar().length).toBeGreaterThan(0);
    const fuentes = dxf.DESCRIPTOR.fuentes.map((f) => f.url).join(" ");
    expect(fuentes).toContain("help.autodesk.com");
    expect(dxf.DESCRIPTOR.estado).toBe(PARCIAL);
  });
});
