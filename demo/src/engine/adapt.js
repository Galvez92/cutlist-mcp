/**
 * Adaptación entre el estado del demo y el formato del motor (optimizer-engine).
 *
 * El demo guarda piezas con `edges` como número único (un campo en la UI) o
 * como objeto (desde el importador de Cortecloud). El motor espera
 * `PartInput` con `edges: Partial<EdgeBanding>`.
 */

import { PROFILES } from '@engine';

/** Piezas del demo → PartInput del motor. */
export function partsForEngine(parts) {
  return parts.map((p) => {
    const input = {
      id: p.id,
      code: p.id,
      label: p.label || '',
      width: Number(p.width),
      height: Number(p.height),
      qty: Number(p.qty) || 1,
      grain: p.grain ?? 'none',
    };
    if (typeof p.edges === 'number' && p.edges > 0) {
      input.edges = { top: p.edges, right: p.edges, bottom: p.edges, left: p.edges };
    } else if (p.edges && typeof p.edges === 'object') {
      input.edges = p.edges;
    }
    if (p.material) input.material = p.material;
    return input;
  });
}

/** Tablero del demo → SheetInput del motor. */
export function sheetForEngine(sheet) {
  return {
    label: sheet.name || 'Tablero',
    width: Number(sheet.width),
    height: Number(sheet.height),
    thickness: Number(sheet.thickness),
    kerf: Number(sheet.kerf) || 0,
    qty: sheet.stock ? Number(sheet.stock) : 999,
  };
}

/** Perfil del demo → ConstraintProfile del motor o undefined. */
export function profileForEngine(profileId) {
  if (!profileId || profileId === 'none') return undefined;
  return PROFILES[profileId];
}
