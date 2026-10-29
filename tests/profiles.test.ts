import { describe, expect, it } from "vitest";

import {
  CORTECLOUD_MADIJAL_PROFILE,
  normalizeParts,
  sheetsFromProfile,
  validateParts,
} from "../src/index.js";

describe("perfil de restricciones Cortecloud/Madijal", () => {
  it("declara su estado como «por revisar» con las fuentes consultadas", () => {
    expect(CORTECLOUD_MADIJAL_PROFILE.reviewStatus).toBe("por revisar");
    expect(CORTECLOUD_MADIJAL_PROFILE.sources.join(" ")).toContain(
      "docs/memoria/MEMORIA.md",
    );
    expect(CORTECLOUD_MADIJAL_PROFILE.sources.join(" ")).toContain(
      "tests/fixtures/cortecloud",
    );
  });

  it("acepta una pieza que cabe girada en la pieza máxima", () => {
    // 600 × 2400 mm supera el orden 2480 × 1810 solo sin girar: el costado de
    // un clóset o un librero de 2000 mm deben pasar sin aviso.
    const parts = normalizeParts([
      { code: "COSTADO", width: 600, height: 2400 },
      { code: "TRASERA", width: 800, height: 2000 },
    ]);

    const codes = validateParts(parts, CORTECLOUD_MADIJAL_PROFILE).map(
      (issue) => issue.code,
    );

    expect(codes).not.toContain("pieza-sobre-maximo");
  });

  it("marca la pieza que excede el máximo incluso girada", () => {
    const parts = normalizeParts([{ code: "ANCHA", width: 1900, height: 2400 }]);

    const codes = validateParts(parts, CORTECLOUD_MADIJAL_PROFILE).map(
      (issue) => issue.code,
    );

    expect(codes).toContain("pieza-sobre-maximo");
  });

  it("avisa que el perfil está por revisar", () => {
    const issues = validateParts(
      normalizeParts([{ code: "P", width: 600, height: 400 }]),
      CORTECLOUD_MADIJAL_PROFILE,
    );

    const revision = issues.find((issue) => issue.code === "perfil-por-revisar");
    expect(revision?.severity).toBe("por-revisar");
    expect(revision?.message).toContain("Cortecloud/Madijal");
  });

  it("marca las piezas fuera de las medidas permitidas", () => {
    const parts = normalizeParts([
      { code: "CHICA", width: 40, height: 400 },
      { code: "GRANDE", width: 3000, height: 400 },
      { code: "OK", width: 600, height: 400, thickness: 18 },
    ]);

    const issues = validateParts(parts, CORTECLOUD_MADIJAL_PROFILE);
    const codes = issues.map((issue) => issue.code);

    expect(codes).toContain("pieza-bajo-minimo");
    expect(codes).toContain("pieza-sobre-maximo");
    expect(
      issues.find((issue) => issue.code === "pieza-bajo-minimo")?.partId,
    ).toBe("P01");
    expect(codes).not.toContain("espesor-sin-stock");
  });

  it("avisa si no hay tablero del espesor pedido", () => {
    const parts = normalizeParts([
      { code: "P25", width: 600, height: 400, thickness: 25 },
    ]);

    const issues = validateParts(parts, CORTECLOUD_MADIJAL_PROFILE);

    expect(issues.map((issue) => issue.code)).toContain("espesor-sin-stock");
    expect(
      issues.find((issue) => issue.code === "espesor-sin-stock")?.severity,
    ).toBe("aviso");
  });

  it("construye el stock del perfil pidiendo el kerf explícitamente", () => {
    const sheets = sheetsFromProfile(CORTECLOUD_MADIJAL_PROFILE, {
      kerf: 3,
      qty: 2,
    });

    expect(sheets).toHaveLength(1);
    expect(sheets[0]).toMatchObject({
      width: 2500,
      height: 1830,
      thickness: 18,
      kerf: 3,
      qty: 2,
    });
  });
});
