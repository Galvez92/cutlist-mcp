/** Etiquetas para las piezas cortadas (rotulado en el taller). */

import { edgeSummary, formatMm } from "./geometry.js";
import type { GrainDirection, LayoutResult, PartLabel, Placement, SheetLayout } from "./types.js";

const GRAIN_TEXT: Record<GrainDirection, string> = {
  none: "",
  horizontal: "Veta horizontal (→)",
  vertical: "Veta vertical (↓)",
};

export function labelForPlacement(
  placement: Placement,
  sheet: SheetLayout,
): PartLabel {
  const sizeText = `${formatMm(placement.width)} × ${formatMm(placement.height)} mm`;
  const edgeText = edgeSummary(placement.edges);
  const materialText = [
    placement.material,
    placement.thickness !== undefined ? `${formatMm(placement.thickness)} mm` : "",
  ]
    .filter((part) => part !== "")
    .join(" · ");
  const sheetText = `Hoja ${sheet.index}${placement.rotated ? " · girada 90°" : ""}`;

  const lines = [`${placement.code} · ${sizeText}`];
  if (placement.label) lines.push(placement.label);
  if (edgeText) lines.push(`Cantos: ${edgeText}`);
  const grain = GRAIN_TEXT[placement.grainInSheet];
  if (grain) lines.push(grain);
  lines.push(sheetText);

  return {
    partId: placement.partId,
    code: placement.code,
    title: placement.label || placement.code,
    sizeText,
    edgeText,
    materialText,
    sheetText,
    rotated: placement.rotated,
    lines,
  };
}

/** Etiquetas de todas las piezas colocadas, en orden de hoja. */
export function buildLabels(layout: LayoutResult): PartLabel[] {
  return layout.sheets.flatMap((sheet) =>
    sheet.placements.map((placement) => labelForPlacement(placement, sheet)),
  );
}
