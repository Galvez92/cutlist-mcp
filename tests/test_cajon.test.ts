/** Pruebas del generador de cajón individual. */

import { describe, expect, it } from "vitest";

import { generarModulo, obtener } from "../src/modules/index.js";
import { generar } from "../src/modules/cajon.js";
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

describe("cajon · medidas", () => {
  it("medidas del cajón por omisión", () => {
    const modulo = generar();
    const lateral = buscar(modulo, "Lateral");
    aprox(lateral.largo, 500.0);
    aprox(lateral.ancho, 150.0);
    expect(lateral.cantidad).toBe(2);

    const frente = buscar(modulo, "Frente");
    aprox(frente.largo, 564.0); // 600 - 2*18
    aprox(frente.ancho, 150.0);
    expect(frente.cantidad).toBe(1);

    const trasera = buscar(modulo, "Trasera");
    aprox(trasera.largo, 564.0);
    aprox(trasera.ancho, 150.0);

    const fondo = buscar(modulo, "Fondo");
    // fondo_interior + 2*ranura_profundidad = 464 + 20 = 484
    // ancho_interior + 2*ranura_profundidad = 564 + 20 = 584
    aprox(fondo.largo, 584.0);
    aprox(fondo.ancho, 484.0);
    expect(fondo.espesor).toBe(3.0);
    expect(fondo.veta).toBe("indiferente");
    expect(fondo.cantos.vacio()).toBe(true);

    aprox(modulo.medidas["ancho_interior"], 564.0);
    aprox(modulo.medidas["fondo_interior"], 464.0);
  });

  it("sin fondo cuando fondo_espesor es cero", () => {
    const modulo = generar({ fondoEspesor: 0 });
    expect(modulo.resumen().some((l) => l.nombre === "Fondo")).toBe(false);
    // sin ranura en el mecanizado
    const lateral = buscar(modulo, "Lateral");
    expect(lateral.mecanizado.ranuras.length).toBe(0);
  });

  it("medidas personalizadas", () => {
    const modulo = generar({ ancho: 400, fondo: 450, alto: 200, espesor: 16 });
    const lateral = buscar(modulo, "Lateral");
    aprox(lateral.largo, 450.0);
    aprox(lateral.ancho, 200.0);
    const frente = buscar(modulo, "Frente");
    aprox(frente.largo, 368.0); // 400 - 2*16
  });
});

describe("cajon · mecanizado (fondo en ranura + minifix)", () => {
  it("ranura en laterales, frente y trasera", () => {
    const modulo = generar();
    const lateral = buscar(modulo, "Lateral");
    expect(lateral.mecanizado.ranuras.length).toBe(1);
    const ranura = lateral.mecanizado.ranuras[0];
    aprox(ranura.ancho, 6.7);
    aprox(ranura.distancia, 15.0);
    aprox(ranura.profundidad, 10.0);

    const frente = buscar(modulo, "Frente");
    expect(frente.mecanizado.ranuras.length).toBe(1);
  });

  it("excentricas minifix Ø15 en el lateral (4 barrenos verticales)", () => {
    const modulo = generar();
    const lateral = buscar(modulo, "Lateral");
    const cams = lateral.mecanizado.barrenos.filter((b) => !b.horizontal);
    expect(cams.length).toBe(4);
    for (const cam of cams) {
      aprox(cam.diametro, 15.0);
      expect(cam.horizontal).toBe(false);
    }
    // a 50 mm de las orillas
    const ys = cams.map((c) => c.y).sort((a, b) => a - b);
    aprox(ys[0], 50.0); // desde abajo
    aprox(ys[1], 50.0);
    aprox(ys[2], 100.0); // 150 - 50 desde arriba
    aprox(ys[3], 100.0);
  });

  it("pines minifix Ø9.525 en frente y trasera (4 barrenos horizontales)", () => {
    const modulo = generar();
    const frente = buscar(modulo, "Frente");
    const pines = frente.mecanizado.barrenos.filter((b) => b.horizontal);
    expect(pines.length).toBe(4);
    for (const pin of pines) {
      aprox(pin.diametro, 9.525);
      expect(pin.horizontal).toBe(true);
    }
    // en los cantos (x = 0 y x = ancho_interior)
    const xs = pines.map((p) => p.x).sort((a, b) => a - b);
    aprox(xs[0], 0.0);
    aprox(xs[2], 564.0); // ancho_interior
  });

  it("fondo no lleva mecanizado", () => {
    const modulo = generar();
    const fondo = buscar(modulo, "Fondo");
    expect(fondo.mecanizado.vacio()).toBe(true);
  });
});

