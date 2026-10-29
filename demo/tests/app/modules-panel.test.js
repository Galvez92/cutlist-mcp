// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../../src/app.js';

function setup() {
  document.body.innerHTML = '<div id="app"></div>';
  createApp(document.querySelector('#app'));
  return { root: document.querySelector('#app') };
}

const query = (selector) => document.querySelector(selector);
const count = (selector) => document.querySelectorAll(selector).length;
const qtyTotal = () =>
  [...document.querySelectorAll('tbody[data-role="rows"] tr')].reduce(
    (sum, tr) => sum + Number(tr.querySelector('input[data-field="qty"]').value),
    0,
  );
/** Cuenta los rectángulos de pieza en el SVG (fill=hsl, exclusivo de piezas). */
const pieceRects = () => count('[data-role="layout"] svg rect[fill^="hsl"]');

function selectModule(tipo) {
  const select = query('[data-role="module-type"]');
  select.value = tipo;
  select.dispatchEvent(new Event('change', { bubbles: true }));
}

describe('módulos paramétricos en la demo', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('genera la cajonera por omisión y recalcula el layout', () => {
    setup();
    // arranca con el ejemplo real del escritorio compacto (fixture)
    expect(count('tbody[data-role="rows"] tr')).toBe(21);

    selectModule('cajonera');
    query('button[data-action="generate"]').click();

    expect(count('tbody[data-role="rows"] tr')).toBe(10); // 10 líneas agrupadas
    expect(qtyTotal()).toBe(30); // 30 piezas
    expect(pieceRects()).toBe(30); // todas colocadas
    expect(query('[data-role="module-notice"]').hidden).toBe(false);
    expect(query('[data-role="module-notice"]').textContent).toContain('Cajonera');
    expect(query('[data-role="stat-mode"]').textContent).toBe('guillotine');
  });

  it('cambia de módulo y redibuja los campos del registro', () => {
    setup();
    const before = count('[data-role="fields"] [data-name]');
    selectModule('librero');
    const after = count('[data-role="fields"] [data-name]');
    expect(before).not.toBe(after); // distintos módulos, distinta cantidad de campos
    expect(query('button[data-action="generate"]')).toBeTruthy();
  });

  it('genera un clóset y vuelve al ejemplo del escritorio compacto', () => {
    setup();
    selectModule('closet');
    query('button[data-action="generate"]').click();
    expect(qtyTotal()).toBeGreaterThan(0);
    expect(count('tbody[data-role="rows"] tr')).not.toBe(21);

    query('button[data-action="example"]').click();
    expect(count('tbody[data-role="rows"] tr')).toBe(21);
    expect(qtyTotal()).toBe(30);
  });
});
