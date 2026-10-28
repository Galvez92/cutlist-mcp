/** Pruebas del perfil de restricciones Cortecloud/Madijal (MEMORIA.md). */

import { describe, expect, it } from "vitest";

import { Cantos, Mecanizado, Pieza, barreno, ranura } from "../src/modules/parts.js";
import type { PiezaInit } from "../src/modules/parts.js";
import {
  PERFIL_CORTECLOUD_MADIJAL,
  PERFILES,
  avisos,
  errores,
  resumenHallazgos,
  validar,
  validarPieza,
} from "../src/modules/profiles.js";
import type { Hallazgo, PerfilInit } from "../src/modules/profiles.js";

const PERFIL = PERFIL_CORTECLOUD_MADIJAL;

function pieza(cambios: Partial<PiezaInit> = {}): Pieza {
  return new Pieza({ nombre: "Pieza", largo: 500.0, ancho: 300.0, ...cambios });
}

function reglas(hallazgos: Hallazgo[]): string[] {
  return hallazgos.map((h) => h.regla);
}

describe("perfil Cortecloud/Madijal", () => {
  it("está cargado en el registro", () => {
    expect(PERFILES["cortecloud_madijal"]).toBe(PERFIL);
    expect(PERFIL.piezaMinCorte).toBe(65.0);
    expect(PERFIL.barrenosHorizontales).toEqual([9.525]);
    expect(PERFIL.ranurasPermitidas).toContain(9.7);
  });

  it("pieza correcta no tiene hallazgos", () => {
    expect(validarPieza(pieza(), PERFIL)).toEqual([]);
  });

  it("pieza bajo el mínimo de corte es error", () => {
    const hallazgos = validarPieza(pieza({ ancho: 60.0 }), PERFIL);
    expect(reglas(hallazgos)).toEqual(["pieza_minima"]);
    expect(hallazgos[0].nivel).toBe("error");
  });

  it("pieza entre mínimo y recomendado es aviso", () => {
    const hallazgos = validarPieza(pieza({ ancho: 68.0 }), PERFIL);
    expect(reglas(hallazgos)).toEqual(["pieza_minima_recomendada"]);
    expect(hallazgos[0].nivel).toBe("aviso");
  });

  it("medida terminada ajustada con canto en ambos lados", () => {
    const conCanto = pieza({ ancho: 65.0, cantos: new Cantos("PVC", "PVC") });
    expect(reglas(validarPieza(conCanto, PERFIL))).toEqual([
      "pieza_minima_recomendada",
      "pieza_terminada_ajustada",
    ]);
  });

  it("pieza sin canto no avisa por medida terminada", () => {
    expect(reglas(validarPieza(pieza({ ancho: 65.0 }), PERFIL))).toEqual([
      "pieza_minima_recomendada",
    ]);
  });

  it("dimensión cero es error y corta la validación", () => {
    expect(reglas(validarPieza(pieza({ largo: 0.0 }), PERFIL))).toEqual(["dimension_invalida"]);
  });

  it("pieza mayor que la máxima es error", () => {
    expect(reglas(validarPieza(pieza({ largo: 2490.0, ancho: 1800.0 }), PERFIL))).toEqual([
      "pieza_maxima",
    ]);
  });

  it("pieza girada cabe en la máxima", () => {
    expect(validarPieza(pieza({ largo: 1800.0, ancho: 2480.0 }), PERFIL)).toEqual([]);
  });

  it("pieza que cabe en la máxima pero no en el tablero avisa", () => {
    const perfilGrande = PERFIL.con({
      piezaMaxLargo: 3000.0,
      piezaMaxAncho: 3000.0,
    } as Partial<PerfilInit>);
    expect(reglas(validarPieza(pieza({ largo: 2530.0, ancho: 400.0 }), perfilGrande))).toEqual([
      "no_cabe_en_tablero",
    ]);
  });

  it("pieza mecanizada corta es error", () => {
    const corta = pieza({
      largo: 200.0,
      ancho: 300.0,
      mecanizado: new Mecanizado([], [barreno({ diametro: 5.0 })]),
    });
    expect(reglas(validarPieza(corta, PERFIL))).toEqual(["pieza_mecanizada_corta"]);
  });

  it("ranura permitida no avisa y la no permitida es error", () => {
    const permitida = pieza({ mecanizado: new Mecanizado([ranura({ ancho: 9.7 })], []) });
    expect(validarPieza(permitida, PERFIL)).toEqual([]);

    const noPermitida = pieza({ mecanizado: new Mecanizado([ranura({ ancho: 6.0 })], []) });
    expect(reglas(validarPieza(noPermitida, PERFIL))).toEqual(["ranura_no_permitida"]);
  });

  it("barrenos horizontales solo aceptan 3/8", () => {
    const ok = pieza({
      mecanizado: new Mecanizado([], [barreno({ diametro: 9.525, horizontal: true })]),
    });
    expect(validarPieza(ok, PERFIL)).toEqual([]);

    const malo = pieza({
      mecanizado: new Mecanizado([], [barreno({ diametro: 5.0, horizontal: true })]),
    });
    expect(reglas(validarPieza(malo, PERFIL))).toEqual(["barreno_no_permitido"]);
  });

  it("barreno vertical fuera de lista es error", () => {
    const malo = pieza({ mecanizado: new Mecanizado([], [barreno({ diametro: 25.0 })]) });
    expect(reglas(validarPieza(malo, PERFIL))).toEqual(["barreno_no_permitido"]);
  });

  it("aviso de luz de repisa solo si se configura", () => {
    const repisa = pieza({ nombre: "Repisa", rol: "repisa", ancho: 1000.0 });
    expect(validarPieza(repisa, PERFIL)).toEqual([]);

    const conAviso = PERFIL.con({ luzMaxRepisaAviso: 900.0 } as Partial<PerfilInit>);
    expect(reglas(validarPieza(repisa, conAviso))).toEqual(["luz_repisa"]);
  });

  it("validar lista y resumen", () => {
    const hallazgos = validar([pieza({ ancho: 60.0 }), pieza({ ancho: 68.0 }), pieza()], PERFIL);
    const datos = resumenHallazgos(hallazgos);
    expect(datos.errores).toBe(1);
    expect(datos.avisos).toBe(1);
    expect(datos.detalle.length).toBe(2);
    expect(errores(hallazgos).length).toBe(1);
    expect(avisos(hallazgos).length).toBe(1);
  });

  it("hallazgo lleva el nombre de la pieza", () => {
    const hallazgos = validarPieza(pieza({ nombre: "Faldón", ancho: 60.0 }), PERFIL);
    expect(hallazgos[0].pieza).toBe("Faldón");
    expect(hallazgos[0].mensaje).toContain("65");
  });

  it.each([
    [65.0, 0],
    [70.0, 0],
    [64.9, 1],
  ])("umbral mínimo de corte (ancho=%f → %d errores)", (ancho, esperado) => {
    expect(errores(validarPieza(pieza({ ancho }), PERFIL)).length).toBe(esperado);
  });
});
