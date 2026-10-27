import { describe, expect, it } from 'vitest';
import { optimize } from '@core/index.js';

const sheet = (overrides = {}) => ({ name: 'MDF 18', width: 2500, height: 1830, thickness: 18, ...overrides });
const piece = (overrides = {}) => ({ label: 'Pieza', width: 500, height: 300, qty: 1, grain: 'none', ...overrides });

/** Invariantes comunes: dentro del tablero, sin solapes y con kerf entre piezas. */
function expectValidLayout(layout) {
  for (const current of layout.sheets) {
    for (const placement of current.placements) {
      expect(placement.x).toBeGreaterThanOrEqual(0);
      expect(placement.y).toBeGreaterThanOrEqual(0);
      expect(placement.x + placement.width).toBeLessThanOrEqual(current.width + 1e-9);
      expect(placement.y + placement.height).toBeLessThanOrEqual(current.height + 1e-9);
    }

    for (let i = 0; i < current.placements.length; i += 1) {
      for (let j = i + 1; j < current.placements.length; j += 1) {
        const a = current.placements[i];
        const b = current.placements[j];
        const gapX = Math.max(a.x - (b.x + b.width), b.x - (a.x + a.width));
        const gapY = Math.max(a.y - (b.y + b.height), b.y - (a.y + a.height));
        expect(Math.max(gapX, gapY)).toBeGreaterThanOrEqual(layout.kerf - 1e-9);
      }
    }

    const usedArea = current.placements.reduce((sum, placement) => sum + placement.width * placement.height, 0);
    expect(current.stats.usedArea).toBeCloseTo(usedArea, 6);
  }
}

describe.each(['guillotine', 'maxrects'])('optimize en modo %s', (mode) => {
  it('coloca todas las piezas cuando caben y calcula el aprovechamiento', () => {
    const layout = optimize({
      mode,
      kerf: 4,
      parts: [piece({ label: 'Lateral', width: 500, height: 300, qty: 4 })],
      sheets: [sheet()],
    });

    expectValidLayout(layout);
    expect(layout.stats.sheetsUsed).toBe(1);
    expect(layout.stats.piecesPlaced).toBe(4);
    expect(layout.stats.piecesUnplaced).toBe(0);
    expect(layout.stats.yieldPct).toBeCloseTo((4 * 500 * 300) / (2500 * 1830) * 100, 2);
    expect(layout.sheets[0].stats.yieldPct).toBe(layout.stats.yieldPct);
    expect(layout.unplaced).toEqual([]);
  });

  it('respeta la veta: no gira piezas con veta declarada', () => {
    const layout = optimize({
      mode,
      kerf: 4,
      parts: [piece({ label: 'Con veta', width: 1200, height: 400, grain: 'length', qty: 2 })],
      sheets: [sheet({ width: 1300, height: 2000 })],
    });

    expect(layout.stats.piecesPlaced).toBe(2);
    expect(layout.sheets[0].placements.every((placement) => placement.rotated === false)).toBe(true);
    expectValidLayout(layout);
  });

  it('informa la pieza que no cabe en ningún tablero del stock', () => {
    const layout = optimize({
      mode,
      kerf: 4,
      parts: [piece({ label: 'Enorme', width: 3000, height: 1000 })],
      sheets: [sheet()],
    });

    expect(layout.stats.piecesPlaced).toBe(0);
    expect(layout.unplaced).toHaveLength(1);
    expect(layout.unplaced[0].reason).toMatch(/no cabe en ningún tablero/);
  });

  it('es determinista', () => {
    const input = {
      mode,
      kerf: 3,
      parts: [piece({ label: 'A', width: 700, height: 400, qty: 3 }), piece({ label: 'B', width: 400, height: 300, qty: 5 })],
      sheets: [sheet()],
    };

    expect(JSON.stringify(optimize(input))).toBe(JSON.stringify(optimize(input)));
  });
});

describe('stock de tableros', () => {
  // En un tablero de 2500×1830 entran 2 piezas de 1200×1800 por fila
  it('abre varios tableros mientras haya stock e informa cuando se agota', () => {
    const layout = optimize({
      kerf: 0,
      parts: [piece({ label: 'Costado', width: 1200, height: 1800, qty: 8 })],
      sheets: [sheet({ stock: 3 })],
    });

    expect(layout.stats.sheetsUsed).toBe(3);
    expect(layout.stats.piecesPlaced).toBe(6);
    expect(layout.unplaced).toHaveLength(2);
    expect(layout.unplaced[0].reason).toMatch(/sin stock/);
  });

  it('un stock vacío significa tableros ilimitados', () => {
    const layout = optimize({
      kerf: 0,
      parts: [piece({ label: 'Costado', width: 1200, height: 1800, qty: 5 })],
      sheets: [sheet({ stock: null })],
    });

    expect(layout.stats.sheetsUsed).toBe(3);
    expect(layout.unplaced).toEqual([]);
  });

  it('no abre tableros para piezas que no caben en ninguno', () => {
    const layout = optimize({
      kerf: 0,
      parts: [piece({ label: 'Enorme', width: 4000, height: 1000, qty: 2 })],
      sheets: [sheet({ width: 2500, height: 1830, stock: 5 })],
    });

    expect(layout.stats.sheetsUsed).toBe(0);
    expect(layout.unplaced).toHaveLength(2);
    expect(layout.sheets).toEqual([]);
  });
});

describe('kerf', () => {
  it('un kerf que no deja pasar el disco obliga a un tablero extra', () => {
    const parts = [piece({ label: 'Mitad', width: 500, height: 500, qty: 2 })];
    const sheets = [sheet({ width: 1000, height: 500 })];

    expect(optimize({ kerf: 0, parts, sheets }).stats.sheetsUsed).toBe(1);
    expect(optimize({ kerf: 40, parts, sheets }).stats.sheetsUsed).toBe(2);
  });
});

describe('lista de corte', () => {
  it('agrupa por pieza, cuenta unidades y lista los tableros usados', () => {
    const layout = optimize({
      kerf: 4,
      parts: [
        piece({ id: 'A', label: 'Costado', width: 500, height: 400, qty: 3, edges: 0.4, material: 'MDF blanco' }),
        piece({ id: 'B', label: 'Estante', width: 900, height: 300, qty: 1 }),
      ],
      sheets: [sheet({ width: 1200, height: 900 })],
    });

    const costado = layout.cutList.find((entry) => entry.id === 'A');
    expect(costado.qty).toBe(3);
    expect(costado.width).toBe(500);
    expect(costado.height).toBe(400);
    expect(costado.material).toBe('MDF blanco');
    expect(costado.edgeLengthMm).toBe(2 * (500 + 400)); // canto en los 4 lados
    expect(costado.sheets.length).toBeGreaterThanOrEqual(1);
    expect(layout.cutList.reduce((sum, entry) => sum + entry.qty, 0)).toBe(layout.stats.piecesPlaced);
  });

  it('aplica los avisos del perfil sin cambiar la colocación', () => {
    const input = {
      kerf: 4,
      parts: [piece({ label: 'Tirita', width: 60, height: 600 })],
      sheets: [sheet()],
      profile: { id: 'test', label: 'Perfil de prueba', minCut: 65, source: 'docs/memoria/MEMORIA.md', verified: false },
    };
    const withoutProfile = optimize({ ...input, profile: null });
    const withProfile = optimize(input);

    expect(withProfile.warnings).toHaveLength(1);
    expect(withProfile.stats).toEqual(withoutProfile.stats);
    expect(withoutProfile.warnings).toEqual([]);
  });
});
