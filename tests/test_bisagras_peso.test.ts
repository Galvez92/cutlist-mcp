/**
 * Guía de bisagras por peso de puerta.
 *
 * Valores esperados tomados de la fuente, no del código:
 * - Blum, *CLIP top BLUMOTION: Number of hinges*: 2 bisagras para puertas de
 *   4–6 kg y 3 para 6–12 kg, contando el peso con sus tiradores; vale para
 *   puertas de hasta 600 mm de ancho y el alto también influye (en puertas altas
 *   y angostas conviene una bisagra extra).
 *   https://ea.blum.com/en/number-of-hinges/
 * - Hettich, *Sensys*, p. 14: tabla por alto para tablero de 19 mm y 750 kg/m³.
 *   https://web.hettich.com/fileadmin/media/Sensys_Catalogue_11309_en.pdf
 */

import { describe, expect, it } from "vitest";

import {
  DENSIDAD_TABLERO,
  PESO_MAXIMO_GUIA_BISAGRAS,
  bisagrasPorPeso,
  bisagrasPorPuerta,
  bisagrasPuerta,
  notasPesoBisagras,
  pesoPuertaKg,
} from "../src/modules/bisagras.js";
import { generar as generarCloset } from "../src/modules/closet.js";
import { generar as generarCocina } from "../src/modules/cocina.js";
import type { Modulo } from "../src/modules/modulo.js";
import { aprox } from "./helpers/aprox.js";

function bisagra(modulo: Modulo) {
  const accesorio = modulo.accesorios.find((a) => a.nombre === "Bisagra");
  if (!accesorio) throw new Error("el módulo no trae bisagras");
  return accesorio;
}

describe("peso de la puerta", () => {
  it("sale de área × espesor × densidad", () => {
    // 0.6 m x 0.9 m x 0.018 m x 750 kg/m³
    aprox(pesoPuertaKg(600.0, 900.0, 18.0), 7.29);
    aprox(pesoPuertaKg(600.0, 900.0, 18.0, 600.0), 5.832);
    expect(DENSIDAD_TABLERO).toBe(750.0);
  });
});

describe("bisagras por peso (guía de Blum)", () => {
  it("sigue los tramos de 2 y 3 bisagras", () => {
    const casos: [number, number][] = [
      [3.9, 2],
      [6.0, 2],
      [6.1, 3],
      [12.0, 3],
      [13.0, 3], // fuera de guía: el módulo avisa y deja la cantidad a revisar
    ];
    for (const [peso, esperado] of casos) {
      expect(bisagrasPorPeso(peso), `peso ${peso} kg`).toBe(esperado);
    }
    expect(PESO_MAXIMO_GUIA_BISAGRAS).toBe(12.0);
  });

  it("combina el alto y el peso tomando la mayor de las dos guías", () => {
    // 300 x 900 x 18 = 3.6 kg: piden dos las dos guías.
    expect(bisagrasPuerta(300.0, 900.0, 18.0)).toMatchObject({
      bisagras: 2,
      porAlto: 2,
      porPeso: 2,
    });
    // 600 x 900 x 18 = 7.3 kg: el peso pide tres y el alto dos.
    expect(bisagrasPuerta(600.0, 900.0, 18.0)).toMatchObject({
      bisagras: 3,
      porAlto: 2,
      porPeso: 3,
    });
    // 300 x 2100 x 18 = 8.5 kg: el peso pide tres, pero el alto pide cinco.
    expect(bisagrasPuerta(300.0, 2100.0, 18.0)).toMatchObject({
      bisagras: 5,
      porAlto: 5,
      porPeso: 3,
    });
    // Puerta de 25 mm: 10.1 kg con el mismo alto.
    expect(bisagrasPuerta(600.0, 900.0, 25.0)).toMatchObject({ bisagras: 3, porPeso: 3 });
  });

  it("avisa cuando el peso manda o supera la guía", () => {
    const porPeso = notasPesoBisagras(bisagrasPuerta(600.0, 900.0, 18.0));
    expect(porPeso.length).toBe(1);
    expect(porPeso[0]).toContain("la guía de Blum pide 3 bisagras");

    const alto = bisagrasPuerta(600.0, 2400.0, 18.0);
    aprox(alto.pesoKg, 19.44);
    expect(notasPesoBisagras(alto).some((n) => n.includes("llega a 12 kg"))).toBe(true);
  });
});

describe("módulos · bisagras por peso", () => {
  it("la cocina pide una bisagra más en la puerta de 600 mm que pesa 6.5 kg", () => {
    const modulo = generarCocina({ puertas: 1 });
    expect(bisagra(modulo).cantidad).toBe(3);
    expect(modulo.notas.some((n) => n.includes("la guía de Blum pide 3 bisagras"))).toBe(true);
    expect(bisagrasPorPuerta(797.0)).toBe(2); // la guía por alto pediría dos
  });

  it("las hojas angostas del clóset conservan las del alto", () => {
    const modulo = generarCloset({ ancho: 600.0 });
    const calculo = bisagrasPuerta(298.5, 2397.0, 18.0);
    expect(calculo.porPeso).toBe(3);
    expect(calculo.porAlto).toBe(5);
    expect(bisagra(modulo).cantidad).toBe(10);
  });

  it("avisa en el clóset cuando la hoja supera los 12 kg de la guía", () => {
    const modulo = generarCloset();
    const calculo = bisagrasPuerta(748.5, 2397.0, 18.0);
    aprox(calculo.pesoKg, 24.221086);
    expect(calculo.pesoKg).toBeGreaterThan(PESO_MAXIMO_GUIA_BISAGRAS);
    expect(
      modulo.notas.some((n) => n.includes("la guía de bisagras por peso llega a 12 kg")),
    ).toBe(true);
    expect(bisagra(modulo).cantidad).toBe(10);
  });
});
