/** Pruebas del generador de clóset. */

import { describe, expect, it } from "vitest";

import { generar } from "../src/modules/closet.js";
import type { ParamsCloset } from "../src/modules/closet.js";
import type { Modulo } from "../src/modules/modulo.js";
import type { Pieza } from "../src/modules/parts.js";
import { errores } from "../src/modules/profiles.js";
import { aprox } from "./helpers/aprox.js";

function buscar(modulo: Modulo, nombre: string): Pieza {
  for (const linea of modulo.resumen()) {
    if (linea.nombre === nombre) return linea;
  }
  throw new Error(`no se generó la pieza ${JSON.stringify(nombre)}`);
}

describe("clóset · cuerpo", () => {
  it("medidas del cuerpo", () => {
    const modulo = generar();
    expect([buscar(modulo, "Costado").largo, buscar(modulo, "Costado").ancho]).toEqual([2400.0, 600.0]);
    expect(buscar(modulo, "Costado").cantidad).toBe(2);
    expect([buscar(modulo, "Base").largo, buscar(modulo, "Base").ancho]).toEqual([600.0, 1464.0]);
    expect(buscar(modulo, "Tapa").cantidad).toBe(1);
    // Trasera encastrada en ranura: alto y ancho interiores + 2 x 9 mm de ranura.
    expect([buscar(modulo, "Trasera").largo, buscar(modulo, "Trasera").ancho]).toEqual([2382.0, 1482.0]);
    expect(buscar(modulo, "Trasera").espesor).toBe(3.0);
    aprox(modulo.medidas["ancho_interior"], 1464.0);
  });

  it("repisas repartidas en el interior", () => {
    const modulo = generar();
    const repisa = buscar(modulo, "Repisa");
    expect(repisa.cantidad).toBe(3);
    // La repisa termina en la cara frontal de la trasera: 600 - (15 + 5.7).
    expect([repisa.largo, repisa.ancho]).toEqual([579.3, 1464.0]);
    expect(repisa.cantos.porArista()).toEqual({ ancho_a: "PVC 0.4 mm" });
    expect(repisa.rol).toBe("repisa");
    expect(modulo.notas.some((n) => n.endsWith("591, 1182, 1773"))).toBe(true);
  });

  it("posiciones de repisa explícitas", () => {
    const modulo = generar({ repisas: 0, posicionesRepisas: [500.0, 1000.0, 1500.0] });
    expect(buscar(modulo, "Repisa").cantidad).toBe(3);
    expect(modulo.notas.some((n) => n.endsWith("482, 982, 1482"))).toBe(true);
  });

  it("repisa fuera del módulo falla", () => {
    expect(() => generar({ posicionesRepisas: [10.0] })).toThrow(/fuera del interior/);
  });
});

describe("clóset · puertas", () => {
  it("puertas batientes cubrientes", () => {
    const modulo = generar();
    const puerta = buscar(modulo, "Puerta");
    expect(puerta.cantidad).toBe(2);
    aprox(puerta.largo, 2400.0 - 3.0);
    aprox(puerta.ancho, (1500.0 - 3.0) / 2);
    expect(puerta.cantos.cantidad()).toBe(4);
    expect(puerta.espesor).toBe(18.0);
    const accesorios = new Map(modulo.accesorios.map((a) => [a.nombre, a]));
    expect(accesorios.get("Bisagra")!.cantidad).toBe(10);
    expect(accesorios.get("Tirador o manija")!.cantidad).toBe(2);
  });

  it("puertas correderas traslapadas", () => {
    const modulo = generar({ tipoPuerta: "corredera", puertas: 3 });
    const hoja = buscar(modulo, "Puerta corredera");
    expect(hoja.cantidad).toBe(3);
    aprox(hoja.ancho, (1500.0 + 2 * 30.0) / 3);
    aprox(hoja.largo, 2400.0 - 45.0);
    expect(modulo.notas.some((n) => n.includes("por revisar"))).toBe(true);
    const nombres = new Set(modulo.accesorios.map((a) => a.nombre));
    expect(nombres.has("Guía superior de puerta corredera")).toBe(true);
    expect(nombres.has("Guía inferior de puerta corredera")).toBe(true);
  });

  it("clóset sin puertas", () => {
    const modulo = generar({ tipoPuerta: "sin" });
    expect(modulo.resumen().some((l) => l.rol === "puerta")).toBe(false);
    expect(modulo.medidas["puertas"]).toBe(0);
  });
});

describe("clóset · barral y repisas móviles", () => {
  it("barral como accesorio con su altura", () => {
    const conBarral = generar({ barralAltura: 1800.0 });
    const barral = conBarral.accesorios.filter((a) => a.nombre === "Barral redondo");
    expect(barral.length).toBe(1);
    expect(barral[0].nota).toContain("1800");

    const sinBarral = generar({ barralAltura: null });
    expect(sinBarral.accesorios.some((a) => a.nombre === "Barral redondo")).toBe(false);

    expect(() => generar({ barralAltura: 3000.0 })).toThrow(/dentro del módulo/);
  });

  it("repisas móviles perforan los costados", () => {
    const modulo = generar({ repisas: 3, repisasMoviles: true });
    const costado = buscar(modulo, "Costado");
    expect(costado.mecanizado.barrenos.length).toBe(15);
    expect(new Set(costado.mecanizado.barrenos.map((b) => b.diametro))).toEqual(new Set([5.0]));
    expect(costado.funcion).toContain("barrenos");

    const soportes = modulo.accesorios.filter((a) => a.nombre === "Soporte de repisa Ø5");
    expect(soportes.length).toBe(1);
    expect(soportes[0].cantidad).toBe(12);

    const sinPerforar = buscar(generar(), "Costado");
    expect(sinPerforar.mecanizado.barrenos).toEqual([]);
    expect(sinPerforar.mecanizado.ranuras.length).toBe(1); // la ranura de la trasera
    const sinRanura = buscar(generar({ traseraRanura: false }), "Costado");
    expect(sinRanura.mecanizado.vacio()).toBe(true);
  });
});

describe("clóset · validación y errores", () => {
  it("respeta el perfil por omisión", () => {
    expect(errores(generar({ repisasMoviles: true }).validar())).toEqual([]);
  });

  it("medidas inválidas fallan", () => {
    expect(() => generar({ tipoPuerta: "plegable" } as Partial<ParamsCloset>)).toThrow(/tipo_puerta inválido/);
    expect(() => generar({ puertas: 0 })).toThrow(/menor que uno/);
    expect(() => generar({ tipoPuerta: "corredera", puertas: 1 })).toThrow(/dos hojas/);
    expect(() => generar({ ancho: 30.0 })).toThrow(/interior entre costados/);
  });
});
