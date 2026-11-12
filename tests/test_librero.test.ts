/** Pruebas del generador de librero. */

import { describe, expect, it } from "vitest";

import { generar } from "../src/modules/librero.js";
import type { Modulo } from "../src/modules/modulo.js";
import type { Pieza } from "../src/modules/parts.js";
import { errores } from "../src/modules/profiles.js";

function buscar(modulo: Modulo, nombre: string): Pieza {
  for (const linea of modulo.resumen()) {
    if (linea.nombre === nombre) return linea;
  }
  throw new Error(`no se generó la pieza ${JSON.stringify(nombre)}`);
}

describe("librero · cuerpo", () => {
  it("medidas del cuerpo", () => {
    const modulo = generar();
    const costado = buscar(modulo, "Costado");
    expect([costado.largo, costado.ancho, costado.cantidad]).toEqual([2000.0, 300.0, 2]);
    expect(costado.cantos.porArista()).toEqual({ largo_a: "PVC 0.4 mm", ancho_a: "PVC 0.4 mm" });

    expect([buscar(modulo, "Base").largo, buscar(modulo, "Base").ancho]).toEqual([300.0, 764.0]);
    expect(buscar(modulo, "Tapa").cantidad).toBe(1);
    expect(buscar(modulo, "Trasera").espesor).toBe(3.0);
    expect([buscar(modulo, "Trasera").largo, buscar(modulo, "Trasera").ancho]).toEqual([1982.0, 782.0]);
  });

  it("repisas repartidas en el interior", () => {
    const modulo = generar();
    const repisa = buscar(modulo, "Repisa");
    expect(repisa.cantidad).toBe(4);
    expect([repisa.largo, repisa.ancho]).toEqual([279.3, 764.0]);
    expect(repisa.cantos.porArista()).toEqual({ ancho_a: "PVC 0.4 mm" });
    expect(modulo.notas.some((n) => n.startsWith("Alturas de repisa"))).toBe(true);
  });

  it("repisas en alturas pedidas y sin repisas", () => {
    const conRepisas = generar({ repisas: 0, posicionesRepisas: [400.0, 800.0, 1200.0] });
    expect(buscar(conRepisas, "Repisa").cantidad).toBe(3);

    const vacio = generar({ repisas: 0 });
    expect(vacio.resumen().some((l) => l.nombre === "Repisa")).toBe(false);
    expect(vacio.notas).toContain("Librero sin repisas.");
  });
});

describe("librero · repisas móviles y trasera", () => {
  it("repisas móviles agregan barrenos y soportes", () => {
    const modulo = generar({ repisasMoviles: true });
    const costado = buscar(modulo, "Costado");
    expect(costado.mecanizado.barrenos.length).toBe(20);
    expect(new Set(costado.mecanizado.barrenos.map((b) => b.diametro))).toEqual(new Set([5.0]));

    const soportes = modulo.accesorios.filter((a) => a.nombre === "Soporte de repisa Ø5");
    expect(soportes.length).toBe(1);
    expect(soportes[0].cantidad).toBe(16);
  });

  it("sin trasera lo avisa", () => {
    const modulo = generar({ traseraEspesor: 0 });
    expect(modulo.resumen().some((l) => l.nombre === "Trasera")).toBe(false);
    expect(modulo.notas.some((n) => n.includes("rigidización"))).toBe(true);
  });
});

describe("librero · validación y errores", () => {
  it("respeta el perfil por omisión", () => {
    expect(errores(generar({ repisasMoviles: true }).validar())).toEqual([]);
  });

  it("medidas inválidas fallan", () => {
    expect(() => generar({ ancho: 20.0 })).toThrow(/interior entre costados/);
    expect(() => generar({ posicionesRepisas: [1990.0] })).toThrow(/fuera del interior/);
    expect(() => generar({ traseraEspesor: 300.0 })).toThrow(/profundidad/);
  });
});
