/** Mapeo de cantos: aristas de la pieza ↔ lados c1/c2/l1/l2 de Cortecloud. */

import { describe, expect, it } from "vitest";

import {
  ARISTA_DE_CORTECLOUD,
  CORTECLOUD_FUENTES,
  LADOS_CORTECLOUD,
  SEGMENTOS_CORTECLOUD,
  cantosACortecloud,
  cantosDesdeCortecloud,
  ladoACortecloud,
} from "../src/modules/cortecloud.js";
import { Cantos, Pieza } from "../src/modules/parts.js";
import { fixture } from "./helpers/fixtures.js";

interface ParteFixture {
  c: number;
  l: number;
  function: string;
  c1: string | null;
  c2: string | null;
  l1: string | null;
  l2: string | null;
}

const partes = (): ParteFixture[] =>
  (JSON.parse(fixture("cortecloud/escritorio_D_simple.json")) as { parts: ParteFixture[] }).parts;

const porFuncion = (nombre: string): ParteFixture => {
  const parte = partes().find((p) => p.function.startsWith(nombre));
  if (!parte) throw new Error(`el fixture no trae «${nombre}»`);
  return parte;
};

describe("convención documentada de Cortecloud", () => {
  it("usa los segmentos 0-1, 1-2, 2-3 y 3-0", () => {
    expect(SEGMENTOS_CORTECLOUD).toEqual({ c1: "0-1", l1: "1-2", c2: "2-3", l2: "3-0" });
    expect(LADOS_CORTECLOUD).toEqual(["c1", "l1", "c2", "l2"]);
  });

  it("C1/C2 son los lados del largo y L1/L2 los del ancho", () => {
    expect(ARISTA_DE_CORTECLOUD).toEqual({
      c1: "largo_a",
      c2: "largo_b",
      l1: "ancho_b",
      l2: "ancho_a",
    });
    expect(ladoACortecloud("largo_a")).toBe("c1");
    expect(ladoACortecloud("largo_b")).toBe("c2");
    expect(ladoACortecloud("ancho_b")).toBe("l1");
    expect(ladoACortecloud("ancho_a")).toBe("l2");
  });

  it("declara la fuente oficial", () => {
    expect(CORTECLOUD_FUENTES.importacion.startsWith("https://cortecloud.com/")).toBe(true);
    expect(CORTECLOUD_FUENTES.coordenadas.includes("sistema-de-coordenadas")).toBe(true);
  });
});

describe("cantosDesdeCortecloud", () => {
  it("lleva c1/c2 a las aristas del largo y l1/l2 a las del ancho", () => {
    const cantos = cantosDesdeCortecloud({
      c1: "PVC 0.4 izquierda",
      c2: "PVC 0.4 derecha",
      l1: "PVC 0.4 inferior",
      l2: "PVC 0.4 superior",
    });
    expect(cantos.porArista()).toEqual({
      largo_a: "PVC 0.4 izquierda",
      largo_b: "PVC 0.4 derecha",
      ancho_b: "PVC 0.4 inferior",
      ancho_a: "PVC 0.4 superior",
    });
  });

  it("trata null y texto vacío como arista sin canto", () => {
    const cantos = cantosDesdeCortecloud({ c1: null, c2: "  ", l1: undefined, l2: "PVC" });
    expect(cantos.aristas()).toEqual(["ancho_a"]);
    expect(cantos.cantidad()).toBe(1);
  });

  it("lee las piezas del fixture real", () => {
    const lateralParte = porFuncion("Lateral cajón");
    const lateral = cantosDesdeCortecloud(lateralParte);
    expect(lateral.porArista()).toEqual({ ancho_b: lateralParte.l1 });

    const costado = cantosDesdeCortecloud(porFuncion("Costado interior"));
    expect(costado.aristas()).toEqual(["largo_a"]);

    const frente = cantosDesdeCortecloud(porFuncion("Frente cajón"));
    expect(frente.cantidad()).toBe(4);
  });
});

describe("cantosACortecloud", () => {
  it("devuelve los cuatro lados en el orden del documento", () => {
    const cantos = new Cantos("PVC", null, "PVC", null);
    expect(cantosACortecloud(cantos)).toEqual({ c1: "PVC", l1: null, c2: null, l2: "PVC" });
  });

  it("ida y vuelta fiel sobre las 21 líneas del fixture", () => {
    for (const parte of partes()) {
      const cantos = cantosDesdeCortecloud(parte);
      expect(cantosACortecloud(cantos)).toEqual({
        c1: parte.c1,
        c2: parte.c2,
        l1: parte.l1,
        l2: parte.l2,
      });
      expect(cantos.cantidad()).toBe(
        [parte.c1, parte.c2, parte.l1, parte.l2].filter(Boolean).length,
      );
    }
  });
});

describe("aristas del motor", () => {
  it("l1 cae en el lado inferior y l2 en el superior", () => {
    const costado = porFuncion("Costado interior");
    const pieza = (bruto: Record<string, unknown>) =>
      new Pieza({
        nombre: "Costado",
        largo: costado.c,
        ancho: costado.l,
        cantos: cantosDesdeCortecloud(bruto),
        cantoEspesor: 0.4,
      });

    const soloL1 = pieza({ l1: "PVC" }).edgesDelMotor();
    expect(soloL1.bottom).toBeCloseTo(0.4, 6);
    expect(soloL1.top).toBe(0);

    const soloL2 = pieza({ l2: "PVC" }).edgesDelMotor();
    expect(soloL2.top).toBeCloseTo(0.4, 6);
    expect(soloL2.bottom).toBe(0);
  });

  it("c1 y c2 caen en izquierda y derecha", () => {
    const pata = porFuncion("Pata costado exterior");
    const pieza = new Pieza({
      nombre: pata.function,
      largo: pata.c,
      ancho: pata.l,
      cantos: cantosDesdeCortecloud(pata),
      cantoEspesor: 0.4,
    });
    const edges = pieza.edgesDelMotor();
    expect(edges.left).toBeCloseTo(0.4, 6);
    expect(edges.bottom).toBeCloseTo(0.4, 6);
    expect(edges.right).toBe(0);
    expect(edges.top).toBe(0);
  });
});
