/**
 * Normalización y validación de piezas y tableros.
 *
 * Unidades: milímetros (mm). Ejes: x = ancho del tablero, y = alto del tablero.
 * Veta (`grain`): 'none' permite girar la pieza; 'length'/'width' la fijan.
 */

export const GRAIN = Object.freeze({
  NONE: 'none',
  LENGTH: 'length', // la veta corre a lo largo del alto (eje y)
  WIDTH: 'width', // la veta corre a lo largo del ancho (eje x)
});

export const MODES = Object.freeze({
  GUILLOTINE: 'guillotine', // cortes pasantes de lado a lado (escuadradora)
  MAXRECTS: 'maxrects', // nesting libre (CNC / seccionadora con retales)
});

export class InputError extends Error {
  constructor(issues) {
    super(`Entrada inválida: ${issues.join(' | ')}`);
    this.name = 'InputError';
    this.issues = issues;
  }
}

function toNumber(value) {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const cleaned = value.trim().replace(/\s/g, '').replace(',', '.');
    if (cleaned === '') return NaN;
    return Number(cleaned);
  }
  return NaN;
}

const isPositive = (n) => Number.isFinite(n) && n > 0;
const isEmpty = (v) => v == null || (typeof v === 'string' && v.trim() === '');

export function normalizeGrain(value) {
  if (isEmpty(value)) return GRAIN.NONE;
  const key = String(value).trim().toLowerCase();
  const table = {
    none: GRAIN.NONE,
    sin: GRAIN.NONE,
    ninguna: GRAIN.NONE,
    sin_veta: GRAIN.NONE,
    length: GRAIN.LENGTH,
    largo: GRAIN.LENGTH,
    vertical: GRAIN.LENGTH,
    width: GRAIN.WIDTH,
    ancho: GRAIN.WIDTH,
    horizontal: GRAIN.WIDTH,
  };
  return table[key] ?? null;
}

/** Canto (edge banding) por lado, en mm. Acepta número (los 4 lados) u objeto. */
export function normalizeEdges(value) {
  const edges = { top: 0, right: 0, bottom: 0, left: 0 };
  if (isEmpty(value)) return edges;
  if (typeof value === 'number' || typeof value === 'string') {
    const thickness = toNumber(value);
    const t = Number.isFinite(thickness) && thickness > 0 ? thickness : 0;
    return { top: t, right: t, bottom: t, left: t };
  }
  for (const side of Object.keys(edges)) {
    const thickness = toNumber(value[side]);
    edges[side] = Number.isFinite(thickness) && thickness > 0 ? thickness : 0;
  }
  return edges;
}

export function normalizePart(raw = {}, index = 0) {
  const issues = [];
  const width = toNumber(raw.width);
  const height = toNumber(raw.height);
  const qty = isEmpty(raw.qty) ? 1 : toNumber(raw.qty);
  const grain = normalizeGrain(raw.grain);

  if (!isPositive(width)) issues.push(`pieza #${index + 1}: ancho inválido (${raw.width})`);
  if (!isPositive(height)) issues.push(`pieza #${index + 1}: alto inválido (${raw.height})`);
  if (!Number.isInteger(qty) || qty < 1) issues.push(`pieza #${index + 1}: cantidad inválida (${raw.qty})`);
  if (!grain) issues.push(`pieza #${index + 1}: veta inválida (${raw.grain}); usa none, length o width`);

  return {
    issues,
    part: {
      id: isEmpty(raw.id) ? `P${index + 1}` : String(raw.id),
      label: isEmpty(raw.label) ? `Pieza ${index + 1}` : String(raw.label),
      width,
      height,
      qty: Number.isInteger(qty) ? qty : 1,
      grain: grain ?? GRAIN.NONE,
      material: isEmpty(raw.material) ? null : String(raw.material),
      machined: Boolean(raw.machined),
      edges: normalizeEdges(raw.edges),
      ref: raw.ref ?? null, // datos del formato de origen; informativo
    },
  };
}

export function normalizeSheet(raw = {}, index = 0) {
  const issues = [];
  const width = toNumber(raw.width);
  const height = toNumber(raw.height);
  const thickness = isEmpty(raw.thickness) ? null : toNumber(raw.thickness);
  const stock = isEmpty(raw.stock) ? null : toNumber(raw.stock);

  if (!isPositive(width)) issues.push(`tablero #${index + 1}: ancho inválido (${raw.width})`);
  if (!isPositive(height)) issues.push(`tablero #${index + 1}: alto inválido (${raw.height})`);
  if (thickness != null && !isPositive(thickness)) issues.push(`tablero #${index + 1}: espesor inválido (${raw.thickness})`);
  if (stock != null && (!Number.isInteger(stock) || stock < 1)) issues.push(`tablero #${index + 1}: stock inválido (${raw.stock})`);

  return {
    issues,
    sheet: {
      name: isEmpty(raw.name) ? `Tablero ${index + 1}` : String(raw.name),
      width,
      height,
      thickness,
      stock,
    },
  };
}

