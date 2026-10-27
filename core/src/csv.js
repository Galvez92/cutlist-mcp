/**
 * Exportación CSV (lista de corte y posiciones).
 *
 * Formato según RFC 4180: fin de línea CRLF, comillas dobles para campos que
 * contienen coma, comilla o salto de línea, comilla escapada como "".
 * Fuente: https://www.rfc-editor.org/rfc/rfc4180 (verificado 2026-10-27).
 * Decimales con punto y sin separador de miles (el RFC no define locale).
 */

export const CSV_EOL = '\r\n';
export const CSV_MIME = 'text/csv;charset=utf-8';
export const CUTLIST_BASENAME = 'cutlist-lista-de-corte';
export const PLACEMENTS_BASENAME = 'cutlist-posiciones';

const round = (value) => Math.round(value * 100) / 100;

export function csvEscape(value) {
  const text = value == null ? '' : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(rows) {
  return rows.map((row) => row.map(csvEscape).join(',')).join(CSV_EOL) + CSV_EOL;
}

export const CUTLIST_HEADER = [
  'etiqueta',
  'cantidad',
  'ancho_mm',
  'alto_mm',
  'veta',
  'material',
  'canto_mm_total',
  'mecanizada',
  'tableros',
  'area_m2',
];

export function cutListRows(layout) {
  return (layout?.cutList ?? []).map((entry) => [
    entry.label,
    entry.qty,
    round(entry.width),
    round(entry.height),
    entry.grain,
    entry.material ?? '',
    round(entry.edgeLengthMm),
    entry.machined ? 'sí' : 'no',
    entry.sheets.join(' '),
    entry.areaM2,
  ]);
}

export function cutListCsv(layout) {
  return toCsv([CUTLIST_HEADER, ...cutListRows(layout)]);
}

export const PLACEMENTS_HEADER = [
  'tablero',
  'pieza',
  'etiqueta',
  'x_mm',
  'y_mm',
  'ancho_mm',
  'alto_mm',
  'girada',
  'veta',
];

export function placementsRows(layout) {
  const rows = [];
  for (const sheet of layout?.sheets ?? []) {
    for (const placement of sheet.placements) {
      rows.push([
        sheet.index,
        placement.pieceId,
        placement.label,
        round(placement.x),
        round(placement.y),
        round(placement.width),
        round(placement.height),
        placement.rotated ? 'sí' : 'no',
        placement.grain,
      ]);
    }
  }
  return rows;
}

export function placementsCsv(layout) {
  return toCsv([PLACEMENTS_HEADER, ...placementsRows(layout)]);
}
