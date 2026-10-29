/** Pruebas del generador de mueble bajo de cocina (ARAUCO #17). */

import { describe, expect, it } from "vitest";

import { bisagrasPorPuerta } from "../src/modules/bisagras.js";
import { generar } from "../src/modules/cocina.js";
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

describe("cocina · cuerpo", () => {
  it("medidas del cuerpo", () => {
    const modulo = generar();
    aprox(modulo.medidas["alto_carcasa"], 800.0);
    aprox(modulo.medidas["fondo_costado"], 582.0);
    aprox(modulo.medidas["ancho_interior"], 564.0);

    const costado = buscar(modulo, "Costado");
    expect([costado.largo, costado.ancho, costado.cantidad]).toEqual([800.0, 582.0, 2]);
    expect(costado.cantos.porArista()).toEqual({ largo_a: "PVC 0.4 mm" });

    const base = buscar(modulo, "Base");
    expect([base.largo, base.ancho]).toEqual([582.0, 564.0]);
    expect(buscar(modulo, "Travesaño frontal").largo).toBe(564.0);
    expect(buscar(modulo, "Travesaño frontal").ancho).toBe(100.0);
    expect(buscar(modulo, "Travesaño trasero").cantidad).toBe(1);
    expect(buscar(modulo, "Trasera").espesor).toBe(3.0);
  });

  it("alturas y profundidad según ARAUCO", () => {
    const modulo = generar();
    expect(100.0 + modulo.medidas["alto_carcasa"] + 0.0).toBe(900.0);
    expect(modulo.medidas["fondo_costado"] + 18.0).toBe(600.0);
  });

  it("zócalo retranqueado", () => {
    const modulo = generar();
    const frontal = buscar(modulo, "Zócalo frontal");
    expect([frontal.largo, frontal.ancho]).toEqual([600.0, 100.0]);
    expect(frontal.cantos.porArista()).toEqual({ largo_a: "PVC 0.4 mm" });

    const lateral = buscar(modulo, "Zócalo lateral");
    expect([lateral.largo, lateral.ancho]).toEqual([582.0 - 75.0, 100.0]);
    expect(lateral.cantidad).toBe(2);
    expect(lateral.cantos.vacio()).toBe(true);
    expect(modulo.notas.some((n) => n.includes("retranqueado 75"))).toBe(true);
  });
});

describe("cocina · frentes", () => {
  it("puertas cubrientes con bisagras y patas", () => {
    const modulo = generar();
    const puerta = buscar(modulo, "Puerta");
    expect([puerta.cantidad, puerta.largo]).toEqual([2, 797.0]);
    aprox(puerta.ancho, (600.0 - 3.0) / 2);
    expect(puerta.cantos.cantidad()).toBe(4);

    const accesorios = new Map(modulo.accesorios.map((a) => [a.nombre, a]));
    expect(accesorios.get("Bisagra")!.cantidad).toBe(4);
    expect(accesorios.get("Pata regulable")!.cantidad).toBe(4);
  });

  it("cajones en lugar de puertas", () => {
    const modulo = generar({ puertas: 0, cajones: 2 });
    const frente = buscar(modulo, "Frente de cajón");
    expect(frente.cantidad).toBe(2);
    expect(frente.ancho).toBe(600.0);
    expect(modulo.resumen().some((l) => l.rol === "puerta")).toBe(false);

    const anchoCaja = 564.0 - 25.0;
    const laterales = buscar(modulo, "Lateral cajón");
    expect(laterales.largo).toBe(500.0);
    aprox(laterales.ancho, (800.0 - 3.0) / 2 - 20.0);
    aprox(buscar(modulo, "Piso cajón").ancho, anchoCaja);
  });

  it("puertas y cajones no se mezclan", () => {
    expect(() => generar({ puertas: 1, cajones: 1 })).toThrow(/puertas o cajones/);
  });
});

describe("cocina · bisagras (guía verificada)", () => {
  function bisagras(modulo: Modulo): number {
    return modulo.accesorios.find((a) => a.nombre === "Bisagra")!.cantidad;
  }

  it("sigue los tramos 2/3/4/5 de la guía de Hettich por alto de puerta", () => {
    // altoPuerta = alto - zócalo (100) - juego (3)
    const casos: [number, number][] = [
      [1003, 2], // puerta de 900 mm
      [1004, 3], // puerta de 901 mm
      [1700, 3], // puerta de 1597 mm
      [1800, 4], // puerta de 1697 mm
      [2200, 5], // puerta de 2097 mm
      [2500, 5], // puerta de 2397 mm
    ];
    for (const [alto, esperado] of casos) {
      const modulo = generar({ alto, puertas: 1 });
      expect([alto, bisagras(modulo)], `alto ${alto}`).toEqual([alto, esperado]);
    }
  });

  it("usa la misma tabla que el clóset", () => {
    const modulo = generar({ alto: 2200, puertas: 1 });
    const puerta = buscar(modulo, "Puerta");
    expect(bisagras(modulo)).toBe(bisagrasPorPuerta(puerta.largo));
    expect(bisagras(modulo)).toBe(5);
  });

  it("avisa cuando las puertas superan el alto de la guía", () => {
    const modulo = generar({ alto: 2600, puertas: 1 });
    expect(bisagras(modulo)).toBe(5);
    expect(
      modulo.notas.some((n) => n.includes("la guía de bisagras llega a 2400 mm")),
    ).toBe(true);
  });

  it("avisa cuando las puertas superan el ancho de la guía", () => {
    const modulo = generar({ ancho: 1400, puertas: 1 });
    expect(
      modulo.notas.some((n) => n.includes("vale hasta 600 mm por hoja")),
    ).toBe(true);
  });
});

describe("cocina · validación y errores", () => {
  it("respeta el perfil por omisión", () => {
    expect(errores(generar().validar())).toEqual([]);
    expect(errores(generar({ puertas: 0, cajones: 3 }).validar())).toEqual([]);
  });

  it("medidas inválidas fallan", () => {
    expect(() => generar({ alto: 80.0 })).toThrow(/alto de carcasa/);
    expect(() => generar({ espesorPuerta: 600.0 })).toThrow(/profundidad de costado/);
    expect(() => generar({ retranqueoZocalo: 900.0 })).toThrow(/retranqueo del zócalo/);
  });
});
