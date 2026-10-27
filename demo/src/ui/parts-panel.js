import { escapeHtml, readNumber } from './dom.js';

export const GRAIN_OPTIONS = [
  { value: 'none', label: 'sin veta' },
  { value: 'length', label: 'veta en el alto' },
  { value: 'width', label: 'veta en el ancho' },
];

export function createEmptyPart(index = 1) {
  return {
    id: `P${index}`,
    label: `Nueva pieza ${index}`,
    width: 600,
    height: 720,
    qty: 1,
    grain: 'none',
    edges: 0,
    material: '',
  };
}

/**
 * Espesor de canto que muestra la tabla: el mayor de los lados (las piezas
 * importadas de Cortecloud traen canto por lado; la demo lo edita en un solo valor
 * que se aplica a los 4 lados).
 */
export function edgeThicknessOf(part) {
  if (typeof part.edges === 'number') return part.edges;
  const values = Object.values(part.edges ?? {}).filter((value) => typeof value === 'number' && value > 0);
  return values.length > 0 ? Math.max(...values) : 0;
}

function edgeSummary(part) {
  const texts = part.ref?.edgeTexts;
  if (!texts) return '';
  return Object.entries(texts)
    .filter(([, value]) => value)
    .map(([side, value]) => `${side}: ${value}`)
    .join(' · ');
}

function rowHtml(part, index) {
  const options = GRAIN_OPTIONS.map(
    (option) => `<option value="${option.value}"${part.grain === option.value ? ' selected' : ''}>${option.label}</option>`,
  ).join('');
  const summary = edgeSummary(part);
  const title = summary ? ` title="${escapeHtml(summary)}"` : '';

  return `<tr${title}>
    <td><input type="text" data-index="${index}" data-field="label" value="${escapeHtml(part.label)}" aria-label="Etiqueta ${index + 1}" /></td>
    <td><input type="number" min="1" step="1" data-index="${index}" data-field="width" value="${escapeHtml(part.width)}" aria-label="Ancho mm ${index + 1}" /></td>
    <td><input type="number" min="1" step="1" data-index="${index}" data-field="height" value="${escapeHtml(part.height)}" aria-label="Alto mm ${index + 1}" /></td>
    <td><input type="number" min="1" step="1" data-index="${index}" data-field="qty" value="${escapeHtml(part.qty)}" aria-label="Cantidad ${index + 1}" /></td>
    <td><select data-index="${index}" data-field="grain" aria-label="Veta ${index + 1}">${options}</select></td>
    <td><input type="number" min="0" step="0.1" data-index="${index}" data-field="edgeMm" value="${escapeHtml(edgeThicknessOf(part))}" aria-label="Canto mm ${index + 1}" /></td>
    <td><input type="text" data-index="${index}" data-field="material" value="${escapeHtml(part.material ?? '')}" aria-label="Material ${index + 1}" /></td>
    <td><button type="button" class="btn btn--icon" data-action="remove" data-index="${index}" aria-label="Quitar pieza ${index + 1}">✕</button></td>
  </tr>`;
}

export function createPartsPanel({ state, onChange, onLoadExample }) {
  const section = document.createElement('section');
  section.className = 'panel';
  section.innerHTML = `
    <header class="panel__head">
      <h2>1 · Piezas <span class="muted">(parts)</span></h2>
      <div class="panel__actions">
        <button type="button" class="btn btn--ghost" data-action="example">Cargar fixture Cortecloud</button>
        <button type="button" class="btn" data-action="add">+ Pieza</button>
      </div>
    </header>
    <div class="table-wrap">
      <table class="grid">
        <thead>
          <tr>
            <th>Etiqueta</th>
            <th>Ancho mm</th>
            <th>Alto mm</th>
            <th>Cant.</th>
            <th>Veta</th>
            <th>Canto mm</th>
            <th>Material</th>
            <th></th>
          </tr>
        </thead>
        <tbody data-role="rows"></tbody>
      </table>
    </div>
    <p class="hint">Medidas de corte en mm. El canto se aplica a los 4 lados (aproximación, por revisar).</p>
    <p class="note" data-role="notice" hidden></p>
  `;

  const tbody = section.querySelector('[data-role="rows"]');
  const notice = section.querySelector('[data-role="notice"]');

  function render() {
    tbody.innerHTML = state.parts.map(rowHtml).join('');
  }

  function setNotice(text) {
    if (!text) {
      notice.hidden = true;
      notice.textContent = '';
      return;
    }
    notice.hidden = false;
    notice.textContent = text;
  }

  section.addEventListener('input', (event) => {
    const input = event.target;
    if (!input.dataset?.field) return;
    const part = state.parts[Number(input.dataset.index)];
    if (!part) return;
    const { field } = input.dataset;
    if (field === 'grain') part.grain = input.value;
    else if (field === 'label' || field === 'material') part[field] = input.value;
    else if (field === 'edgeMm') part.edges = readNumber(input); // el motor lo aplica a los 4 lados
    else part[field] = readNumber(input);
    onChange();
  });

  section.addEventListener('click', (event) => {
    const button = event.target.closest?.('button[data-action]');
    if (!button) return;
    const { action } = button.dataset;
    if (action === 'add') {
      state.parts.push(createEmptyPart(state.parts.length + 1));
      render();
      onChange();
    }
    if (action === 'remove') {
      state.parts.splice(Number(button.dataset.index), 1);
      render();
      onChange();
    }
    if (action === 'example') onLoadExample();
  });

  return { element: section, render, setNotice };
}
