/**
 * Trasera encastrada en ranura: clóset, cajonera, cocina y librero.
 *
 * La geometría sale del *Manual Técnico de Melamina #02* (ranura de 9 mm de
 * profundidad a 15 mm del borde del dorso) y del ancho mínimo de ranura del
 * perfil Cortecloud/Madijal (5.7 mm). Los valores siguen `por revisar` contra
 * el fresol del taller: ver `docs/por-revisar.md`.
 */

import { describe, expect, it } from "vitest";

import { generar as generarCajonera } from "../src/modules/cajonera.js";
import { generar as generarCloset } from "../src/modules/closet.js";
import { generar as generarCocina } from "../src/modules/cocina.js";
import { generar as generarLibrero } from "../src/modules/librero.js";
import {
  RANURA_TRASERA_ANCHO_DEFAULT,
  RANURA_TRASERA_DISTANCIA_DEFAULT,
  RANURA_TRASERA_PROFUNDIDAD_DEFAULT,
  encajeTrasera,
} from "../src/modules/common.js";
import { generarModulo } from "../src/modules/index.js";
import type { Modulo } from "../src/modules/modulo.js";
import type { Pieza } from "../src/modules/parts.js";
import { aprox } from "./helpers/aprox.js";

function buscar(modulo: Modulo, nombre: string): Pieza {
  for (const linea of modulo.resumen()) {
    if (linea.nombre === nombre) return linea;
  }
  throw new Error(`no se generó la pieza ${JSON.stringify(nombre)}`);
}

describe("encaje de la trasera", () => {
  it("valores por omisión: ranura de 5.7 x 9 mm a 15 mm del dorso", () => {
    expect(RANURA_TRASERA_ANCHO_DEFAULT).toBe(5.7);
    expect(RANURA_TRASERA_PROFUNDIDAD_DEFAULT).toBe(9.0);
    expect(RANURA_TRASERA_DISTANCIA_DEFAULT).toBe(15.0);
  });

  it("la trasera crece el doble de la profundidad de la ranura", () => {
    const encaje = encajeTrasera({
      anchoInterior: 1464.0,
      altoInterior: 2364.0,
      fondo: 600.0,
    });
    aprox(encaje.ancho, 1482.0);
    aprox(encaje.largo, 2382.0);
    expect(encaje.ranura).toEqual({ cara: "i", profundidad: 9.0, ancho: 5.7, distancia: 15.0 });
  });

  it("la holgura del panel es el ancho de la ranura menos el espesor de la trasera", () => {
    // 5.7 mm de ranura para la trasera de 3 mm del perfil: 2.7 mm de holgura.
    aprox(
      encajeTrasera({ anchoInterior: 400.0, altoInterior: 800.0, fondo: 500.0 }).holgura,
      2.7,
    );
    // La ranura de 4 mm del manual, con un panel de 3 mm, deja 1 mm.
    aprox(
      encajeTrasera({
        anchoInterior: 400.0,
        altoInterior: 800.0,
        fondo: 500.0,
        anchoRanura: 4.0,
        espesorTrasera: 3.0,
      }).holgura,
      1.0,
    );
  });

  it("rechaza una ranura que no admite el espesor de la trasera", () => {
    expect(() =>
      encajeTrasera({
        anchoInterior: 400.0,
        altoInterior: 800.0,
        fondo: 500.0,
        anchoRanura: 3.0,
        espesorTrasera: 3.0,
      }),
    ).toThrow(/no admite la trasera/);
  });

  it("rechaza medidas no positivas y una ranura que no cabe en el fondo", () => {
    expect(() =>
      encajeTrasera({ anchoInterior: 400.0, altoInterior: 800.0, fondo: 300.0, anchoRanura: 0 }),
    ).toThrow(/mayores que cero/);
    expect(() =>
      encajeTrasera({ anchoInterior: 400.0, altoInterior: 800.0, fondo: 20.0 }),
    ).toThrow(/no cabe en el fondo/);
  });
});

