/**
 * cutlist-mcp · motor de optimización de corte de tableros + módulos paramétricos.
 *
 * API pública: tipos, `optimize`, lista de corte, etiquetas, perfiles de
 * restricciones y salidas SVG/PDF (motor de `optimizer-engine`, PR #4), más la
 * capa de módulos paramétricos (cajonera, clóset, cocina, librero) y su puente
 * al motor.
 *
 * La pieza paramétrica se bridgea al motor con `Pieza.toPartInput()`/
 * `Pieza.toPart()` y el perfil con `PerfilRestricciones.toConstraintProfile()`.
 */

// ── Motor de optimización (optimizer-engine) ────────────────────────────────
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

// ── Módulos paramétricos (parametric-modules) ───────────────────────────────
export {
  CANTO_ESPESOR_DEFAULT,
  ESPESOR_DEFAULT,
  LADOS,
  ValueError,
  vetaAGrain,
  Cantos,
  Mecanizado,
  Pieza,
  resumen,
  tabla,
  totales,
} from "./modules/parts.js";
export type { Lado, Veta, Ranura, Barreno, PiezaInit, Totales } from "./modules/parts.js";

export {
  PERFIL_CORTECLOUD_MADIJAL,
  PERFILES,
  PerfilRestricciones,
  Hallazgo,
  NIVEL_ERROR,
  NIVEL_AVISO,
  validar,
  validarPieza,
  errores,
  avisos,
  resumenHallazgos,
} from "./modules/profiles.js";
export type { PerfilInit, ResumenHallazgos } from "./modules/profiles.js";

export { Accesorio, Modulo } from "./modules/modulo.js";

export {
  MODULOS,
  ALIAS,
  CAJONERA,
  CLOSET,
  COCINA,
  LIBRERO,
  ModuloRegistrado,
  construirParams,
  generarModulo,
  obtener,
} from "./modules/index.js";
export type { CampoParam, CampoUi, TipoCampo } from "./modules/index.js";

export { generar as generarCajonera } from "./modules/cajonera.js";
export type { ParamsCajonera } from "./modules/cajonera.js";
export { generar as generarCloset } from "./modules/closet.js";
export type { ParamsCloset } from "./modules/closet.js";
export { generar as generarCocina } from "./modules/cocina.js";
export type { ParamsCocina } from "./modules/cocina.js";
export { generar as generarLibrero } from "./modules/librero.js";
export type { ParamsLibrero } from "./modules/librero.js";

export { parsear, construir, construirDesdeTexto } from "./modules/spec.js";
