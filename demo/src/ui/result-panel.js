import { renderLayoutSvg } from '@engine';
import { escapeHtml } from './dom.js';

const round = (value) => Math.round(value * 100) / 100;

function chip(label, value) {
  return `<li class="chip">${escapeHtml(label)}: <strong data-role="${value.role}">${escapeHtml(value.text)}</strong></li>`;
}

export function createResultPanel({ state }) {
  const section = document.createElement('section');
  section.className = 'panel panel--result';
  section.innerHTML = `
    <header class="panel__head">
      <h2>3 · Layout <span class="muted">(se recalcula al editar)</span></h2>
    </header>
    <p class="error" data-role="error" hidden></p>
    <ul class="chips" data-role="stats"></ul>
    <div class="layout" data-role="layout" aria-live="polite"></div>
    <div class="lists" data-role="lists"></div>
  `;

  const error = section.querySelector('[data-role="error"]');
  const stats = section.querySelector('[data-role="stats"]');
  const layout = section.querySelector('[data-role="layout"]');
  const lists = section.querySelector('[data-role="lists"]');

  function update() {
    const { layout: result, error: message } = state;

    error.hidden = !message;
    error.textContent = message ?? '';

    if (!result) {
      stats.innerHTML = '';
      layout.innerHTML = '<p class="muted">Sin layout</p>';
      lists.innerHTML = '';
      return;
    }

    stats.innerHTML = [
      chip('Tableros', { role: 'stat-sheets', text: result.metrics.sheetsUsed }),
      chip('Aprovechamiento', { role: 'stat-yield', text: `${result.metrics.yieldPct}%` }),
      chip('Piezas', { role: 'stat-pieces', text: `${result.metrics.placed}/${result.metrics.partInstances}` }),
      chip('Sobrante', { role: 'stat-waste', text: `${round(result.metrics.wasteArea / 1e6)} m²` }),
      chip('Kerf', { role: 'stat-kerf', text: `${state.sheet.kerf} mm` }),
      chip('Modo', { role: 'stat-mode', text: result.algorithm }),
    ].join('');

    layout.innerHTML = renderLayoutSvg(result);
    lists.innerHTML = renderLists(result);
  }

  return { element: section, update };
}

function renderLists(result) {
  const blocks = [];

  if (result.unplaced.length) {
    blocks.push(`<div class="list" data-role="unplaced">
      <h3>Sin colocar (${result.unplaced.length})</h3>
      <ul>${result.unplaced
        .map((piece) => `<li>${escapeHtml(piece.label)} — ${escapeHtml(piece.detail)}</li>`)
        .join('')}</ul>
    </div>`);
  }

  if (result.issues.length) {
    blocks.push(`<div class="list" data-role="warnings">
      <h3>Por revisar · avisos del perfil (${result.issues.length})</h3>
      <ul>${result.issues.map((issue) => `<li>${escapeHtml(issue.message)}</li>`).join('')}</ul>
    </div>`);
  }

  return blocks.join('');
}