describe("clóset · trasera en ranura", () => {
  it("ranura en costados, base y tapa", () => {
    const modulo = generarCloset();
    for (const nombre of ["Costado", "Base", "Tapa"]) {
      const pieza = buscar(modulo, nombre);
      expect(pieza.mecanizado.ranuras.length, nombre).toBe(1);
      expect(pieza.mecanizado.ranuras[0]).toEqual({
        cara: "i",
        profundidad: 9.0,
        ancho: 5.7,
        distancia: 15.0,
      });
      expect(pieza.funcion).toContain("ranura para la trasera");
    }
    expect(buscar(modulo, "Costado").funcion).toContain("15.0 mm del borde del dorso");
  });

  it("la trasera encastra en el interior y las repisas se recortan", () => {
    const modulo = generarCloset();
    const trasera = buscar(modulo, "Trasera");
    aprox(trasera.largo, 2382.0);
    aprox(trasera.ancho, 1482.0);
    expect(trasera.funcion).toContain("encastrada");
    aprox(buscar(modulo, "Repisa").largo, 579.3);
    expect(modulo.notas.some((n) => n.includes("Trasera encastrada 2382 x 1482 mm"))).toBe(true);
    expect(modulo.notas.some((n) => n.includes("Repisas de 579 mm de fondo"))).toBe(true);
  });

  it("con trasera_ranura: false vuelve la trasera clavada al dorso", () => {
    const modulo = generarCloset({ traseraRanura: false });
    const trasera = buscar(modulo, "Trasera");
    aprox(trasera.largo, 2400.0);
    aprox(trasera.ancho, 1500.0);
    expect(trasera.funcion).toContain("clavada al dorso");
    expect(buscar(modulo, "Costado").mecanizado.vacio()).toBe(true);
    aprox(buscar(modulo, "Repisa").largo, 600.0);
    expect(modulo.notas).toContain("La trasera se clava/atornilla al dorso, sin ranura.");
  });

  it("sin trasera no hay ranura", () => {
    const modulo = generarCloset({ traseraEspesor: 0 });
    expect(buscar(modulo, "Costado").mecanizado.vacio()).toBe(true);
    expect(modulo.resumen().some((p) => p.nombre === "Trasera")).toBe(false);
  });

  it("acepta otra ranura y recalcula la trasera", () => {
    const modulo = generarCloset({
      fondo: 600.0,
      ranuraAncho: 6.7,
      ranuraProfundidad: 10.0,
      ranuraDistancia: 20.0,
    });
    const ranura = buscar(modulo, "Base").mecanizado.ranuras[0];
    expect(ranura).toEqual({ cara: "i", profundidad: 10.0, ancho: 6.7, distancia: 20.0 });
    aprox(buscar(modulo, "Trasera").largo, 2384.0);
    aprox(buscar(modulo, "Repisa").largo, 573.3);
  });

  it("el parámetro del registro llega al generador", () => {
    const modulo = generarModulo("closet", { trasera_ranura: false });
    expect(buscar(modulo, "Costado").mecanizado.vacio()).toBe(true);
  });
});

describe("cajonera · trasera en ranura", () => {
  it("ranura en costados, base y tapa", () => {
    const modulo = generarCajonera();
    for (const nombre of ["Costado", "Base", "Tapa"]) {
      expect(buscar(modulo, nombre).mecanizado.ranuras.length, nombre).toBe(1);
    }
    expect(buscar(modulo, "Travesaño trasero").mecanizado.vacio()).toBe(true);
  });

  it("la trasera encastra y el travesaño queda por delante", () => {
    const modulo = generarCajonera();
    const trasera = buscar(modulo, "Trasera");
    aprox(trasera.largo, 782.0);
    aprox(trasera.ancho, 432.0);
    expect(trasera.funcion).toContain("encastrada");
    expect(modulo.notas.some((n) => n.includes("Trasera encastrada 782 x 432 mm"))).toBe(true);
    expect(modulo.notas.some((n) => n.includes("travesaño trasero va por delante"))).toBe(true);
  });

  it("la caja del cajón termina en la cara frontal de la trasera", () => {
    // Con 465 mm de fondo quedan 434.3 mm útiles (465 − 15 de ranura − 5.7 de
    // ancho − 10 de juego), así que entra la corredera de 400 mm; con la trasera
    // clavada quedan 452 mm y entra la de 450 mm.
    const modulo = generarCajonera({ fondo: 465.0 });
    aprox(modulo.medidas["largo_caja_cajon"], 400.0);
    aprox(buscar(modulo, "Lateral cajón").largo, 400.0);
    const sinRanura = generarCajonera({ fondo: 465.0, traseraRanura: false });
    aprox(sinRanura.medidas["largo_caja_cajon"], 450.0);
  });

  it("con los valores por omisión la corredera sigue siendo de 450 mm", () => {
    const modulo = generarCajonera();
    aprox(modulo.medidas["largo_caja_cajon"], 450.0);
    aprox(buscar(modulo, "Lateral cajón").largo, 450.0);
  });

  it("con trasera_ranura: false vuelve la trasera clavada al dorso", () => {
    const modulo = generarCajonera({ traseraRanura: false });
    aprox(buscar(modulo, "Trasera").largo, 800.0);
    aprox(buscar(modulo, "Trasera").ancho, 450.0);
    expect(buscar(modulo, "Costado").mecanizado.vacio()).toBe(true);
    expect(modulo.notas).toContain("La trasera se clava/atornilla al dorso, sin ranura.");
  });

  it("sin trasera no hay ranura", () => {
    const modulo = generarCajonera({ traseraEspesor: 0 });
    expect(buscar(modulo, "Costado").mecanizado.vacio()).toBe(true);
    expect(modulo.resumen().some((p) => p.nombre === "Trasera")).toBe(false);
  });

  it("el perfil por omisión admite el ancho de ranura", () => {
    const modulo = generarCajonera();
    const ranuras = modulo.validar();
    expect(ranuras.filter((h) => h.regla === "ranura_no_permitida")).toEqual([]);
  });
});

