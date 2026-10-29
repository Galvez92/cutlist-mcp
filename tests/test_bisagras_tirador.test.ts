/**
 * Peso de los tiradores en la guía de bisagras.
 *
 * Blum (*CLIP top BLUMOTION: Number of hinges*, https://ea.blum.com/en/number-of-hinges/)
 * pide contar la puerta **con sus tiradores**: 2 bisagras de 4 a 6 kg y 3 de 6 a 12 kg.
 * El peso de un tirador sale de una ficha de producto real (tirador recto de acero
 * inoxidable de 96 mm, 0.09 kg, SKU 103910, ficha verificada el 2026-10-29,
 * https://www.promart.pe/tirador-recto-acero-inox-96mm/p); es un valor de
 * referencia: el taller debe pasar el peso del tirador elegido.
 */

import { describe, expect, it } from "vitest";

import {
  PESO_TIRADOR_REFERENCIA,
  bisagrasPuerta,
  notasPesoBisagras,
  pesoPuertaConTiradorKg,
  pesoPuertaKg,
} from "../src/modules/bisagras.js";
import { generar as generarCloset } from "../src/modules/closet.js";
import { generar as generarCocina } from "../src/modules/cocina.js";
import type { Modulo } from "../src/modules/modulo.js";
import { ValueError } from "../src/modules/parts.js";
import { aprox } from "./helpers/aprox.js";

function bisagra(modulo: Modulo) {
  const accesorio = modulo.accesorios.find((a) => a.nombre === "Bisagra");
  if (!accesorio) throw new Error("el módulo no trae bisagras");
  return accesorio;
}

describe("peso de la puerta con tirador", () => {
  it("el peso del tablero no cambia y el tirador se suma aparte", () => {
    // 300 x 900 x 18 a 750 kg/m³ = 3.645 kg de tablero
    aprox(pesoPuertaKg(300.0, 900.0, 18.0), 3.645);
    aprox(pesoPuertaConTiradorKg(300.0, 900.0, 18.0, 0.09), 3.735);
    expect(PESO_TIRADOR_REFERENCIA).toBe(0.09);
  });

  it("el resultado de las bisagras desglosa tablero y tirador", () => {
    const calculo = bisagrasPuerta(300.0, 900.0, 18.0, { pesoTiradorKg: 0.09 });
    aprox(calculo.pesoTableroKg, 3.645);
    aprox(calculo.pesoTiradorKg, 0.09);
    aprox(calculo.pesoKg, 3.735);
    expect(calculo).toMatchObject({ bisagras: 2, porAlto: 2, porPeso: 2 });
  });

  it("el tirador puede cruzar el tramo de 6 kg y pedir la tercera bisagra", () => {
    // Puerta de 3.645 kg: solo el tirador la lleva sobre los 6 kg de Blum.
    const sinTirador = bisagrasPuerta(300.0, 900.0, 18.0, { pesoTiradorKg: 0 });
    const conTirador = bisagrasPuerta(300.0, 900.0, 18.0, { pesoTiradorKg: 2.4 });
    expect(sinTirador).toMatchObject({ bisagras: 2, porPeso: 2 });
    expect(conTirador).toMatchObject({ bisagras: 3, porPeso: 3, porAlto: 2 });
    aprox(conTirador.pesoKg, 6.045);
  });

  it("los avisos dicen cuánto aporta el tirador", () => {
    const notas = notasPesoBisagras(bisagrasPuerta(300.0, 900.0, 18.0, { pesoTiradorKg: 2.4 }));
    expect(notas.length).toBe(1);
    expect(notas[0]).toContain("tablero 3.6 kg + tirador 2.40 kg");
    expect(notas[0]).toContain("la guía de Blum pide 3 bisagras");
  });
});

describe("módulos · peso del tirador en las bisagras", () => {
  it("el clóset pasa de 2 a 3 bisagras por hoja al sumar el tirador", () => {
    // Hoja de 598.5 x 736 x 18 = 5.95 kg: sin tirador se queda en las 2 del alto.
    const sinTirador = generarCloset({
      ancho: 1200.0,
      alto: 739.0,
      puertas: 2,
      barralAltura: null,
      pesoTirador: 0,
    });
    const conTirador = generarCloset({
      ancho: 1200.0,
      alto: 739.0,
      puertas: 2,
      barralAltura: null,
    });
    expect(bisagra(sinTirador).cantidad).toBe(4);
    expect(bisagra(conTirador).cantidad).toBe(6);
    expect(bisagra(conTirador).nota).toContain("tirador 0.09 kg");
  });

  it("la cocina pasa de 2 a 3 bisagras en la puerta que roza los 6 kg", () => {
    // Puerta de 600 x 734.6 x 18 = 5.95 kg.
    const sinTirador = generarCocina({ ancho: 600.0, alto: 837.6, puertas: 1, pesoTirador: 0 });
    const conTirador = generarCocina({ ancho: 600.0, alto: 837.6, puertas: 1 });
    expect(bisagra(sinTirador).cantidad).toBe(2);
    expect(bisagra(conTirador).cantidad).toBe(3);
    expect(conTirador.notas.some((n) => n.includes("tirador 0.09 kg"))).toBe(true);
  });

  it("un tirador pesado se puede modelar y avisa sobre la guía de 12 kg", () => {
    const modulo = generarCloset({ pesoTirador: 3.0 });
    expect(bisagra(modulo).cantidad).toBe(10);
    expect(
      modulo.notas.some((n) => n.includes("tablero 24.2 kg + tirador 3.00 kg")),
    ).toBe(true);
  });

  it("no acepta un peso de tirador negativo", () => {
    expect(() => generarCloset({ pesoTirador: -0.1 })).toThrow(ValueError);
    expect(() => generarCocina({ pesoTirador: -0.1 })).toThrow(ValueError);
  });
});
