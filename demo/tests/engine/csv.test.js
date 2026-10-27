import { describe, expect, it } from 'vitest';
import {
  CSV_EOL,
  CUTLIST_HEADER,
  PLACEMENTS_HEADER,
  csvEscape,
  cutListCsv,
  optimize,
  placementsCsv,
  toCsv,
} from '@core/index.js';

/** Lector CSV mínimo según el ABNF de RFC 4180 (para comprobar la ida y vuelta). */
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') {
        field += '"';
        i += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\r' && text[i + 1] === '\n') {
      row.push(field);
      field = '';
      rows.push(row);
      row = [];
      i += 1;
    } else {
      field += char;
    }
  }

  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows;
}

const layout = () =>
  optimize({
    kerf: 4,
    parts: [
      { label: 'Costado, 18 mm', width: 500, height: 400, qty: 2, material: 'MDF blanco' },
      { label: 'Estante "alto"', width: 900, height: 300, qty: 1 },
    ],
    sheets: [{ name: 'MDF 18', width: 1200, height: 900, thickness: 18 }],
  });

describe('csvEscape', () => {
  it('cita solo cuando hace falta y duplica comillas', () => {
    expect(csvEscape('simple')).toBe('simple');
    expect(csvEscape('con,coma')).toBe('"con,coma"');
    expect(csvEscape('con"comilla')).toBe('"con""comilla"');
    expect(csvEscape('con\nsalto')).toBe('"con\nsalto"');
    expect(csvEscape(null)).toBe('');
    expect(csvEscape(12.5)).toBe('12.5');
  });
});

describe('toCsv', () => {
  it('usa CRLF como fin de línea y termina cada registro', () => {
    const text = toCsv([['a', 'b'], ['c', 'd']]);
    expect(text).toBe(`a,b${CSV_EOL}c,d${CSV_EOL}`);
  });
});

describe('cutListCsv', () => {
  it('genera cabecera + una fila por pieza agrupada', () => {
    const result = layout();
    const rows = parseCsv(cutListCsv(result));

    expect(rows[0]).toEqual(CUTLIST_HEADER);
    expect(rows).toHaveLength(1 + result.cutList.length);
    expect(rows.every((row) => row.length === CUTLIST_HEADER.length)).toBe(true);
  });

  it('conserva las comas y las comillas de las etiquetas', () => {
    const result = layout();
    const rows = parseCsv(cutListCsv(result));
    const labels = rows.slice(1).map((row) => row[0]);

    expect(labels).toContain('Costado, 18 mm');
    expect(labels).toContain('Estante "alto"');
  });

  it('exporta cantidades y medidas numéricas', () => {
    const rows = parseCsv(cutListCsv(layout()));
    const costado = rows.find((row) => row[0] === 'Costado, 18 mm');

    expect(costado[1]).toBe('2');
    expect(costado[2]).toBe('500');
    expect(costado[3]).toBe('400');
    expect(costado[5]).toBe('MDF blanco');
  });
});

describe('placementsCsv', () => {
  it('una fila por pieza colocada con su tablero y posición', () => {
    const result = layout();
    const rows = parseCsv(placementsCsv(result));

    expect(rows[0]).toEqual(PLACEMENTS_HEADER);
    expect(rows).toHaveLength(1 + result.stats.piecesPlaced);
    expect(rows[1][0]).toBe('1');
    expect(Number(rows[1][3])).toBeGreaterThanOrEqual(0);
    expect(Number(rows[1][4])).toBeGreaterThanOrEqual(0);
  });

  it('marca las piezas giradas', () => {
    const result = optimize({
      kerf: 0,
      parts: [{ label: 'Ancha', width: 1800, height: 600, qty: 1 }],
      sheets: [{ name: 'MDF', width: 1200, height: 2000 }],
    });
    const rows = parseCsv(placementsCsv(result));
    expect(rows[1][7]).toBe('sí');
  });
});
