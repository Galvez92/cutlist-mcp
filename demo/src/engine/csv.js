/**
 * Exportación CSV (lista de corte y posiciones).
 *
 * El motor no incluye CSV: esta es una capa del demo que usa el LayoutResult
 * del motor (cutList y sheets.placements).
 *
 * Formato según RFC 4180: fin de línea CRLF, comillas dobles para campos que
 * contienen coma, comilla o salto de línea, comilla escapada como "".
 * Fuente: https://www.rfc-editor.org/rfc/rfc4180 (verificado 2026-10-27).
 */

import { CSV_MIME, CUTLIST_BASENAME, PLACEMENTS_BASENAME } from './constants.js';

export { CSV_MIME, CUTLIST_BASENAME, PLACEMENTS_BASENAME };

const CSV_EOL = '\r\n';
const round = (value) => Math.round(value * 100) / 100;

function csvEscape(value) {
  const text = value == null ? '' : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function toCsv(rows) {
  return rows.map((row) => row.map(csvEscape).join(',')).join(CSV_EOL) + CSV_EOL;
}

const CUTLIST_HEADER = [
  'codigo',
  'etiqueta',
  'cantidad',
  'colocadas',
  'corte_ancho_mm',
  'corte_alto_mm',
  'terminada_ancho_mm',
  'terminada_alto_mm',
  'veta',
  'cantos',
  'material',
  'espesor_mm',
  'hojas',
];

export function cutListCsv(layout) {
  if (!layout?.cutList) return toCsv([CUTLIST_HEADER]);
  const rows = layout.cutList.map((entry) => [
    entry.code,
    entry.label,
    entry.quantity,
    entry.placed,
    round(entry.cutWidth),
    round(entry.cutHeight),
    round(entry.finishedWidth),
    round(entry.finishedHeight),
    entry.grain,
    entry.edgeSummary || '',
    entry.material ?? '',
    entry.thickness ?? '',
    entry.sheets.join(' '),
  ]);
  return toCsv([CUTLIST_HEADER, ...rows]);
}

const PLACEMENTS_HEADER = [
  'hoja',
  'codigo',
  'etiqueta',
  'x_mm',
  'y_mm',
  'ancho_mm',
  'alto_mm',
  'girada',
  'veta',
  'material',
];

export function placementsCsv(layout) {
  if (!layout?.sheets) return toCsv([PLACEMENTS_HEADER]);
  const rows = [];
  for (const sheet of layout.sheets) {
    for (const p of sheet.placements) {
      rows.push([
        sheet.index,
        p.code,
        p.label,
        round(p.x),
        round(p.y),
        round(p.width),
        round(p.height),
        p.rotated ? 'sí' : 'no',
        p.grainInSheet,
        p.material ?? '',
      ]);
    }
  }
  return toCsv([PLACEMENTS_HEADER, ...rows]);
}
