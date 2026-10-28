/**
 * Constantes del demo no incluidas en el motor (optimizer-engine).
 *
 * El motor no define MODES ni DEFAULT_KERF: el algoritmo se pasa como string
 * y el kerf va por tablero. El demo necesita valores por defecto para la UI.
 */

export const MODES = Object.freeze({
  GUILLOTINE: 'guillotine',
  MAXRECTS: 'maxrects',
  AUTO: 'auto',
});

/** Valor de partida editable; ajustar al disco de la máquina. */
export const DEFAULT_KERF = 4;

export const PDF_MIME = 'application/pdf';
export const PDF_BASENAME = 'cutlist-layout';
export const CSV_MIME = 'text/csv;charset=utf-8';
export const CUTLIST_BASENAME = 'cutlist-lista-de-corte';
export const PLACEMENTS_BASENAME = 'cutlist-posiciones';
