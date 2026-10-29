/** Lista de corte: una fila por pieza distinta, con las hojas donde sale. */

import { edgeSummary, finishedDimensions, formatMm } from "./geometry.js";
import type { CutListRow, Part, SheetLayout } from "./types.js";

export function buildCutList(parts: Part[], sheets: SheetLayout[]): CutListRow[] {
  const placed = new Map<string, { count: number; sheetNumbers: Set<number> }>();

  for (const sheet of sheets) {
    for (const placement of sheet.placements) {
      const entry =
        placed.get(placement.partId) ?? { count: 0, sheetNumbers: new Set<number>() };
      entry.count += 1;
      entry.sheetNumbers.add(sheet.index);
      placed.set(placement.partId, entry);
    }
  }

  return parts.map((part) => {
    const entry = placed.get(part.id);
    const finished = finishedDimensions(part);
    return {
      partId: part.id,
      code: part.code,
      label: part.label,
      quantity: part.qty,
      placed: entry?.count ?? 0,
      cutWidth: part.width,
      cutHeight: part.height,
      finishedWidth: finished.width,
      finishedHeight: finished.height,
      grain: part.grain,
      edges: part.edges,
      edgeSummary: edgeSummary(part.edges),
      material: part.material,
      thickness: part.thickness,
      sheets: entry ? [...entry.sheetNumbers].sort((a, b) => a - b) : [],
    };
  });
}

/** Vista de texto de la lista de corte (consola, depuración, pegada rápida). */
export function formatCutListText(rows: CutListRow[]): string {
  const lines = rows.map((row) => {
    const material = row.material ? ` · ${row.material}` : "";
    const edges = row.edgeSummary ? ` · cantos: ${row.edgeSummary}` : "";
    const sheets = row.sheets.length ? ` · hojas ${row.sheets.join(", ")}` : " · sin colocar";
    return `${row.code} ×${row.placed}/${row.quantity} · ${formatMm(row.cutWidth)} × ${formatMm(row.cutHeight)} mm${material}${edges}${sheets}`;
  });
  return lines.join("\n");
}