describe("cajon · cantos", () => {
  it("lateral y frente llevan canto en la arista superior", () => {
    const modulo = generar();
    expect(buscar(modulo, "Lateral").cantos.porArista()).toEqual({ largo_a: "PVC 0.4 mm" });
    expect(buscar(modulo, "Frente").cantos.porArista()).toEqual({ largo_a: "PVC 0.4 mm" });
  });

  it("trasera sin canto", () => {
    const modulo = generar();
    expect(buscar(modulo, "Trasera").cantos.vacio()).toBe(true);
  });
});

describe("cajon · correderas al centro", () => {
  it("corredera estándar de 500 mm", () => {
    const modulo = generar({ fondo: 500 });
    const corredera = modulo.accesorios.find((a) => a.nombre === "Corredera al centro");
    expect(corredera).toBeDefined();
    expect(corredera!.nota).toContain("500");
  });

  it("avisa cuando no hay corredera estándar", () => {
    const modulo = generar({ fondo: 380 });
    expect(modulo.notas.some((n) => n.includes("por revisar"))).toBe(true);
    aprox(modulo.medidas["largo_corredera"], 380.0);
  });
});

describe("cajon · accesorios", () => {
  it("minifix y tirador", () => {
    const modulo = generar();
    const accesorios = new Map(modulo.accesorios.map((a) => [a.nombre, a]));
    expect(accesorios.get("Minifix")!.cantidad).toBe(8);
    expect(accesorios.get("Tirador o manija")!.cantidad).toBe(1);
  });
});

describe("cajon · validación y errores", () => {
  it("respeta el perfil Cortecloud/Madijal", () => {
    expect(errores(generar().validar())).toEqual([]);
  });

  it("medidas inválidas fallan", () => {
    expect(() => generar({ ancho: 30.0 })).toThrow(/interior entre laterales/);
    expect(() => generar({ distanciaMinifix: 100.0, alto: 150.0 })).toThrow(/no caben/);
  });

  it("ranura que no cabe en el alto", () => {
    expect(() =>
      generar({ alto: 110.0, ranuraDistancia: 105.0, ranuraAncho: 6.7 }),
    ).toThrow(/ranura del fondo no cabe/);
  });
});

describe("cajon · registro", () => {
  it("generar_modulo desde el registro con valores JSON", () => {
    const modulo = generarModulo("cajon", { ancho: 500, fondo: 450 });
    expect(modulo.tipo).toBe("cajon");
    expect(buscar(modulo, "Lateral").largo).toBe(450);
    expect(buscar(modulo, "Frente").largo).toBe(464); // 500 - 2*18

    expect(() => generarModulo("cajon", { inventado: 1 })).toThrow(/desconocido/);
  });

  it("el registro expone los campos", () => {
    const campos = obtener("cajon").camposUi();
    expect(campos.some((c) => c.nombre === "ancho")).toBe(true);
    expect(campos.some((c) => c.nombre === "distancia_minifix")).toBe(true);
    expect(campos.every((c) => c.descripcion.length > 0)).toBe(true);
  });

  it("idea escrita: cajón ancho=450", () => {
    const modulo = generarModulo("cajon", { ancho: "450" });
    expect(modulo.tipo).toBe("cajon");
    aprox(buscar(modulo, "Frente").largo, 414.0);
  });
});
