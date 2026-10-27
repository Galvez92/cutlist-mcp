/**
 * Ejemplo real de la demo: el fixture saneado de Cortecloud del repo
 * (tests/fixtures/cortecloud/escritorio_D_simple.json).
 *
 * POR REVISAR: la lectura del formato es provisional, ver
 * core/src/importers/cortecloud.js y docs/por-revisar.md.
 */

import fixture from '../../tests/fixtures/cortecloud/escritorio_D_simple.json';
import { importCortecloud } from '@core/index.js';

export const CORTECLOUD_FIXTURE = fixture;

export function loadCortecloudExample(json = fixture, options = {}) {
  const { parts, sheets, notes, skipped } = importCortecloud(json, options);
  const [first, ...others] = sheets;
  const total = parts.reduce((sum, part) => sum + part.qty, 0);

  const notice = [
    `Fixture real de Cortecloud: ${parts.length} grupos / ${total} piezas${skipped.length ? ` (${skipped.length} omitidas)` : ''}.`,
    others.length > 0
      ? `El fixture usa ${sheets.length} materiales (${[first, ...others].map((sheet) => sheet.name).join(' · ')}): la demo optimiza un solo tablero.`
      : '',
    'Importación Cortecloud por revisar (ver demo/README.md y docs/por-revisar.md).',
  ]
    .filter(Boolean)
    .join(' ');

  return {
    parts,
    sheet: {
      name: first?.name ?? 'Tablero',
      width: first?.width ?? '',
      height: first?.height ?? '',
      thickness: first?.thickness ?? '',
      stock: '',
    },
    notes,
    skipped,
    notice,
  };
}
