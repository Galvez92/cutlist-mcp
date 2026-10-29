import { describe, it, expect, beforeAll } from "vitest";
import * as cortecloud from "../src/formats/cortecloud.js";
import { FormatError } from "../src/formats/base.js";
import { PARCIAL } from "../src/formats/model.js";
import { fixture } from "./helpers/fixtures.js";

describe("Cortecloud (importación JSON)", () => {
  let texto: string;
  let bruto: { parts: Array<Record<string, unknown>> };

  beforeAll(() => {
    texto = fixture("cortecloud/escritorio_D_simple.json");
    bruto = JSON.parse(texto);
  });

  it("lee todas las piezas del fixture real", () => {
    const lista = cortecloud.importar(texto);
    expect(lista.piezas.length).toBe(bruto.parts.length);
    expect(lista.totalPiezas).toBe(
      bruto.parts.reduce((s, p) => s + Number(p.quantity), 0),
    );
  });

  it("mapea los campos documentados", () => {
    const lista = cortecloud.importar(texto);
    const pieza = lista.piezas[0];
    const esperado = bruto.parts[0] as Record<string, unknown>;
    expect(pieza.largo).toBe(esperado.c);
    expect(pieza.ancho).toBe(esperado.l);
    expect(pieza.cantidad).toBe(esperado.quantity);
    expect(pieza.nombre).toBe(esperado.function);
    expect(pieza.grupo).toBe(esperado.complement);
    expect(pieza.material).toBe(esperado.material);
    expect(pieza.cantos.c1).toBe(esperado.c1);
    expect(pieza.cantos.l1).toBe(esperado.l1);
    expect(pieza.cantos.c2).toBeUndefined();
  });

  it("conserva el bloque machining tal cual", () => {
    const lista = cortecloud.importar(texto);
    const conUsinaje = lista.piezas.filter((p) => p.extra.machining);
    expect(conUsinaje.length).toBeGreaterThan(0);
    const usinaje = conUsinaje[0].extra.machining as Record<string, unknown>;
    expect((usinaje.verticalDrills as Array<Record<string, unknown>>)[0].diameter).toBe(35);
    expect("furrowMachining" in usinaje).toBe(true);
  });

  it("marca por revisar con fuente", () => {
    const lista = cortecloud.importar(texto);
    const avisos = lista.porRevisar();
    expect(avisos.length).toBeGreaterThan(0);
    for (const aviso of avisos) {
      expect(aviso.fuente).toBeTruthy();
      expect(aviso.fuente!.startsWith("http")).toBe(true);
    }
    const mensajes = avisos.map((a) => a.mensaje.toLowerCase()).join(" ");
    expect(mensajes).toContain("unidad");
  });

  it("ida y vuelta es fiel al fixture", () => {
    const lista = cortecloud.importar(texto);
    const salida = cortecloud.exportar(lista);
    expect(JSON.parse(salida)).toStrictEqual(bruto);
  });

  it("rechaza JSON inválido y piezas incompletas", () => {
    expect(() => cortecloud.importar("{ no es json")).toThrow(FormatError);
    expect(() => cortecloud.importar(JSON.stringify({ piezas: [] }))).toThrow(FormatError);
    expect(() => cortecloud.importar(JSON.stringify({ parts: [{ quantity: 1, l: 500 }] }))).toThrow(FormatError);
    expect(() => cortecloud.importar(JSON.stringify({ parts: [{ quantity: 1, c: 0, l: 500 }] }))).toThrow(FormatError);
    expect(() => cortecloud.importar(JSON.stringify({ parts: ["no es objeto"] }))).toThrow(FormatError);
  });

  it("exporta sin avisos cuando la lista es nueva", () => {
    const lista = cortecloud.importar(texto);
    const salida = JSON.parse(cortecloud.exportar(lista, { sangria: 0 })) as {
      parts: Array<Record<string, unknown>>;
    };
    expect(Object.keys(salida)).toEqual(["parts"]);
    expect(salida.parts[0].c1).toBe((bruto.parts[0] as Record<string, unknown>).c1);
  });

  it("descriptor declara estado y fuentes", () => {
    expect(cortecloud.DESCRIPTOR.estado).toBe(PARCIAL);
    expect(cortecloud.DESCRIPTOR.clave).toBe("cortecloud");
    expect(cortecloud.DESCRIPTOR.fuentes.some((f) => f.url.includes("cortecloud.com"))).toBe(true);
    expect(cortecloud.DESCRIPTOR.porRevisar.length).toBeGreaterThan(0);
  });
});
