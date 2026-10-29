import { describe, expect, it } from 'vitest';
import { optimize } from '@engine';
import {
  CORTECLOUD_FIELDS,
  importCortecloud,
  parseEdgeBand,
  parseMaterial,
} from '../../src/engine/cortecloud.js';
import { CORTECLOUD_FIXTURE, loadCortecloudExample } from '../../src/example.js';
import { partsForEngine, sheetForEngine } from '../../src/engine/adapt.js';

const edgeText = 'PVC 719L Roble Americano 0.4 x 22 mm REHAU ®';
const materialText = 'Roble Americano 2 C 18 mm 719L ARAUCO (2500x1830)';

describe('importCortecloud con el fixture real', () => {
  it('lee las 21 líneas y 30 piezas del fixture', () => {
    const example = loadCortecloudExample();

    expect(example.parts).toHaveLength(21);
    expect(example.parts.reduce((sum, part) => sum + part.qty, 0)).toBe(30);
    expect(example.skipped).toEqual([]);
  });

  it('deduce el tablero del texto de material del fixture', () => {
    const { sheet } = loadCortecloudExample();

    expect(sheet.width).toBe(2500);
    expect(sheet.height).toBe(1830);
    expect(sheet.thickness).toBe(18);
    expect(sheet.name).toContain('ARAUCO');
  });

  it('marca la importación como por revisar', () => {
    const example = loadCortecloudExample();

    expect(example.notes.join(' ')).toContain('por revisar');
    expect(example.notice).toContain('por revisar');
    expect(CORTECLOUD_FIELDS.filter((entry) => entry.verified === false).map((entry) => entry.field)).toContain('parts[].c');
  });

  it('el fixture define dos materiales de 2500×1830×18', () => {
    const { sheets } = importCortecloud(CORTECLOUD_FIXTURE);

    expect(sheets).toHaveLength(2);
    expect(sheets.map((sheet) => sheet.name.includes('ARAUCO'))).toEqual([true, true]);
  });
});

describe('importCortecloud', () => {
  const json = {
    parts: [
      { quantity: 1, c: 732, l: 600, function: 'Pata der', complement: 'D01', material: materialText, c1: edgeText, c2: null, l1: edgeText, l2: null, machining: null },
      { quantity: 2, c: 1173.5, l: 600, function: 'Cubierta', complement: 'D03', material: materialText, c1: null, c2: null, l1: null, l2: null, machining: { x: 1173.5, y: 600, z: 18 } },
      { quantity: 1, c: 153, l: 65, function: 'Tirita', complement: 'D04', material: 'Moscato 2 C 18 mm 771L ARAUCO (2500x1830)', c1: null, c2: null, l1: null, l2: null, machining: null },
    ],
  };

  it('mapea c a alto, l a ancho y el canto por lados', () => {
    const { parts } = importCortecloud(json);
    const [pata] = parts;

    expect(pata.width).toBe(600);
    expect(pata.height).toBe(732);
    expect(pata.qty).toBe(1);
    expect(pata.label).toBe('Pata der');
    expect(pata.grain).toBe('none');
    expect(pata.edges).toEqual({ left: 0.4, right: 0, top: 0.4, bottom: 0 });
    expect(pata.ref.group).toBe('D01');
    expect(pata.ref.verified).toBe(false);
  });

  it('permite intercambiar c y l (la convención de ejes está por revisar)', () => {
    const { parts } = importCortecloud(json, { swap: true });
    expect(parts[0].width).toBe(732);
    expect(parts[0].height).toBe(600);
  });

  it('marca como mecanizadas las piezas con machining', () => {
    const { parts } = importCortecloud(json);
    expect(parts.map((part) => part.machined)).toEqual([false, true, false]);
  });

  it('el canto se aplica al motor y se refleja en la lista de corte', () => {
    const { parts } = importCortecloud(json);
    const layout = optimize({
      parts: partsForEngine([parts[0]]),
      sheets: [{ label: 'MDF', width: 2500, height: 1830, thickness: 18 }],
    });

    const row = layout.cutList[0];
    // canto en left (0.4) y top (0.4): cutWidth - finishedWidth = 0.4 + 0 = 0.4 (solo top)
    // Actually: left+right = 0.4 + 0 = 0.4, top+bottom = 0.4 + 0 = 0.4
    expect(row.cutWidth - row.finishedWidth).toBeCloseTo(0.4, 5);
    expect(row.cutHeight - row.finishedHeight).toBeCloseTo(0.4, 5);
  });

  it('agrupa tableros por material declarado', () => {
    const { sheets } = importCortecloud(json);
    expect(sheets).toHaveLength(2);
    expect(sheets.every((sheet) => sheet.width === 2500 && sheet.height === 1830 && sheet.thickness === 18)).toBe(true);
  });

  it('omite las piezas sin medidas y las informa', () => {
    const { parts, skipped } = importCortecloud({ parts: [{ quantity: 1, c: null, l: 100 }] });
    expect(parts).toEqual([]);
    expect(skipped).toHaveLength(1);
    expect(skipped[0].field).toBe('c/l');
  });

  it('rechaza un JSON sin arreglo parts', () => {
    expect(() => importCortecloud({ piezas: [] })).toThrow(/parts/);
    expect(() => importCortecloud(null)).toThrow(/parts/);
  });
});

describe('parseMaterial / parseEdgeBand', () => {
  it('lee espesor y medida del texto de material', () => {
    expect(parseMaterial(materialText)).toEqual({
      name: materialText,
      thickness: 18,
      width: 2500,
      height: 1830,
      verified: false,
    });
  });

  it('devuelve null cuando el texto no trae medidas', () => {
    expect(parseMaterial('MDF sin medidas')).toEqual({
      name: 'MDF sin medidas',
      thickness: null,
      width: null,
      height: null,
      verified: false,
    });
    expect(parseMaterial('')).toBeNull();
  });

  it('lee espesor y altura de la cinta de canto', () => {
    expect(parseEdgeBand(edgeText)).toEqual({ text: edgeText, thicknessMm: 0.4, heightMm: 22, verified: false });
    expect(parseEdgeBand(null)).toBeNull();
  });
});
