/**
 * cutlist-mcp · motor de optimización de corte de tableros.
 *
 * API pública: tipos, `optimize`, lista de corte, etiquetas, perfiles de
 * restricciones y salidas SVG/PDF.
 */

export * from "./types.js";
export { OptimizeError } from "./errors.js";
export {
  EDGE_SIDE_NAMES,
  EPS,
  edgeSummary,
  emptyEdges,
  finishedDimensions,
  formatMm,
  formatPct,
  grainInSheet,
  hasBanding,
  isCompatibleGrain,
  isRotatable,
  sheetSideOfPartEdge,
} from "./geometry.js";
export { optimize, compareAttempts } from "./optimize.js";
export { buildCutList, formatCutListText } from "./cutlist.js";
export { buildLabels, labelForPlacement } from "./labels.js";
export {
  CORTECLOUD_MADIJAL_PROFILE,
  PROFILES,
  sheetsFromProfile,
  validateParts,
} from "./profiles.js";
export { guillotineAlgorithm } from "./optimizer/guillotine.js";
export { maxRectsAlgorithm } from "./optimizer/maxrects.js";
export {
  insetRect,
  rectArea,
  rectContains,
  rectsIntersect,
} from "./optimizer/rect.js";
export type { Rect } from "./optimizer/rect.js";
export type {
  Fit,
  PackContext,
  PackItem,
  SheetAlgorithm,
} from "./optimizer/algorithm.js";
export { ORDERINGS, orderingByName, sortItems } from "./optimizer/order.js";
export type { Ordering } from "./optimizer/order.js";
export { buildJobs, packJob } from "./optimizer/pack.js";
export type { Job, JobItem, PackJobOptions } from "./optimizer/pack.js";
export { normalizeParts, normalizeSheets } from "./optimizer/normalize.js";
export { renderLayoutSvg, renderSheetSvg } from "./render/svg.js";
export type { SvgRenderOptions } from "./render/svg.js";
export { renderLayoutPdf } from "./render/pdf.js";
export type { PdfRenderOptions } from "./render/pdf.js";
