import { PROFILES, optimize } from '@core/index.js';
import { DEFAULT_KERF } from '@core/profile.js';
import { loadCortecloudExample } from './example.js';
import { createPartsPanel } from './ui/parts-panel.js';
import { createSheetPanel } from './ui/sheet-panel.js';
import { createResultPanel } from './ui/result-panel.js';
import { createDownloadPanel } from './ui/download-panel.js';

export function createApp(root) {
  const state = {
    parts: [],
    sheet: { name: '', width: '', height: '', thickness: '', kerf: DEFAULT_KERF, stock: '' },
    mode: 'guillotine',
    profileId: 'cortecloud-madijal',
    layout: null,
    error: null,
  };

  const head = document.createElement('header');
  head.className = 'app__head';
  head.innerHTML = `
    <h1>cutlist-mcp · demo del optimizador de corte</h1>
    <p>Piezas y tablero en stock → layout optimizado, aprovechamiento y descargas SVG en pantalla, PDF y CSV.
    La demo usa el motor de <code>core/</code>; los formatos externos sin verificar quedan marcados <em>por revisar</em>.</p>
  `;

  const grid = document.createElement('div');
  grid.className = 'app__grid';
  const inputsColumn = document.createElement('div');
  inputsColumn.className = 'col';
  const resultsColumn = document.createElement('div');
  resultsColumn.className = 'col';

  const partsPanel = createPartsPanel({ state, onChange: () => recompute(), onLoadExample: () => loadExample() });
  const sheetPanel = createSheetPanel({ state, onChange: () => recompute() });
  const resultPanel = createResultPanel({ state });
  const downloadPanel = createDownloadPanel({ state });

  inputsColumn.append(partsPanel.element, sheetPanel.element);
  resultsColumn.append(resultPanel.element, downloadPanel.element);
  grid.append(inputsColumn, resultsColumn);

  const footer = document.createElement('p');
  footer.className = 'footer';
  footer.innerHTML =
    'Motor: <code>core/src</code> · Formatos externos por revisar: <code>docs/por-revisar.md</code> · Licencia MIT';

  root.append(head, grid, footer);

  function recompute() {
    try {
      state.layout = optimize({
        parts: state.parts,
        sheets: [{ ...state.sheet }],
        kerf: state.sheet.kerf,
        mode: state.mode,
        profile: PROFILES[state.profileId] ?? null,
      });
      state.error = null;
    } catch (error) {
      state.layout = null;
      state.error = Array.isArray(error.issues) ? error.issues.join(' · ') : error.message;
    }
    resultPanel.update();
    downloadPanel.update();
  }

  function loadExample() {
    const example = loadCortecloudExample();
    state.parts = example.parts;
    state.sheet = { ...example.sheet, kerf: DEFAULT_KERF, stock: '' };
    partsPanel.render();
    partsPanel.setNotice(example.notice);
    sheetPanel.sync();
    recompute();
  }

  partsPanel.render();
  sheetPanel.sync();
  loadExample();

  return state;
}
