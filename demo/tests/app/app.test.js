// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../../src/app.js';

function setup() {
  document.body.innerHTML = '<div id="app"></div>';
  const state = createApp(document.querySelector('#app'));
  return { state, root: document.querySelector('#app') };
}

const query = (selector) => document.querySelector(selector);
const count = (selector) => document.querySelectorAll(selector).length;

function type(selector, value) {
  const input = query(selector);
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  return input;
}

/** Cuenta los rectángulos de pieza en el SVG (fill=hsl, exclusivo de piezas). */
const pieceRects = () => count('[data-role="layout"] svg rect[fill^="hsl"]');

describe('demo web', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('arranca con el fixture real cargado y el layout dibujado', () => {
    const { state } = setup();

    expect(count('tbody[data-role="rows"] tr')).toBe(21);
    expect(state.parts.reduce((sum, part) => sum + part.qty, 0)).toBe(30);
    expect(state.layout.metrics.placed).toBe(30);
    expect(pieceRects()).toBe(30);
    expect(query('[data-role="stat-sheets"]').textContent).not.toBe('');
    expect(query('[data-role="notice"]').textContent).toContain('por revisar');
    expect(query('button[data-action="pdf"]').disabled).toBe(false);
  });

  it('recalcula el layout al editar una medida', () => {
    const { state } = setup();
    const before = query('[data-role="layout"]').innerHTML;

    type('input[data-field="width"][data-index="0"]', '800');

    expect(state.parts[0].width).toBe(800);
    expect(query('[data-role="layout"]').innerHTML).not.toBe(before);
    expect(query('[data-role="error"]').hidden).toBe(true);
  });

  it('permite agregar y quitar piezas', () => {
    const { state } = setup();

    query('button[data-action="add"]').click();
    expect(count('tbody[data-role="rows"] tr')).toBe(22);
    expect(state.parts).toHaveLength(22);
    expect(state.layout.metrics.placed).toBe(31);

    const lastRemove = document.querySelectorAll('button[data-action="remove"]')[21];
    lastRemove.click();
    expect(state.parts).toHaveLength(21);
    expect(count('tbody[data-role="rows"] tr')).toBe(21);
  });

  it('muestra el canto importado y lo aplica al editarlo', () => {
    const { state } = setup();
    const edgeInput = 'input[data-field="edgeMm"][data-index="0"]';

    expect(Number(query(edgeInput).value)).toBe(0.4); // canto real del fixture (Cortecloud)
    expect(query(edgeInput).closest('tr').title).toContain('PVC');

    type(edgeInput, '1');

    // 1 mm en los 4 lados: cutWidth - finishedWidth = 2 (1+1)
    const row = state.layout.cutList.find((entry) => entry.partId === state.parts[0].id);
    expect(row.cutWidth - row.finishedWidth).toBe(2);
    expect(row.cutHeight - row.finishedHeight).toBe(2);
  });

  it('muestra el error y desactiva las descargas si la entrada no es válida', () => {
    setup();

    type('input[data-field="width"][data-index="0"]', '');

    const error = query('[data-role="error"]');
    expect(error.hidden).toBe(false);
    expect(error.textContent).toMatch(/mayor que 0/);
    expect(query('button[data-action="pdf"]').disabled).toBe(true);
    expect(query('[data-role="layout"]').innerHTML).toContain('Sin layout');
  });

  it('cambia de modo de corte y de perfil sin romper el layout', () => {
    const { state } = setup();

    const select = query('#mode');
    select.value = 'maxrects';
    select.dispatchEvent(new Event('input', { bubbles: true }));
    expect(state.mode).toBe('maxrects');
    expect(state.layout.metrics.placed).toBe(30);

    const profile = query('#profile');
    profile.value = 'none';
    profile.dispatchEvent(new Event('input', { bubbles: true }));
    expect(state.profileId).toBe('none');
    expect(count('[data-role="warnings"] li')).toBe(0);
  });

  it('descarga el CSV de lista de corte desde el botón', async () => {
    setup();
    let captured = null;
    globalThis.URL.createObjectURL = (blob) => {
      captured = blob;
      return 'blob:capturado';
    };
    globalThis.URL.revokeObjectURL = () => {};

    query('button[data-action="csv-cutlist"]').click();

    expect(captured).toBeTruthy();
    const text = await captured.text();
    expect(text).toContain('codigo');
    expect(text).toContain('corte_ancho_mm');
    expect(text.split('\r\n').length).toBeGreaterThan(20);
  });
});
