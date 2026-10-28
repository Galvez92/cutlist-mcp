import { escapeHtml } from './dom.js';
import { downloadCutListCsv, downloadPdf, downloadPlacementsCsv } from '../exports.js';

export function createDownloadPanel({ state }) {
  const section = document.createElement('section');
  section.className = 'panel';

  section.innerHTML = `
    <header class="panel__head">
      <h2>4 · Descargas <span class="muted">(exports)</span></h2>
    </header>
    <div class="downloads">
      <button type="button" class="btn" data-action="pdf">Descargar PDF</button>
      <button type="button" class="btn btn--ghost" data-action="csv-cutlist">CSV lista de corte</button>
      <button type="button" class="btn btn--ghost" data-action="csv-placements">CSV posiciones</button>
    </div>
    <p class="hint">PDF: una página por tablero a escala 1:1 más la lista de corte. CSV según RFC 4180 (CRLF, comillas dobles).</p>
    <p class="error" data-role="error" hidden></p>
  `;

  const error = section.querySelector('[data-role="error"]');
  const buttons = [...section.querySelectorAll('button[data-action]')];

  section.addEventListener('click', async (event) => {
    const button = event.target.closest?.('button[data-action]');
    if (!button || button.disabled) return;
    error.hidden = true;
    try {
      if (button.dataset.action === 'pdf') await downloadPdf(state.layout);
      if (button.dataset.action === 'csv-cutlist') downloadCutListCsv(state.layout);
      if (button.dataset.action === 'csv-placements') downloadPlacementsCsv(state.layout);
    } catch (cause) {
      error.hidden = false;
      error.textContent = `No se pudo generar la descarga: ${cause.message}`;
    }
  });

  function update() {
    const ready = Boolean(state.layout);
    buttons.forEach((button) => {
      button.disabled = !ready;
    });
    if (!ready) {
      error.hidden = true;
      error.textContent = '';
    }
  }

  return { element: section, update, description: () => escapeHtml('') };
}
