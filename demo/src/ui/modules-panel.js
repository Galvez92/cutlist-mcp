/**
 * Panel de módulos paramétricos: cajonera, clóset, cocina y librero.
 *
 * Genera el despiece del módulo (medidas reales de ARAUCO) y lo pasa al
 * optimizador como lista de piezas. Los parámetros salen del registro del
 * motor (`MODULOS`), así que el panel es data-driven: al cambiar el tipo se
 * redibujan los campos con su valor por omisión y su descripción.
 */

import { escapeHtml, readNumber } from './dom.js';
import { moduleTypes, moduleFields, buildModule } from '../engine/modules.js';

function fieldHtml(f) {
  const desc = escapeHtml(f.descripcion);
  if (f.tipo === 'bool') {
    const checked = f.default ? ' checked' : '';
    return `<label class="field field--bool"><input type="checkbox" data-name="${f.nombre}"${checked}/> <span>${f.nombre} <small>${desc}</small></span></label>`;
  }
  if (f.tipo === 'lista') {
    const val = f.default ? JSON.stringify(f.default) : '';
    return `<label class="field">${f.nombre} <small>${desc}</small><input type="text" data-name="${f.nombre}" value="${escapeHtml(val)}" placeholder="JSON, ej. [500,1000]"/></label>`;
  }
  if (f.tipo === 'texto') {
    return `<label class="field">${f.nombre} <small>${desc}</small><input type="text" data-name="${f.nombre}" value="${escapeHtml(f.default ?? '')}"/></label>`;
  }
  // float, int, float_opcional
  return `<label class="field">${f.nombre} <small>${desc}</small><input type="number" step="any" data-name="${f.nombre}" value="${escapeHtml(f.default ?? '')}"/></label>`;
}

export function createModulesPanel({ onGenerated }) {
  const section = document.createElement('section');
  section.className = 'panel panel--modules';
  section.innerHTML = `
    <header class="panel__head">
      <h2>Módulos paramétricos <span class="muted">(cajonera · clóset · cocina · librero)</span></h2>
    </header>
    <div class="modules">
      <label class="modules__type">Tipo de módulo
        <select data-role="module-type"></select>
      </label>
      <div class="modules__fields" data-role="fields"></div>
      <button type="button" class="btn" data-action="generate">Generar piezas del módulo</button>
      <p class="note" data-role="module-notice" hidden></p>
      <p class="hint">Genera el despiece (medidas reales de ARAUCO) y lo pasa al optimizador. El reparto de cantos a lados del motor está <em>por revisar</em> (docs/modulos-parametricos.md).</p>
    </div>
  `;

  const typeSelect = section.querySelector('[data-role="module-type"]');
  const fieldsBox = section.querySelector('[data-role="fields"]');
  const notice = section.querySelector('[data-role="module-notice"]');

  const types = moduleTypes();
  typeSelect.innerHTML = types
    .map((t) => `<option value="${t.tipo}">${escapeHtml(t.titulo)}</option>`)
    .join('');

  function renderFields(tipo) {
    fieldsBox.innerHTML = moduleFields(tipo).map(fieldHtml).join('');
  }

  function readValues() {
    const valores = {};
    const fields = moduleFields(typeSelect.value);
    fieldsBox.querySelectorAll('[data-name]').forEach((el) => {
      const name = el.dataset.name;
      const field = fields.find((c) => c.nombre === name);
      if (el.type === 'checkbox') {
        valores[name] = el.checked;
      } else if (field?.tipo === 'lista') {
        valores[name] = el.value.trim() === '' ? null : el.value;
      } else if (field?.tipo === 'float_opcional') {
        valores[name] = el.value.trim() === '' ? null : readNumber(el);
      } else if (field?.tipo === 'texto') {
        valores[name] = el.value;
      } else {
        valores[name] = readNumber(el);
      }
    });
    return valores;
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

  typeSelect.addEventListener('change', () => renderFields(typeSelect.value));

  section.addEventListener('click', (event) => {
    const button = event.target.closest?.('button[data-action="generate"]');
    if (!button) return;
    try {
      const result = buildModule(typeSelect.value, readValues());
      onGenerated(result);
      setNotice(result.notice);
    } catch (error) {
      setNotice(`Error: ${error.message}`);
    }
  });

  renderFields(typeSelect.value);

  return { element: section };
}
