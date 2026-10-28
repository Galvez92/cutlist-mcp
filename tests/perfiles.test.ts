import { describe, it, expect, beforeAll } from "vitest";
import { CORTECLOUD_MADIJAL, validarConPerfil, perfil } from "../src/profiles.js";
import * as cortecloud from "../src/formats/cortecloud.js";
import { CutList, Piece } from "../src/formats/model.js";
import { fixture } from "./helpers/fixtures.js";

describe("Perfil CORTECLOUD_MADIJAL", () => {
  it("declara los valores del enunciado", () => {
    expect(CORTECLOUD_MADIJAL.id).toBe("CORTECLOUD_MADIJAL");
    expect(CORTECLOUD_MADIJAL.maxPartWidth).toBe(2480);
    expect(CORTECLOUD_MADIJAL.maxPartHeight).toBe(1810);
    expect(CORTECLOUD_MADIJAL.minCutWidth).toBe(65);
    expect(CORTECLOUD_MADIJAL.minCutHeight).toBe(65);
    expect(CORTECLOUD_MADIJAL.minWithEdge).toBe(70);
  });

  it("está marcado por revisar (sin fuente pública)", () => {
    expect(CORTECLOUD_MADIJAL.reviewStatus).toBe("por revisar");
    expect(CORTECLOUD_MADIJAL.sources.length).toBeGreaterThan(0);
    expect(CORTECLOUD_MADIJAL.notes).toContain("0.4");
    expect(CORTECLOUD_MADIJAL.notes).toContain("22");
    expect(CORTECLOUD_MADIJAL.notes).toContain("70");
  });

  it("se resuelve por id", () => {
    expect(perfil("CORTECLOUD_MADIJAL")).toBe(CORTECLOUD_MADIJAL);
    expect(() => perfil("INEXISTENTE")).toThrow();
  });
});

describe("validarConPerfil — importación Cortecloud", () => {
  let texto: string;

  beforeAll(() => {
    texto = fixture("cortecloud/escritorio_D_simple.json");
  });

  it("el fixture real no genera errores de restricciones", () => {
    const lista = cortecloud.importar(texto);
    const issues = validarConPerfil(lista, CORTECLOUD_MADIJAL);
    const errores = issues.filter((i) => i.severity === "error");
    expect(errores).toEqual([]);
  });

  it("detecta piezas con canto menores a 70 mm como aviso", () => {
    // Pieza > 65 (mín. corte) pero < 70 (mín. con canto), con canto.
    const lc = new CutList({
      piezas: [
        new Piece({ nombre: "chica con canto", largo: 67, ancho: 300, cantos: { c1: "PVC 0.4 x 22" } }),
      ],
    });
    const issues = validarConPerfil(lc, CORTECLOUD_MADIJAL);
    const aviso = issues.find(
      (i) => i.code === "min-con-canto" && i.severity === "aviso",
    );
    expect(aviso).toBeDefined();
    expect(aviso!.message).toContain("67");
  });

  it("el canto del fixture confirma 0.4 x 22 mm", () => {
    const lista = cortecloud.importar(texto);
    const conCanto = lista.piezas.find((p) => p.cantos.c1);
    expect(conCanto).toBeDefined();
    expect(conCanto!.cantos.c1).toContain("0.4 x 22");
  });
});

describe("validarConPerfil — casos sintéticos", () => {
  function lista(...piezas: Piece[]): CutList {
    return new CutList({ piezas });
  }

  it("rechaza pieza menor al mínimo de corte", () => {
    const lc = lista(
      new Piece({ nombre: "chica", largo: 60, ancho: 300 }),
    );
    const issues = validarConPerfil(lc, CORTECLOUD_MADIJAL);
    expect(issues.some((i) => i.code === "min-corte" && i.severity === "error")).toBe(true);
  });

  it("rechaza pieza que excede el máximo de hoja", () => {
    const lc = lista(
      new Piece({ nombre: "enorme", largo: 2500, ancho: 500 }),
    );
    const issues = validarConPerfil(lc, CORTECLOUD_MADIJAL);
    expect(issues.some((i) => i.code === "max-pieza" && i.severity === "error")).toBe(true);
  });

  it("avisa si pieza mecanizada es muy corta", () => {
    const lc = lista(
      new Piece({
        nombre: "mecanizada corta",
        largo: 200,
        ancho: 200,
        extra: { machining: { verticalDrills: [] } },
      }),
    );
    const issues = validarConPerfil(lc, CORTECLOUD_MADIJAL);
    expect(
      issues.some((i) => i.code === "min-mecanizado" && i.severity === "aviso"),
    ).toBe(true);
  });

  it("no genera issues para piezas válidas", () => {
    const lc = lista(
      new Piece({ nombre: "ok", largo: 500, ancho: 400, cantos: { c1: "PVC 0.4 x 22" } }),
    );
    const issues = validarConPerfil(lc, CORTECLOUD_MADIJAL);
    expect(issues).toEqual([]);
  });
});

describe("Perfil + export/import ida y vuelta", () => {
  it("exporta y reimporta una lista validada sin perder piezas", () => {
    const texto = fixture("cortecloud/escritorio_D_simple.json");
    const lista = cortecloud.importar(texto);
    const issues = validarConPerfil(lista, CORTECLOUD_MADIJAL);
    // Sin errores → se puede exportar.
    expect(issues.filter((i) => i.severity === "error")).toEqual([]);

    const salida = cortecloud.exportar(lista);
    const reimportada = cortecloud.importar(salida);
    expect(reimportada.piezas.length).toBe(lista.piezas.length);
    expect(reimportada.totalPiezas).toBe(lista.totalPiezas);
  });

  it("el ida y vuelta del fixture sigue siendo fiel tras validar", () => {
    const texto = fixture("cortecloud/escritorio_D_simple.json");
    const bruto = JSON.parse(texto);
    const lista = cortecloud.importar(texto);
    validarConPerfil(lista, CORTECLOUD_MADIJAL);
    expect(JSON.parse(cortecloud.exportar(lista))).toStrictEqual(bruto);
  });
});
