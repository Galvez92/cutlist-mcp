/** Pruebas del intérprete de ideas escritas (src/modules/spec). */

import { describe, expect, it } from "vitest";

import { construir, construirDesdeTexto, parsear } from "../src/modules/spec.js";

describe("spec · parsear", () => {
  it("separa tipo y valores", () => {
    const { tipo, valores } = parsear("cajonera ancho=450 alto=800 fondo=500 cajones=3");
    expect(tipo).toBe("cajonera");
    expect(valores).toEqual({ ancho: "450", alto: "800", fondo: "500", cajones: "3" });
  });

  it("alias de módulos", () => {
    expect(parsear("clóset ancho=1000").tipo).toBe("closet");
    expect(parsear("placard ancho=1000").tipo).toBe("closet");
    expect(parsear("biblioteca ancho=800").tipo).toBe("librero");
    expect(parsear("bajo mesada ancho=600").tipo).toBe("cocina");
  });
});

describe("spec · construir", () => {
  it("cajonera desde texto", () => {
    const modulo = construirDesdeTexto("cajonera ancho=450 alto=800 fondo=500 cajones=3");
    expect(modulo.tipo).toBe("cajonera");
    expect(modulo.medidas["ancho"]).toBe(450.0);
    expect(modulo.medidas["cajones"]).toBe(3);
    const frentes = modulo.resumen().filter((l) => l.nombre === "Frente de cajón");
    expect(frentes.length).toBe(1);
    expect(frentes[0].cantidad).toBe(3);
  });

  it("conversión de tipos", () => {
    const modulo = construirDesdeTexto("librero ancho=800 repisas=2 repisas_moviles=si");
    expect(modulo.accesorios.length).toBe(2);

    const conLista = construirDesdeTexto("librero repisas=0 posiciones_repisas=[400, 800]");
    expect(conLista.medidas["repisas"]).toBe(2);
  });

  it("cadena entrecomillada con espacios", () => {
    const modulo = construirDesdeTexto('closet nombre="Clóset pieza 2" tipo_puerta=sin');
    expect(modulo.nombre).toBe("Clóset pieza 2");
  });

  it("altura opcional del barral", () => {
    const conBarral = construirDesdeTexto("closet barral_altura=1750");
    expect(conBarral.accesorios.some((a) => a.nombre === "Barral redondo")).toBe(true);

    const sinBarral = construir("closet", { barral_altura: null });
    expect(sinBarral.accesorios.some((a) => a.nombre === "Barral redondo")).toBe(false);
  });

  it.each([
    ["", "no se escribió"],
    ["sillon ancho=500", "módulo desconocido"],
    ["cajonera ancho", "parámetro sin valor"],
    ["cajonera =450", "parámetro sin nombre"],
    ["cajonera ancho=450 ancho=500", "parámetro repetido"],
    ["cajonera inventado=1", "desconocido"],
  ])("errores claros (%s)", (texto, mensaje) => {
    expect(() => construirDesdeTexto(texto)).toThrow(new RegExp(mensaje));
  });

  it("valor inválido falla con el parámetro", () => {
    expect(() => construirDesdeTexto("cajonera cajones=muchos")).toThrow();
  });
});
