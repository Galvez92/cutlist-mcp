import { describe, expect, it } from "vitest";

import {
  edgeSummary,
  finishedDimensions,
  formatMm,
  formatPct,
  grainInSheet,
  hasBanding,
  isCompatibleGrain,
  isRotatable,
  sheetSideOfPartEdge,
} from "../src/index.js";

describe("geometría y veta", () => {
  it("mapea los lados de la pieza al girarla 90° en sentido horario", () => {
    expect(sheetSideOfPartEdge("top", false)).toBe("top");
    expect(sheetSideOfPartEdge("left", false)).toBe("left");
    expect(sheetSideOfPartEdge("top", true)).toBe("right");
    expect(sheetSideOfPartEdge("right", true)).toBe("bottom");
    expect(sheetSideOfPartEdge("bottom", true)).toBe("left");
    expect(sheetSideOfPartEdge("left", true)).toBe("top");
  });

  it("solo gira cuando la veta lo permite", () => {
    expect(isRotatable("none", "none", true)).toBe(true);
    expect(isRotatable("none", "horizontal", true)).toBe(true);
    expect(isRotatable("horizontal", "none", true)).toBe(true);
    expect(isRotatable("horizontal", "horizontal", true)).toBe(false);
    expect(isRotatable("horizontal", "vertical", true)).toBe(false);
    expect(isRotatable("none", "none", false)).toBe(false);
  });

  it("comprueba compatibilidad de veta pieza/tablero", () => {
    expect(isCompatibleGrain("horizontal", "vertical")).toBe(false);
    expect(isCompatibleGrain("horizontal", "horizontal")).toBe(true);
    expect(isCompatibleGrain("horizontal", "none")).toBe(true);
    expect(isCompatibleGrain("none", "vertical")).toBe(true);
  });

  it("calcula la dirección real de la veta dentro de la hoja", () => {
    expect(grainInSheet("none", false)).toBe("none");
    expect(grainInSheet("horizontal", false)).toBe("horizontal");
    expect(grainInSheet("horizontal", true)).toBe("vertical");
    expect(grainInSheet("vertical", true)).toBe("horizontal");
  });

  it("descuenta el canto para dar la medida terminada", () => {
    const finished = finishedDimensions({
      width: 732,
      height: 600,
      edges: { top: 0, right: 0.4, bottom: 0, left: 0.4 },
    });
    expect(finished.width).toBeCloseTo(731.2, 6);
    expect(finished.height).toBe(600);
  });

  it("resume los cantos en español, en orden arriba/derecha/abajo/izquierda", () => {
    expect(edgeSummary({ top: 0, right: 0, bottom: 0, left: 0 })).toBe("");
    expect(
      edgeSummary({ top: 0.4, right: 0, bottom: 0, left: 0.4 }),
    ).toBe("arriba 0.4 mm · izquierda 0.4 mm");
    expect(hasBanding({ top: 0, right: 0, bottom: 1, left: 0 })).toBe(true);
  });

  it("formatea medidas y porcentajes", () => {
    expect(formatMm(1173.5)).toBe("1173.5");
    expect(formatMm(600)).toBe("600");
    expect(formatPct(78.44)).toBe("78.4 %");
  });
});
