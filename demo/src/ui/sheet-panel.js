import { PROFILES } from '@engine';
import { MODES } from '../engine/constants.js';
import { readNumber } from './dom.js';

const MODE_OPTIONS = [
  { value: MODES.GUILLOTINE, label: 'guillotina (cortes pasantes)' },
  { value: MODES.MAXRECTS, label: 'maxrects (nesting libre)' },
];

export function createSheetPanel({ state, onChange }) {
  const section = document.createElement('section');
  section.className = 'panel';

  const modeOptions = MODE_OPTIONS.map(
    (option) => `<option value="${option.value}">${option.label}</option>`,
  ).join('');
  const profileOptions = [
    '<option value="none">sin perfil</option>',
    ...Object.entries(PROFILES).map(
      ([id, profile]) => `<option value="${id}">${profile.name}</option>`,
    ),
  ].join('');

  section.innerHTML = `
    <header class="panel__head">
      <h2>2 · Tablero en stock <span class="muted">(sheet)</span></h2>
    </header>
    <div class="fields">
      <div class="field">
        <label for="sheet-name">Material / nombre</label>
        <input id="sheet-name" type="text" data-field="name" />
      </div>
      <div class="field">
        <label for="sheet-width">Ancho mm</label>
        <input id="sheet-width" type="number" min="1" step="1" data-field="width" />
      </div>
      <div class="field">
        <label for="sheet-height">Alto mm</label>
        <input id="sheet-height" type="number" min="1" step="1" data-field="height" />
      </div>
      <div class="field">
        <label for="sheet-thickness">Espesor mm</label>
        <input id="sheet-thickness" type="number" min="1" step="0.1" data-field="thickness" />
      </div>
      <div class="field">
        <label for="sheet-kerf">Kerf mm</label>
        <input id="sheet-kerf" type="number" min="0" step="0.1" data-field="kerf" />
      </div>
      <div class="field">
        <label for="sheet-stock">Tableros disponibles</label>
        <input id="sheet-stock" type="number" min="1" step="1" data-field="stock" placeholder="vacío = ilimitado" />
      </div>
      <div class="field">
        <label for="mode">Modo de corte</label>
        <select id="mode" data-field="mode">${modeOptions}</select>
      </div>
      <div class="field">
        <label for="profile">Perfil de restricciones</label>
        <select id="profile" data-field="profile">${profileOptions}</select>
      </div>
    </div>
    <p class="hint">El kerf es tu disco de corte: valor de partida ${state.sheet.kerf} mm (ajústalo a tu máquina, por revisar).</p>
  `;

  const inputs = {
    name: section.querySelector('#sheet-name'),
    width: section.querySelector('#sheet-width'),
    height: section.querySelector('#sheet-height'),
    thickness: section.querySelector('#sheet-thickness'),
    kerf: section.querySelector('#sheet-kerf'),
    stock: section.querySelector('#sheet-stock'),
    mode: section.querySelector('#mode'),
    profile: section.querySelector('#profile'),
  };

  function sync() {
    inputs.name.value = state.sheet.name ?? '';
    inputs.width.value = state.sheet.width ?? '';
    inputs.height.value = state.sheet.height ?? '';
    inputs.thickness.value = state.sheet.thickness ?? '';
    inputs.kerf.value = state.sheet.kerf ?? '';
    inputs.stock.value = state.sheet.stock ?? '';
    inputs.mode.value = state.mode;
    inputs.profile.value = state.profileId;
  }

  section.addEventListener('input', (event) => {
    const { field } = event.target.dataset ?? {};
    if (!field) return;
    if (field === 'name') state.sheet.name = event.target.value;
    else if (field === 'mode') state.mode = event.target.value;
    else if (field === 'profile') state.profileId = event.target.value;
    else state.sheet[field] = readNumber(event.target);
    onChange();
  });

  return { element: section, sync };
}
