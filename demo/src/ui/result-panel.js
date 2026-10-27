import { renderLayoutSvg } from '@core/index.js';
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
      layout.innerHTML = renderLayoutSvg(null);
      lists.innerHTML = '';
      return;
    }

    stats.innerHTML = [
      chip('Tableros', { role: 'stat-sheets', text: result.stats.sheetsUsed }),
      chip('Aprovechamiento', { role: 'stat-yield', text: `${result.stats.yieldPct}%` }),
      chip('Piezas', { role: 'stat-pieces', text: `${result.stats.piecesPlaced}/${result.stats.piecesRequested}` }),
      chip('Sobrante', { role: 'stat-waste', text: `${round(result.stats.wasteArea / 1e6)} m²` }),
      chip('Kerf', { role: 'stat-kerf', text: `${result.kerf} mm` }),
      chip('Modo', { role: 'stat-mode', text: result.mode }),
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
        .map((piece) => `<li>${escapeHtml(piece.label)} ${round(piece.width)}×${round(piece.height)} mm — ${escapeHtml(piece.reason)}</li>`)
        .join('')}</ul>
    </div>`);
  }

  if (result.warnings.length) {
    blocks.push(`<div class="list" data-role="warnings">
      <h3>Por revisar · avisos del perfil (${result.warnings.length})</h3>
      <ul>${result.warnings.map((warning) => `<li>${escapeHtml(warning)}</li>`).join('')}</ul>
    </div>`);
  }

  return blocks.join('');
}