describe("cocina · trasera en ranura", () => {
  it("ranura en costados, base y travesaño trasero", () => {
    const modulo = generarCocina();
    for (const nombre of ["Costado", "Base", "Travesaño trasero"]) {
      const pieza = buscar(modulo, nombre);
      expect(pieza.mecanizado.ranuras.length, nombre).toBe(1);
      expect(pieza.mecanizado.ranuras[0], nombre).toEqual({
        cara: "i",
        profundidad: 9.0,
        ancho: 5.7,
        distancia: 15.0,
      });
      expect(pieza.funcion).toContain("ranura para la trasera");
    }
    expect(buscar(modulo, "Costado").funcion).toContain("15.0 mm del borde del dorso");
    expect(buscar(modulo, "Travesaño frontal").mecanizado.vacio()).toBe(true);
    expect(buscar(modulo, "Zócalo frontal").mecanizado.vacio()).toBe(true);
  });

  it("la trasera encastra entre base y travesaño trasero", () => {
    const modulo = generarCocina();
    const trasera = buscar(modulo, "Trasera");
    aprox(trasera.largo, 782.0);
    aprox(trasera.ancho, 582.0);
    expect(trasera.funcion).toContain("encastrada");
    expect(modulo.notas.some((n) => n.includes("Trasera encastrada 782 x 582 mm"))).toBe(true);
    expect(
      modulo.notas.some((n) => n.includes("costados, base y travesaño trasero")),
    ).toBe(true);
  });

  it("con trasera_ranura: false vuelve la trasera clavada al dorso", () => {
    const modulo = generarCocina({ traseraRanura: false });
    aprox(buscar(modulo, "Trasera").largo, 800.0);
    aprox(buscar(modulo, "Trasera").ancho, 600.0);
    expect(buscar(modulo, "Costado").mecanizado.vacio()).toBe(true);
    expect(modulo.notas).toContain("La trasera se clava/atornilla al dorso, sin ranura.");
  });

  it("sin trasera no hay ranura", () => {
    const modulo = generarCocina({ traseraEspesor: 0 });
    expect(buscar(modulo, "Costado").mecanizado.vacio()).toBe(true);
    expect(modulo.resumen().some((p) => p.nombre === "Trasera")).toBe(false);
  });

  it("la caja del cajón termina en la cara frontal de la trasera", () => {
    const modulo = generarCocina({ puertas: 0, cajones: 2 });
    // 582 mm de costado − (15 mm de ranura + 5.7 mm de ancho) − 10 mm de juego.
    aprox(buscar(modulo, "Lateral cajón").largo, 500.0);
    const sinRanura = generarCocina({ puertas: 0, cajones: 2, traseraRanura: false });
    expect(buscar(sinRanura, "Lateral cajón").largo).toBe(500.0);
  });

  it("el fondo útil del cajón de la cocina depende de la trasera encastrada", () => {
    // Con 490 mm de fondo el costado mide 472 mm: con ranura quedan
    // 441.3 mm útiles (472 − 20.7 − 10) y entra la corredera de 400 mm; con la
    // trasera clavada quedan 459 mm y entra la de 450 mm.
    const modulo = generarCocina({ fondo: 490.0, puertas: 0, cajones: 2 });
    aprox(modulo.medidas["fondo_util_cajon"], 441.3);
    aprox(modulo.medidas["largo_caja_cajon"], 400.0);
    aprox(buscar(modulo, "Lateral cajón").largo, 400.0);
    const sinRanura = generarCocina({
      fondo: 490.0,
      puertas: 0,
      cajones: 2,
      traseraRanura: false,
    });
    aprox(sinRanura.medidas["fondo_util_cajon"], 459.0);
    aprox(sinRanura.medidas["largo_caja_cajon"], 450.0);
    aprox(buscar(sinRanura, "Lateral cajón").largo, 450.0);
  });

  it("la cocina informa el fondo útil y la holgura de la ranura", () => {
    const modulo = generarCocina({ puertas: 0, cajones: 2 });
    aprox(modulo.medidas["fondo_util_cajon"], 551.3);
    aprox(modulo.medidas["largo_caja_cajon"], 500.0);
    expect(modulo.notas.some((n) => n.includes("Fondo útil para el cajón: 551.3 mm"))).toBe(true);
    expect(modulo.notas.some((n) => n.includes("2.7 mm de holgura"))).toBe(true);
  });

  it("el perfil por omisión admite el ancho de ranura", () => {
    const modulo = generarCocina();
    expect(modulo.validar().filter((h) => h.regla === "ranura_no_permitida")).toEqual([]);
  });

  it("el parámetro del registro llega al generador", () => {
    const modulo = generarModulo("cocina", { trasera_ranura: false });
    expect(buscar(modulo, "Costado").mecanizado.vacio()).toBe(true);
  });
});

