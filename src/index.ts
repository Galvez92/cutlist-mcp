/**
 * cutlist-mcp · módulos paramétricos (TypeScript).
 *
 * API pública: tipos del motor de optimización (`src/types.ts`), utilidades
 * geométricas, piezas/cantos/veta, perfiles de restricciones, generadores de
 * módulos (cajonera, clóset, cocina, librero) e intérprete de ideas escritas.
 *
 * La pieza paramétrica se bridgea al motor con `Pieza.toPartInput()`/
 * `Pieza.toPart()` y el perfil con `PerfilRestricciones.toConstraintProfile()`.
 */

export * from "./types.js";
export { OptimizeError } from "./errors.js";
export { EPS, formatMm, formatPct, edgeSummary, emptyEdges, finishedDimensions } from "./geometry.js";

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
