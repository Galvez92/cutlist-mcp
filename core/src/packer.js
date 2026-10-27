/**
 * Colocación de piezas sobre tableros.
 *
 * Dos estrategias:
 *  - `guillotine`: filas (shelf) separadas por cortes pasantes; apto para
 *    escuadradora / seccionadora.
 *  - `maxrects`:MaxRects (lista de rectángulos libres) que permite nesting más
 *    denso sin exigir cortes pasantes.
 *
 * El kerf se aplica entre piezas: al colocar, cada pieza ocupa su rectángulo más
 * `kerf` mm por la derecha y por abajo, y el área útil del tablero se amplía en
 * `kerf` para que las piezas puedan tocar los bordes derecho e inferior.
 * La veta fija la orientación: solo las piezas con `grain = 'none'` pueden girar.
 */

import { GRAIN, MODES } from './pieces.js';

const EPS = 1e-6;
const fits = (need, available) => need <= available + EPS;
const overlaps = (a, b) =>
  !(
    a.x + a.w <= b.x + EPS ||
    b.x + b.w <= a.x + EPS ||
    a.y + a.h <= b.y + EPS ||
    b.y + b.h <= a.y + EPS
  );

function orientations(piece) {
  const options = [{ width: piece.width, height: piece.height, rotated: false }];
  if (piece.grain === GRAIN.NONE && Math.abs(piece.width - piece.height) > EPS) {
    options.push({ width: piece.height, height: piece.width, rotated: true });
  }
  return options;
}

/**
 * Abre tableros respetando el stock de cada medida (null = ilimitado).
 * Solo abre una medida que pueda contener la pieza, para no gastar stock ni
 * dejar tableros vacíos con piezas que no caben.
 */
function createSheetOpener(sheets, kerf) {
  const remaining = sheets.map((sheet) => sheet.stock ?? null);
  let opened = 0;
  return {
    open(piece) {
      for (let i = 0; i < sheets.length; i += 1) {
        if (remaining[i] !== null && remaining[i] <= 0) continue;
        if (piece && !canHold(sheets[i], piece)) continue;
        if (remaining[i] !== null) remaining[i] -= 1;
        opened += 1;
        return { spec: sheets[i], index: opened, specIndex: i };
      }
      return null;
    },
  };
}

function canHold(sheet, piece) {
  return orientations(piece).some((o) => fits(o.width, sheet.width) && fits(o.height, sheet.height));
}

function makeSheet({ spec, index, specIndex }, kerf) {
  return {
    spec,
    index,
    specIndex,
    name: spec.name,
    width: spec.width,
    height: spec.height,
    thickness: spec.thickness ?? null,
    kerf,
    // área útil ampliada en kerf: permite tocar los bordes y deja kerf entre piezas
    usableWidth: spec.width + kerf,
    usableHeight: spec.height + kerf,
    placements: [],
    free: [{ x: 0, y: 0, w: spec.width + kerf, h: spec.height + kerf }],
    rows: [],
  };
}

function reasonFor(piece, sheets) {
  const fitsSomewhere = sheets.some((sheet) => canHold(sheet, piece));
  return fitsSomewhere ? 'sin stock disponible de tableros' : 'la pieza no cabe en ningún tablero del stock';
}

function toPlacement(piece, { x, y, width, height, rotated }) {
  return {
    pieceId: piece.pieceId,
    partId: piece.id,
    label: piece.label,
    material: piece.material,
    grain: piece.grain,
    machined: piece.machined,
    edges: piece.edges,
    x,
    y,
    width,
    height,
    rotated,
    partWidth: piece.width,
    partHeight: piece.height,
    area: width * height,
  };
}

export function packMaxRects(pieces, sheets, kerf = 0) {
  const opener = createSheetOpener(sheets, kerf);
  const placedSheets = [];
  const unplaced = [];

  for (const piece of pieces) {
    let target = null;
    let candidate = null;

    for (const sheet of placedSheets) {
      const found = findBestRect(sheet, piece, kerf);
      if (found) {
        target = sheet;
        candidate = found;
        break; // primer tablero abierto con encaje
      }
    }

    if (!target) {
      const opened = opener.open(piece);
      if (opened) {
        const sheet = makeSheet(opened, kerf);
        const found = findBestRect(sheet, piece, kerf);
        if (found) {
          placedSheets.push(sheet);
          target = sheet;
          candidate = found;
        }
      }
    }

    if (!target) {
      unplaced.push({ piece, reason: reasonFor(piece, sheets) });
      continue;
    }

    target.placements.push(toPlacement(piece, candidate));
    splitFreeRects(target, {
      x: candidate.x,
      y: candidate.y,
      w: candidate.width + kerf,
      h: candidate.height + kerf,
    });
  }

  return { sheets: placedSheets, unplaced };
}