describe("librero · trasera en ranura", () => {
  it("ranura en costados, base y tapa", () => {
    const modulo = generarLibrero();
    for (const nombre of ["Costado", "Base", "Tapa"]) {
      expect(buscar(modulo, nombre).mecanizado.ranuras.length, nombre).toBe(1);
    }
    expect(buscar(modulo, "Costado").funcion).toContain("15.0 mm del borde del dorso");
  });

  it("la trasera encastra y las repisas se recortan", () => {
    const modulo = generarLibrero();
    const trasera = buscar(modulo, "Trasera");
    aprox(trasera.largo, 1982.0);
    aprox(trasera.ancho, 782.0);
    expect(trasera.funcion).toContain("encastrada");
    aprox(buscar(modulo, "Repisa").largo, 279.3);
    expect(modulo.notas.some((n) => n.includes("Trasera encastrada 1982 x 782 mm"))).toBe(true);
    expect(modulo.notas.some((n) => n.includes("Repisas de 279 mm de fondo"))).toBe(true);
  });

  it("con trasera_ranura: false vuelve la trasera clavada al dorso", () => {
    const modulo = generarLibrero({ traseraRanura: false });
    aprox(buscar(modulo, "Trasera").largo, 2000.0);
    aprox(buscar(modulo, "Trasera").ancho, 800.0);
    expect(buscar(modulo, "Costado").mecanizado.vacio()).toBe(true);
    aprox(buscar(modulo, "Repisa").largo, 300.0);
    expect(modulo.notas).toContain("La trasera se clava/atornilla al dorso, sin ranura.");
  });

  it("sin trasera no hay ranura", () => {
    const modulo = generarLibrero({ traseraEspesor: 0 });
    expect(buscar(modulo, "Costado").mecanizado.vacio()).toBe(true);
    expect(modulo.resumen().some((p) => p.nombre === "Trasera")).toBe(false);
  });

  it("acepta otra ranura y recalcula la trasera", () => {
    const modulo = generarLibrero({
      ranuraAncho: 6.7,
      ranuraProfundidad: 10.0,
      ranuraDistancia: 20.0,
    });
    expect(buscar(modulo, "Base").mecanizado.ranuras[0]).toEqual({
      cara: "i",
      profundidad: 10.0,
      ancho: 6.7,
      distancia: 20.0,
    });
    aprox(buscar(modulo, "Trasera").largo, 1984.0);
    aprox(buscar(modulo, "Repisa").largo, 273.3);
  });

  it("el parámetro del registro llega al generador", () => {
    const modulo = generarModulo("librero", { trasera_ranura: false });
    expect(buscar(modulo, "Costado").mecanizado.vacio()).toBe(true);
  });
});
