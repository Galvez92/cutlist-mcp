import { describe, expect, it } from 'vitest';
import {
  GRAIN,
  InputError,
  MODES,
  PROFILES,
  checkProfile,
  expandPieces,
  normalizeEdges,
  normalizeGrain,
  normalizeInput,
} from '@core/index.js';

const part = (overrides = {}) => ({ label: 'P', width: 600, height: 400, qty: 1, grain: 'none', ...overrides });
const sheet = (overrides = {}) => ({ name: 'MDF 18', width: 2500, height: 1830, thickness: 18, ...overrides });

describe('normalizeInput', () => {
  it('normaliza una entrada válida y aplica valores por defecto', () => {
    const input = normalizeInput({ parts: [part()], sheets: [sheet()] });

    expect(input.mode).toBe(MODES.GUILLOTINE);
    expect(input.kerf).toBe(0);
    expect(input.parts[0]).toMatchObject({ id: 'P1', width: 600, height: 400, qty: 1, grain: GRAIN.NONE });
    expect(input.sheets[0]).toMatchObject({ name: 'MDF 18', width: 2500, height: 1830, thickness: 18, stock: null });
  });

  it('acepta números como texto con coma decimal', () => {
    const input = normalizeInput({ parts: [part({ width: '732,5', height: '600' })], sheets: [sheet()] });
    expect(input.parts[0].width).toBe(732.5);
    expect(input.parts[0].height).toBe(600);
  });

  it('reúne todos los problemas en un InputError', () => {
    let error;
    try {
      normalizeInput({ parts: [{ label: 'x', width: -1, height: 0, qty: 0, grain: 'diagonal' }], sheets: [] });
    } catch (cause) {
      error = cause;
    }

    expect(error).toBeInstanceOf(InputError);
    expect(error.issues).toHaveLength(5); // ancho, alto, cantidad y veta de la pieza + falta de tableros
    expect(error.issues.join(' ')).toContain('no hay tableros en stock');
  });

  it('rechaza modo, kerf y stock inválidos', () => {
    let issues = [];
    try {
      normalizeInput({ parts: [part()], sheets: [sheet()], mode: 'magia', kerf: -3 });
    } catch (error) {
      issues = error.issues;
    }
    expect(issues.join(' ')).toContain('modo inválido');
    expect(issues.join(' ')).toContain('kerf inválido');

    expect(() => normalizeInput({ parts: [part()], sheets: [sheet({ stock: 0 })] })).toThrow(/stock inválido/);
  });
});

describe('normalizeGrain', () => {
  it('acepta alias en español y valores del motor', () => {
    expect(normalizeGrain('largo')).toBe(GRAIN.LENGTH);
    expect(normalizeGrain('ancho')).toBe(GRAIN.WIDTH);
    expect(normalizeGrain('')).toBe(GRAIN.NONE);
    expect(normalizeGrain(undefined)).toBe(GRAIN.NONE);
    expect(normalizeGrain('diagonal')).toBeNull();
  });
});

describe('normalizeEdges', () => {
  it('un número aplica a los 4 lados', () => {
    expect(normalizeEdges(0.4)).toEqual({ top: 0.4, right: 0.4, bottom: 0.4, left: 0.4 });
  });

  it('acepta objeto por lado y descarta valores inválidos', () => {
    expect(normalizeEdges({ top: 0.4, left: -1, right: 'x' })).toEqual({ top: 0.4, right: 0, bottom: 0, left: 0 });
  });
});

describe('expandPieces', () => {
  it('crea una pieza física por unidad y ordena por área descendente', () => {
    const parts = normalizeInput({
      parts: [part({ id: 'A', width: 100, height: 100, qty: 2 }), part({ id: 'B', width: 400, height: 400 })],
      sheets: [sheet()],
    }).parts;

    const pieces = expandPieces(parts);
    expect(pieces).toHaveLength(3);
    expect(pieces.map((piece) => piece.id)).toEqual(['B', 'A', 'A']);
    expect(pieces.map((piece) => piece.pieceId)).toEqual(['B#1', 'A#1', 'A#2']);
  });
});

describe('checkProfile', () => {
  const profile = PROFILES['cortecloud-madijal'];

  it('sin perfil no genera avisos', () => {
    expect(checkProfile([part()], [sheet()], null)).toEqual([]);
  });

  it('avisa pieza chica, mecanizada corta y pieza fuera de máximo', () => {
    const warnings = checkProfile(
      [
        part({ label: 'Tirita', width: 60, height: 300 }),
        part({ label: 'Mecanizada', width: 200, height: 240, machined: true }),
        part({ label: 'Enorme', width: 2600, height: 1200 }),
      ],
      [sheet()],
      profile,
    );

    expect(warnings.join('\n')).toMatch(/Tirita.*mínimo 65 mm/);
    expect(warnings.join('\n')).toMatch(/Mecanizada/);
    expect(warnings.join('\n')).toMatch(/Enorme.*2480×1810/);
  });

  it('descuenta el canto del lado menor', () => {
    // 65.5 mm − 2 × 0.4 mm de canto = 64.7 mm terminados, bajo el mínimo de 65 mm
    const conCanto = checkProfile([part({ width: 65.5, height: 300, edges: 0.4 })], [sheet()], profile);
    const sinCanto = checkProfile([part({ width: 65.5, height: 300 })], [sheet()], profile);

    expect(conCanto.join('\n')).toMatch(/lado menor terminado 64\.7 mm bajo el mínimo 65/);
    expect(sinCanto).toEqual([]);
  });

  it('avisa si el tablero supera la medida habitual del perfil', () => {
    const warnings = checkProfile([part()], [sheet({ name: 'Grande', width: 3000, height: 2000 })], profile);
    expect(warnings.join('\n')).toMatch(/mayor al habitual/);
  });

  it('el perfil declara su procedencia por revisar', () => {
    expect(profile.verified).toBe(false);
    expect(profile.source).toContain('MEMORIA.md');
  });
});
