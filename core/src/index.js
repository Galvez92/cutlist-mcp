/**
 * cutlist-core — motor mínimo de optimización de corte de tableros.
 *
 * Este entry point no tiene dependencias externas. La salida PDF vive en
 * `core/src/pdf.js` y se importa aparte porque usa `pdf-lib`.
 */

export { GRAIN, MODES, InputError, normalizeInput, normalizePart, normalizeSheet, normalizeGrain, normalizeEdges, expandPieces, checkProfile } from './pieces.js';
export { PROFILES, DEFAULT_KERF, getProfile } from './profile.js';
export { PACKERS, packGuillotine, packMaxRects } from './packer.js';
export { optimize } from './optimize.js';
export { escapeXml, renderLayoutSvg, renderSheetGroup } from './svg.js';
export {
  CSV_EOL,
  CSV_MIME,
  CUTLIST_BASENAME,
  CUTLIST_HEADER,
  PLACEMENTS_BASENAME,
  PLACEMENTS_HEADER,
  csvEscape,
  toCsv,
  cutListRows,
  cutListCsv,
  placementsRows,
  placementsCsv,
} from './csv.js';
export { CORTECLOUD_FIELDS, CORTECLOUD_SOURCE, importCortecloud, parseEdgeBand, parseMaterial } from './importers/cortecloud.js';
