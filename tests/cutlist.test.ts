import { describe, expect, it } from "vitest";

import { buildCutList, formatCutListText, optimize } from "../src/index.js";
import { layoutFor } from "./helpers/datasets.js";

describe("lista de corte", () => {
  it("agrega una fila por pieza distinta y suma todas las instancias", () => {
    const layout = layoutFor("auto");

    expect(layout.cutList).toHaveLength(5);
    expect(layout.cutList.reduce((sum, row) => sum + row.quantity, 0)).toBe(11);
    expect(layout.cutList.reduce((sum, row) => sum + row.placed, 0)).toBe(11);
    expect(layout.cutList.map((row) => row.code)).toEqual([
      "A1",
      "A2",
      "A3",
      "A4",
      "A5",
    ]);
  });

  it("incluye medidas de corte, medidas terminadas y cantos", () => {
    const layout = optimize({
      parts: [
        {
          code: "C1",
          width: 1173.5,
          height: 600,
          qty: 1,
          edges: { left: 0.4, right: 0.4 },
        },
      ],
      sheets: [
        { id: "T", width: 2500, height: 1830, thickness: 18, kerf: 3 },
      ],
    });

    const row = layout.cutList[0];
    expect(row).toMatchObject({
      code: "C1",
      cutWidth: 1173.5,
      cutHeight: 600,
      edgeSummary: "derecha 0.4 mm · izquierda 0.4 mm",
    });
    expect(row?.finishedWidth).toBeCloseTo(1172.7, 6);
    expect(row?.finishedHeight).toBe(600);
    expect(row?.sheets).toEqual([1]);
  });

  it("indica las hojas donde sale cada pieza y las que quedaron sin colocar", () => {
    const layout = optimize({
      parts: [
        { code: "OK", width: 600, height: 400, qty: 2 },
        { code: "GIGANTE", width: 3000, height: 400 },
      ],
      sheets: [{ id: "T", width: 2500, height: 1830, thickness: 18, kerf: 3 }],
      algorithm: "guillotine",
    });

    const ok = layout.cutList.find((row) => row.code === "OK");
    const gigante = layout.cutList.find((row) => row.code === "GIGANTE");
    expect(ok?.sheets).toEqual([1]);
    expect(gigante?.placed).toBe(0);
    expect(gigante?.sheets).toEqual([]);
    expect(formatCutListText(layout.cutList)).toContain("GIGANTE ×0/1");
  });

  it("buildCutList no depende del layout para las piezas no colocadas", () => {
    const layout = layoutFor("guillotine");
    const rows = buildCutList(
      layout.cutList.map((row) => ({
        id: row.partId,
        code: row.code,
        label: row.label,
        width: row.cutWidth,
        height: row.cutHeight,
        qty: row.quantity,
        grain: row.grain,
        edges: row.edges,
      })),
      layout.sheets,
    );

    expect(rows.reduce((sum, row) => sum + row.placed, 0)).toBe(11);
  });
});