function findBestRect(sheet, piece, kerf) {
  let best = null;
  sheet.free.forEach((rect, freeIndex) => {
    for (const o of orientations(piece)) {
      const needWidth = o.width + kerf;
      const needHeight = o.height + kerf;
      if (!fits(needWidth, rect.w) || !fits(needHeight, rect.h)) continue;
      const leftoverShort = Math.min(rect.w - needWidth, rect.h - needHeight);
      const leftoverLong = Math.max(rect.w - needWidth, rect.h - needHeight);
      // menor sobrante del lado corto, luego del largo; desempate estable abajo-izquierda
      const score = leftoverShort * 1e6 + leftoverLong * 1e3 + rect.y * 1e-3 + rect.x * 1e-6;
      if (!best || score < best.score - EPS) {
        best = { x: rect.x, y: rect.y, width: o.width, height: o.height, rotated: o.rotated, score, freeIndex };
      }
    }
  });
  return best;
}

function splitFreeRects(sheet, occupied) {
  const next = [];
  for (const rect of sheet.free) {
    if (!overlaps(rect, occupied)) {
      next.push(rect);
      continue;
    }
    if (occupied.x > rect.x) next.push({ x: rect.x, y: rect.y, w: occupied.x - rect.x, h: rect.h });
    if (occupied.x + occupied.w < rect.x + rect.w) {
      next.push({ x: occupied.x + occupied.w, y: rect.y, w: rect.x + rect.w - (occupied.x + occupied.w), h: rect.h });
    }
    if (occupied.y > rect.y) next.push({ x: rect.x, y: rect.y, w: rect.w, h: occupied.y - rect.y });
    if (occupied.y + occupied.h < rect.y + rect.h) {
      next.push({ x: rect.x, y: occupied.y + occupied.h, w: rect.w, h: rect.y + rect.h - (occupied.y + occupied.h) });
    }
  }
  sheet.free = pruneRects(next);
}

function pruneRects(rects) {
  const usable = rects.filter((r) => r.w > EPS && r.h > EPS);
  return usable.filter(
    (rect, i) =>
      !usable.some(
        (other, j) =>
          i !== j &&
          other.x <= rect.x + EPS &&
          other.y <= rect.y + EPS &&
          other.x + other.w >= rect.x + rect.w - EPS &&
          other.y + other.h >= rect.y + rect.h - EPS,
      ),
  );
}

export function packGuillotine(pieces, sheets, kerf = 0) {
  const opener = createSheetOpener(sheets, kerf);
  const placedSheets = [];
  const unplaced = [];

  for (const piece of pieces) {
    let placed = false;

    for (const sheet of placedSheets) {
      if (placeInRows(sheet, piece, kerf)) {
        placed = true;
        break;
      }
    }

    if (!placed) {
      const opened = opener.open(piece);
      if (opened) {
        const sheet = makeSheet(opened, kerf);
        if (placeInRows(sheet, piece, kerf)) {
          placedSheets.push(sheet);
          placed = true;
        }
      }
    }

    if (!placed) unplaced.push({ piece, reason: reasonFor(piece, sheets) });
  }

  return { sheets: placedSheets, unplaced };
}

function placeInRows(sheet, piece, kerf) {
  // 1. filas existentes: solo cabe si no supera el alto de la fila
  for (const row of sheet.rows) {
    for (const o of orientations(piece)) {
      if (fits(o.height, row.height) && fits(row.x + o.width + kerf, sheet.usableWidth)) {
        sheet.placements.push(toPlacement(piece, { x: row.x, y: row.y, width: o.width, height: o.height, rotated: o.rotated }));
        row.x += o.width + kerf;
        return true;
      }
    }
  }

  // 2. fila nueva debajo de la última
  const last = sheet.rows[sheet.rows.length - 1];
  const y = last ? last.y + last.height + kerf : 0;
  for (const o of orientations(piece)) {
    if (fits(o.width + kerf, sheet.usableWidth) && fits(y + o.height + kerf, sheet.usableHeight)) {
      sheet.rows.push({ y, height: o.height, x: o.width + kerf });
      sheet.placements.push(toPlacement(piece, { x: 0, y, width: o.width, height: o.height, rotated: o.rotated }));
      return true;
    }
  }

  return false;
}

export const PACKERS = Object.freeze({
  [MODES.GUILLOTINE]: packGuillotine,
  [MODES.MAXRECTS]: packMaxRects,
});
