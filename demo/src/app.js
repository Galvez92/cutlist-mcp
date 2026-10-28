import { PROFILES, optimize } from '@engine';
import { DEFAULT_KERF, MODES } from './engine/constants.js';
import { partsForEngine, profileForEngine, sheetForEngine } from './engine/adapt.js';
import { loadCortecloudExample } from './example.js';
import { createModulesPanel } from './ui/modules-panel.js';
import { createPartsPanel } from './ui/parts-panel.js';
import { createSheetPanel } from './ui/sheet-panel.js';
import { createResultPanel } from './ui/result-panel.js';
import { createDownloadPanel } from './ui/download-panel.js';

export function createApp(root) {
  const state = {
    parts: [],
    sheet: { name: '', width: '', height: '', thickness: '', kerf: DEFAULT_KERF, stock: '' },
    mode: MODES.GUILLOTINE,
    profileId: 'cortecloud-madijal',
    layout: null,
    error: null,
  };

  const head = document.createElement('header');
  head.className = 'app__head';
  head.innerHTML = `
    <h1>cutlist-mcp · demo del optimizador de corte</h1>
    <p>Piezas y tablero en stock → layout optimizado, aprovechamiento y descargas SVG en pantalla, PDF y CSV.
    Genera el despiece de un módulo paramétrico (cajonera, clóset, cocina, librero) o carga el
    ejemplo real del escritorio compacto (fixture de Cortecloud).
    La demo usa el motor de <code>optimizer-engine</code> (PR&nbsp;4) y los módulos de
    <code>parametric-modules</code>; lo no verificado queda marcado <em>por revisar</em>.</p>
  `;

  const grid = document.createElement('div');
  grid.className = 'app__grid';
  const inputsColumn = document.createElement('div');
  inputsColumn.className = 'col';
  const resultsColumn = document.createElement('div');
  resultsColumn.className = 'col';

  const partsPanel = createPartsPanel({ state, onChange: () => recompute(), onLoadExample: () => loadExample() });
  const sheetPanel = createSheetPanel({ state, onChange: () => recompute() });
  const modulesPanel = createModulesPanel({ state, onGenerated: (result) => loadModule(result) });
  const resultPanel = createResultPanel({ state });
  const downloadPanel = createDownloadPanel({ state });

  inputsColumn.append(modulesPanel.element, partsPanel.element, sheetPanel.element);
  resultsColumn.append(resultPanel.element, downloadPanel.element);
  grid.append(inputsColumn, resultsColumn);

  const footer = document.createElement('p');
  footer.className = 'footer';
  footer.innerHTML =
    'Motor: <code>src/</code> (optimizer-engine, PR&nbsp;4) · Formatos externos por revisar: <code>docs/por-revisar.md</code> · Licencia MIT';

  root.append(head, grid, footer);

  function recompute() {
    try {
      state.layout = optimize({
        parts: partsForEngine(state.parts),
        sheets: [sheetForEngine(state.sheet)],
        algorithm: state.mode,
        profile: profileForEngine(state.profileId),
      });
      state.error = null;
    } catch (error) {
      state.layout = null;
      state.error = error.message;
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

  function loadModule(result) {
    state.parts = result.parts;
    state.sheet = { ...result.sheet, kerf: DEFAULT_KERF, stock: '' };
    partsPanel.render();
    partsPanel.setNotice(null);
    sheetPanel.sync();
    recompute();
  }

  partsPanel.render();
  sheetPanel.sync();
  loadExample();

  return state;
}
