/** Pruebas del generador de escritorio con faldón. */

import { describe, expect, it } from "vitest";

import { generarModulo, obtener } from "../src/modules/index.js";
import { generar, FALDON_MINIMO } from "../src/modules/escritorio.js";
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

describe("escritorio · medidas", () => {
  it("medidas por omisión", () => {
    const modulo = generar();
    const cubierta = buscar(modulo, "Cubierta");
    aprox(cubierta.largo, 600.0); // fondo
    aprox(cubierta.ancho, 1200.0); // ancho
    expect(cubierta.cantidad).toBe(1);
    expect(cubierta.rol).toBe("cubierta");

    const costado = buscar(modulo, "Costado");
    aprox(costado.largo, 732.0); // 750 - 18
    aprox(costado.ancho, 600.0); // fondo
    expect(costado.cantidad).toBe(2);

    const faldon = buscar(modulo, "Faldón");
    aprox(faldon.largo, 1164.0); // 1200 - 2*18
    aprox(faldon.ancho, 100.0); // faldon
    expect(faldon.cantidad).toBe(1);

    const travesano = buscar(modulo, "Travesaño trasero");
    aprox(travesano.largo, 1164.0);
    aprox(travesano.ancho, 100.0);

    aprox(modulo.medidas["ancho_interior"], 1164.0);
    aprox(modulo.medidas["alto_costado"], 732.0);
  });

  it("faldón mínimo de 70 mm", () => {
    const modulo = generar({ faldon: 70.0 });
    const faldon = buscar(modulo, "Faldón");
    aprox(faldon.ancho, 70.0);
    expect(errores(modulo.validar())).toEqual([]);
  });

  it("espesor_cubierta distinto al cuerpo", () => {
    const modulo = generar({ espesorCubierta: 25.0 });
    const cubierta = buscar(modulo, "Cubierta");
    expect(cubierta.espesor).toBe(25.0);
    const costado = buscar(modulo, "Costado");
    aprox(costado.largo, 725.0); // 750 - 25
  });

  it("medidas personalizadas", () => {
    const modulo = generar({ ancho: 900, fondo: 500, alto: 720, faldon: 80 });
    const faldon = buscar(modulo, "Faldón");
    aprox(faldon.largo, 864.0); // 900 - 2*18
    aprox(faldon.ancho, 80.0);
  });
});

describe("escritorio · faldón ≥ 70 mm", () => {
  it("faldón por omisión es 100 mm (≥ 70)", () => {
    expect(FALDON_MINIMO).toBe(70.0);
    const modulo = generar();
    aprox(buscar(modulo, "Faldón").ancho, 100.0);
  });

  it("faldón de 69 mm falla", () => {
    expect(() => generar({ faldon: 69.0 })).toThrow(/menor al mínimo de 70/);
  });

  it("faldón de 70 mm pasa", () => {
    const modulo = generar({ faldon: 70.0 });
    aprox(buscar(modulo, "Faldón").ancho, 70.0);
  });
});

describe("escritorio · cantos", () => {
  it("cubierta con canto en frente y costados", () => {
    const modulo = generar();
    const cubierta = buscar(modulo, "Cubierta");
    expect(cubierta.cantos.porArista()).toEqual({
      largo_a: "PVC 0.4 mm",
      largo_b: "PVC 0.4 mm",
      ancho_a: "PVC 0.4 mm",
    });
  });

  it("costado con canto en la arista frontal", () => {
    const modulo = generar();
    expect(buscar(modulo, "Costado").cantos.porArista()).toEqual({ largo_a: "PVC 0.4 mm" });
  });

  it("faldón con canto en la arista inferior", () => {
    const modulo = generar();
    const faldon = buscar(modulo, "Faldón");
    expect(faldon.cantos.porArista()).toEqual({ ancho_b: "PVC 0.4 mm" });
  });

  it("travesaño trasero sin canto", () => {
    const modulo = generar();
    expect(buscar(modulo, "Travesaño trasero").cantos.vacio()).toBe(true);
  });

  it("material_cubierta y canto_cubierta personalizados", () => {
    const modulo = generar({
      materialCubierta: "Roble Americano 18 mm",
      cantoCubierta: "PVC Roble 0.4 mm",
    });
    const cubierta = buscar(modulo, "Cubierta");
    expect(cubierta.material).toBe("Roble Americano 18 mm");
    expect(cubierta.cantos.largoA).toBe("PVC Roble 0.4 mm");
  });
});

describe("escritorio · validación y errores", () => {
  it("respeta el perfil Cortecloud/Madijal", () => {
    expect(errores(generar().validar())).toEqual([]);
  });

  it("medidas inválidas fallan", () => {
    expect(() => generar({ ancho: 30.0 })).toThrow(/interior entre costados/);
    expect(() => generar({ alto: 10.0, espesorCubierta: 18.0 })).toThrow(/alto para los costados/);
    expect(() => generar({ faldon: 800.0, alto: 750.0 })).toThrow(/no cabe/);
  });
});

describe("escritorio · registro", () => {
  it("generar_modulo desde el registro con valores JSON", () => {
    const modulo = generarModulo("escritorio", { ancho: 1000, faldon: 90 });
    expect(modulo.tipo).toBe("escritorio");
    aprox(buscar(modulo, "Faldón").largo, 964.0);
    aprox(buscar(modulo, "Faldón").ancho, 90.0);

    expect(() => generarModulo("escritorio", { inventado: 1 })).toThrow(/desconocido/);
  });

  it("el registro expone los campos", () => {
    const campos = obtener("escritorio").camposUi();
    expect(campos.some((c) => c.nombre === "ancho")).toBe(true);
    expect(campos.some((c) => c.nombre === "faldon")).toBe(true);
    expect(campos.every((c) => c.descripcion.length > 0)).toBe(true);
  });
});
