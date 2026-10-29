/** Pruebas del modelo de piezas, cantos y totales. */

import { describe, expect, it } from "vitest";

import {
  Cantos,
  Mecanizado,
  Pieza,
  barreno,
  ranura,
  resumen,
  tabla,
  totales,
} from "../src/modules/parts.js";
import type { Lado, PiezaInit, Veta } from "../src/modules/parts.js";
import { aprox } from "./helpers/aprox.js";

function pieza(cambios: Partial<PiezaInit> = {}): Pieza {
  return new Pieza({ nombre: "Costado", largo: 500.0, ancho: 100.0, ...cambios });
}

describe("Cantos", () => {
  it("por_arista y cantidad", () => {
    const cantos = new Cantos("PVC 0.4 mm", undefined, undefined, "PVC 0.4 mm");
    expect(cantos.cantidad()).toBe(2);
    expect(cantos.aristas()).toEqual(["largo_a", "ancho_b"]);
    expect(cantos.porArista()).toEqual({ largo_a: "PVC 0.4 mm", ancho_b: "PVC 0.4 mm" });
    expect(cantos.vacio()).toBe(false);
  });

  it("todas las aristas", () => {
    const cantos = new Cantos().todas("PVC 0.4 mm");
    expect(cantos.cantidad()).toBe(4);
    expect(new Set(Object.keys(cantos.porArista()))).toEqual(
      new Set(["largo_a", "largo_b", "ancho_a", "ancho_b"]),
    );
  });

  it("rechaza arista desconocida", () => {
    expect(() =>
      new Cantos().con({ frente: "PVC" } as unknown as Partial<Record<Lado, string | null>>),
    ).toThrow(/aristas desconocidas/);
  });
});

describe("Pieza.medidasTerminadas", () => {
  it("suma el canto de las aristas de largo", () => {
    const conCanto = pieza({ cantos: new Cantos("PVC", "PVC") });
    const { largo, ancho } = conCanto.medidasTerminadas();
    aprox(largo, 500.0);
    aprox(ancho, 100.8);
  });

  it("suma el canto de las aristas de ancho", () => {
    const conCanto = pieza({ cantos: new Cantos(undefined, undefined, "PVC") });
    const { largo, ancho } = conCanto.medidasTerminadas();
    aprox(largo, 500.4);
    aprox(ancho, 100.0);
  });

  it("sin canto no cambia", () => {
    const { largo, ancho } = pieza().medidasTerminadas();
    expect({ largo, ancho }).toEqual({ largo: 500.0, ancho: 100.0 });
  });
});

describe("Pieza validación", () => {
  it("veta inválida falla", () => {
    expect(() => pieza({ veta: "diagonal" as Veta })).toThrow(/veta inválida/);
  });

  it("cantidad negativa falla", () => {
    expect(() => pieza({ cantidad: -1 })).toThrow(/cantidad/);
  });
});

describe("Pieza area y to_dict", () => {
  it("calcula el área y serializa", () => {
    const completo = pieza({
      rol: "costado",
      cantos: new Cantos("PVC 0.4 mm"),
      mecanizado: new Mecanizado([ranura({ ancho: 9.7 })], [barreno({ diametro: 5.0 })]),
      funcion: "Costado — canto frontal",
      modulo: "Cajonera 450x800x500",
    });
    aprox(completo.areaMm2, 50_000.0);
    const datos = completo.toDict();
    expect(datos["cantos"]).toEqual({ largo_a: "PVC 0.4 mm" });
    aprox(datos["ancho_terminado"] as number, 100.4);
    expect((datos["mecanizado"] as { barrenos: { diametro: number }[] }).barrenos[0].diametro).toBe(5.0);
    expect((datos["mecanizado"] as { ranuras: { ancho: number }[] }).ranuras[0].ancho).toBe(9.7);
    expect(datos["rol"]).toBe("costado");
  });

  it("mecanizado vacío", () => {
    expect(new Mecanizado().vacio()).toBe(true);
    expect(new Mecanizado([], [barreno({ diametro: 5.0 })]).vacio()).toBe(false);
  });
});

describe("resumen", () => {
  it("agrupa líneas idénticas", () => {
    const lineas = resumen([
      pieza({ nombre: "Lateral cajón", cantos: new Cantos("PVC") }),
      pieza({ nombre: "Lateral cajón", cantos: new Cantos("PVC") }),
      pieza({ nombre: "Piso cajón" }),
    ]);
    expect(lineas.map((l) => [l.nombre, l.cantidad])).toEqual([
      ["Lateral cajón", 2],
      ["Piso cajón", 1],
    ]);
  });

  it("no mezcla piezas con distinto canto", () => {
    const lineas = resumen([
      pieza({ nombre: "Costado", cantos: new Cantos("PVC") }),
      pieza({ nombre: "Costado" }),
    ]);
    expect(lineas.length).toBe(2);
  });
});

describe("totales y tabla", () => {
  it("suma unidades, líneas y área", () => {
    const lineas = resumen([
      pieza({ cantidad: 2 }),
      pieza({ nombre: "Repisa", largo: 300.0, ancho: 100.0 }),
    ]);
    const datos = totales(lineas);
    expect(datos.lineas).toBe(2);
    expect(datos.unidades).toBe(3);
    aprox(datos.area_m2, (500.0 * 100.0 * 2 + 300.0 * 100.0) / 1_000_000);

    const texto = tabla(lineas);
    expect(texto).toContain("Costado");
    expect(texto).toContain("Repisa");
    expect(texto).toContain("3 piezas en 2 líneas");
  });
});