/**
 * Valida y normaliza la entrada completa del optimizador.
 * Lanza InputError con la lista de problemas si algo no es usable.
 */
export function normalizeInput(input = {}) {
  const issues = [];
  const rawParts = Array.isArray(input.parts) ? input.parts : [];
  const rawSheets = Array.isArray(input.sheets) ? input.sheets : [];

  if (rawParts.length === 0) issues.push('no hay piezas');
  if (rawSheets.length === 0) issues.push('no hay tableros en stock');

  const parts = rawParts.map((raw, i) => {
    const { part, issues: partIssues } = normalizePart(raw, i);
    issues.push(...partIssues);
    return part;
  });
  const sheets = rawSheets.map((raw, i) => {
    const { sheet, issues: sheetIssues } = normalizeSheet(raw, i);
    issues.push(...sheetIssues);
    return sheet;
  });

  const mode = isEmpty(input.mode) ? MODES.GUILLOTINE : String(input.mode);
  if (!Object.values(MODES).includes(mode)) issues.push(`modo inválido (${input.mode}); usa guillotine o maxrects`);

  const kerf = isEmpty(input.kerf) ? 0 : toNumber(input.kerf);
  if (!(Number.isFinite(kerf) && kerf >= 0)) issues.push(`kerf inválido (${input.kerf})`);

  if (issues.length) throw new InputError(issues);
  return { parts, sheets, kerf, mode, profile: input.profile ?? null };
}

/** Una pieza física por unidad de cantidad, ordenadas de mayor a menor área. */
export function expandPieces(parts) {
  const pieces = [];
  for (const part of parts) {
    for (let copy = 1; copy <= part.qty; copy += 1) {
      pieces.push({ ...part, pieceId: `${part.id}#${copy}`, copy });
    }
  }
  return pieces.sort((a, b) => {
    const areaDiff = b.width * b.height - a.width * a.height;
    if (areaDiff !== 0) return areaDiff;
    if (b.height !== a.height) return b.height - a.height;
    if (b.width !== a.width) return b.width - a.width;
    const labelDiff = a.label.localeCompare(b.label, 'es');
    if (labelDiff !== 0) return labelDiff;
    return a.pieceId.localeCompare(b.pieceId, 'es');
  });
}

/** Avisos del perfil de restricciones (por revisar: ver core/src/profile.js). */
export function checkProfile(parts, sheets, profile) {
  if (!profile) return [];
  const warnings = [];
  const name = profile.label ?? profile.id;

  for (const part of parts) {
    const shortSide = Math.min(part.width, part.height);
    const longSide = Math.max(part.width, part.height);
    const edge = Math.max(...Object.values(normalizeEdges(part.edges)), 0);
    // El canto se descuenta del lado; se estima descontando en ambos lados del lado corto.
    const finishedShortSide = shortSide - 2 * edge;

    if (profile.minCut && finishedShortSide < profile.minCut) {
      warnings.push(`«${part.label}»: lado menor terminado ${round(finishedShortSide)} mm bajo el mínimo ${profile.minCut} mm (perfil ${name})`);
    }
    if (profile.minMachinedLength && part.machined && longSide < profile.minMachinedLength) {
      warnings.push(`«${part.label}»: pieza mecanizada de ${round(longSide)} mm, bajo ${profile.minMachinedLength} mm (perfil ${name})`);
    }
    if (profile.maxPiece && (part.width > profile.maxPiece.width || part.height > profile.maxPiece.height)) {
      warnings.push(`«${part.label}»: ${round(part.width)}×${round(part.height)} mm supera el máximo ${profile.maxPiece.width}×${profile.maxPiece.height} mm (perfil ${name})`);
    }
  }

  for (const sheet of sheets) {
    if (profile.sheet && (sheet.width > profile.sheet.width || sheet.height > profile.sheet.height)) {
      warnings.push(`tablero «${sheet.name}»: ${round(sheet.width)}×${round(sheet.height)} mm mayor al habitual ${profile.sheet.width}×${profile.sheet.height} mm (perfil ${name})`);
    }
  }

  return warnings;
}

function round(value) {
  return Math.round(value * 100) / 100;
}
