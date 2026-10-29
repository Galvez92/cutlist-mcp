/**
 * Importador del formato Cortecloud (JSON `{"parts":[...]}`).
 *
 * POR REVISAR: no se encontró documentación pública oficial del formato; la
 * lectura se basa en la muestra real del repo y en las notas de
 * `docs/memoria/MEMORIA.md`:
 *  - fixture: tests/fixtures/cortecloud/escritorio_D_simple.json
 *  - notas:   docs/memoria/MEMORIA.md (sección "Decisiones")
 * Todo lo inferido queda marcado aquí y en la UI como `por revisar`.
 *
 * Este importador es parte del demo, no del motor (optimizer-engine).
 * Produce piezas y tableros en el formato interno del demo; `adapt.js` los
 * convierte al formato del motor.
 */

export const CORTECLOUD_SOURCE = {
  fixture: 'tests/fixtures/cortecloud/escritorio_D_simple.json',
  notes: 'docs/memoria/MEMORIA.md',
  verified: false,
};

export const CORTECLOUD_FIELDS = [
  { field: 'parts[].quantity', mapsTo: 'cantidad', verified: true },
  { field: 'parts[].c', mapsTo: 'alto (mm)', verified: false },
  { field: 'parts[].l', mapsTo: 'ancho (mm)', verified: false },
  { field: 'parts[].function', mapsTo: 'etiqueta', verified: true },
  { field: 'parts[].complement', mapsTo: 'grupo/módulo (informativo)', verified: true },
  { field: 'parts[].material', mapsTo: 'material y medida de tablero (heurística)', verified: false },
  { field: 'parts[].c1/c2/l1/l2', mapsTo: 'canto por lado (convención provisional)', verified: false },
  { field: 'parts[].machining', mapsTo: 'pieza mecanizada (booleano)', verified: false },
];

function toNumber(text) {
  const value = Number(String(text ?? '').replace(',', '.'));
  return Number.isFinite(value) ? value : null;
}

/** «PVC 719L Roble Americano 0.4 x 22 mm REHAU ®» → { thicknessMm: 0.4, heightMm: 22 } */
export function parseEdgeBand(text) {
  if (typeof text !== 'string' || text.trim() === '') return null;
  const match = text.match(/(\d+(?:[.,]\d+)?)\s*[x×]\s*(\d+(?:[.,]\d+)?)\s*mm/i);
  return {
    text: text.trim(),
    thicknessMm: match ? toNumber(match[1]) : null,
    heightMm: match ? toNumber(match[2]) : null,
    verified: false,
  };
}

/** «Roble Americano 2 C 18 mm 719L ARAUCO (2500x1830)» → nombre, espesor y medida. */
export function parseMaterial(text) {
  if (typeof text !== 'string' || text.trim() === '') return null;
  const thickness = text.match(/(\d+(?:[.,]\d+)?)\s*mm/i);
  const size = text.match(/\((\d+(?:[.,]\d+)?)\s*x\s*(\d+(?:[.,]\d+)?)\)/i);
  return {
    name: text.trim(),
    thickness: thickness ? toNumber(thickness[1]) : null,
    width: size ? toNumber(size[1]) : null,
    height: size ? toNumber(size[2]) : null,
    verified: false,
  };
}

const edgeSides = (part) => ({
  left: Boolean(part.c1),
  right: Boolean(part.c2),
  top: Boolean(part.l1),
  bottom: Boolean(part.l2),
});

const edgeThickness = (part) => {
  const parsed = [part.c1, part.c2, part.l1, part.l2].map(parseEdgeBand).filter(Boolean);
  return parsed.length ? Math.max(...parsed.map((edge) => edge.thicknessMm ?? 0)) : 0;
};

/**
 * Convierte un JSON de Cortecloud en piezas y tableros del demo.
 * `swap` intercambia c/l (por si la convención de ejes es la contraria).
 */
export function importCortecloud(json, { swap = false, grain = 'none' } = {}) {
  const rawParts = Array.isArray(json?.parts) ? json.parts : null;
  if (!rawParts) {
    throw new Error('JSON de Cortecloud inválido: falta el arreglo "parts"');
  }

  const parts = [];
  const skipped = [];

  rawParts.forEach((raw, index) => {
    const long = toNumber(raw.c);
    const width = toNumber(raw.l);
    if (!(long > 0) || !(width > 0)) {
      skipped.push({ index, field: 'c/l', value: `${raw.c}/${raw.l}` });
      return;
    }
    const thickness = edgeThickness(raw);
    const sides = edgeSides(raw);
    const edges = Object.fromEntries(
      Object.entries(sides).map(([side, banded]) => [side, banded ? thickness : 0]),
    );

    parts.push({
      id: `C${index + 1}`,
      label: raw.function?.trim() || `Pieza ${index + 1}`,
      width: swap ? long : width,
      height: swap ? width : long,
      qty: Number.isFinite(raw.quantity) && raw.quantity > 0 ? Math.round(raw.quantity) : 1,
      grain,
      material: raw.material ?? null,
      machined: raw.machining != null,
      edges,
      ref: {
        source: 'cortecloud',
        verified: false,
        c: long,
        l: width,
        group: raw.complement ?? null,
        edgeTexts: { c1: raw.c1 ?? null, c2: raw.c2 ?? null, l1: raw.l1 ?? null, l2: raw.l2 ?? null },
        machining: raw.machining ?? null,
      },
    });
  });

  const sheets = [];
  const seen = new Map();
  for (const part of parts) {
    const material = parseMaterial(part.material);
    const key = material?.name ?? `sin-material-${sheets.length}`;
    if (seen.has(key)) continue;
    const sheet = {
      name: material?.name ?? 'Tablero sin material declarado',
      width: material?.width ?? null,
      height: material?.height ?? null,
      thickness: material?.thickness ?? null,
      stock: null,
    };
    seen.set(key, sheet);
    sheets.push(sheet);
  }

  const notes = [
    'por revisar: no hay documentación pública oficial del formato Cortecloud; lectura basada en la muestra real del repo.',
    'por revisar: `c` se toma como alto y `l` como ancho (intercambiable desde la demo).',
    'por revisar: la medida y el espesor del tablero se infieren del texto de `material`.',
    'por revisar: el canto usa la convención c1/c2 = lados del largo, l1/l2 = lados del ancho; el largo total es exacto, la posición física no está verificada.',
    'el formato no declara veta: las piezas se importan sin veta (pueden girar).',
  ];

  return { parts, sheets, notes, skipped };
}
