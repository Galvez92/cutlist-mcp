/**
 * Entrada del motor: piezas + tableros → layout, estadísticas y lista de corte.
 */

import { checkProfile, expandPieces, normalizeInput } from './pieces.js';
import { PACKERS } from './packer.js';

const round = (value, digits = 2) => {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
};

export function optimize(input) {
  const { parts, sheets, kerf, mode, profile } = normalizeInput(input);
  const pieces = expandPieces(parts);
  const packed = PACKERS[mode](pieces, sheets, kerf);

  const layoutSheets = packed.sheets.map((sheet) => {
    const usedArea = sheet.placements.reduce((sum, p) => sum + p.area, 0);
    const sheetArea = sheet.width * sheet.height;
    return {
      index: sheet.index,
      name: sheet.name,
      width: sheet.width,
      height: sheet.height,
      thickness: sheet.thickness,
      kerf: sheet.kerf,
      placements: sheet.placements.map((p) => ({
        ...p,
        labelText: `${p.label} ${round(p.width)}×${round(p.height)}${p.rotated ? ' (girada)' : ''}`,
      })),
      stats: {
        pieces: sheet.placements.length,
        usedArea: round(usedArea),
        sheetArea: round(sheetArea),
        wasteArea: round(sheetArea - usedArea),
        yieldPct: sheetArea > 0 ? round((usedArea / sheetArea) * 100) : 0,
      },
    };
  });

  const usedArea = layoutSheets.reduce((sum, s) => sum + s.stats.usedArea, 0);
  const sheetArea = layoutSheets.reduce((sum, s) => sum + s.stats.sheetArea, 0);
  const stats = {
    sheetsUsed: layoutSheets.length,
    piecesRequested: pieces.length,
    piecesPlaced: pieces.length - packed.unplaced.length,
    piecesUnplaced: packed.unplaced.length,
    usedArea: round(usedArea),
    sheetArea: round(sheetArea),
    wasteArea: round(sheetArea - usedArea),
    yieldPct: sheetArea > 0 ? round((usedArea / sheetArea) * 100) : 0,
  };

  return {
    mode,
    kerf,
    profile: profile ?? null,
    parts,
    stock: sheets,
    sheets: layoutSheets,
    stats,
    cutList: buildCutList(layoutSheets, parts),
    unplaced: packed.unplaced.map(({ piece, reason }) => ({
      pieceId: piece.pieceId,
      partId: piece.id,
      label: piece.label,
      width: piece.width,
      height: piece.height,
      reason,
    })),
    warnings: checkProfile(parts, sheets, profile),
  };
}

/** Lista de corte agrupada por pieza (etiqueta + medidas + material). */
function buildCutList(layoutSheets, parts) {
  const byPart = new Map(parts.map((part) => [part.id, part]));
  const entries = new Map();

  for (const sheet of layoutSheets) {
    for (const placement of sheet.placements) {
      if (!entries.has(placement.partId)) {
        const part = byPart.get(placement.partId);
        entries.set(placement.partId, {
          id: placement.partId,
          label: placement.label,
          width: part?.width ?? placement.partWidth,
          height: part?.height ?? placement.partHeight,
          grain: placement.grain,
          material: placement.material,
          machined: placement.machined,
          edges: placement.edges,
          edgeLengthMm: edgeLength(part ?? placement),
          qty: 0,
          sheets: [],
          area: 0,
        });
      }
      const entry = entries.get(placement.partId);
      entry.qty += 1;
      if (!entry.sheets.includes(sheet.index)) entry.sheets.push(sheet.index);
      entry.area = round(entry.area + placement.partWidth * placement.partHeight);
    }
  }

  return [...entries.values()].map((entry) => ({ ...entry, areaM2: round(entry.area / 1e6, 4) }));
}

function edgeLength(part) {
  const { top, right, bottom, left } = part.edges ?? {};
  return round((top ? part.width : 0) + (bottom ? part.width : 0) + (left ? part.height : 0) + (right ? part.height : 0));
}
