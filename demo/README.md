# Demo web — cutlist-mcp

Demo mínima (Vite, sin frameworks de UI) del motor de corte: captura piezas y tablero,
muestra el layout en SVG y descarga PDF/CSV. Todo corre en el navegador; no hay backend
ni base de datos. El motor está en `../src` (TypeScript, rama `optimizer-engine`, PR #4)
y se comparte por el alias `@engine`.

---

## Español

### Arrancar

```bash
# entorno de desarrollo (recomendado, monta el repo y recarga en vivo)
docker compose -f ../docker-compose.base44.yml up -d      # http://localhost:3000

# o local, con el monorepo instalado (npm workspaces en la raíz)
npm install && npm run dev                                # http://localhost:5173
```

### Uso

1. **Piezas**: etiqueta, ancho, alto, cantidad, veta y canto (mm). `+ Pieza` agrega una fila,
   `Cargar fixture Cortecloud` trae el ejemplo real de `../tests/fixtures/cortecloud/`.
2. **Tablero en stock**: medida, espesor, kerf, cantidad disponible (vacío = ilimitado),
   modo de corte y perfil de restricciones.
3. **Layout**: se recalcula al editar cualquier campo; muestra tableros usados,
   aprovechamiento, piezas colocadas, sobrante y los avisos del perfil.
4. **Descargas**: PDF (una página por tablero a escala 1:1 + lista de corte) y dos CSV
   (lista de corte agrupada y posiciones pieza por pieza).

### Ejemplos

**a) Fixture real de Cortecloud** (21 grupos / 30 piezas, tablero 2500×1830×18, kerf 4 mm,
modo guillotina, perfil Cortecloud/Madijal):

```
tableros 2 · aprovechamiento 55.4 % · piezas 30/30
```

**b) Usar el motor desde código**

```js
import { optimize, renderLayoutSvg, renderLayoutPdf } from '../src/index.js';

const layout = optimize({
  parts: [
    { label: 'Lateral', width: 600, height: 732, qty: 2, edges: { top: 0.4, left: 0.4 } },
    { label: 'Estante', width: 900, height: 250, qty: 3, grain: 'vertical' },
  ],
  sheets: [{ label: 'MDF blanco 18 mm', width: 2500, height: 1830, thickness: 18 }],
  algorithm: 'auto', // o 'guillotine' o 'maxrects'
  kerf: 4,
});

layout.metrics;              // { sheetsUsed, yieldPct, placed, partInstances, ... }
renderLayoutSvg(layout);      // string SVG con todos los tableros
renderLayoutPdf(layout);      // Uint8Array de un PDF válido (sync, sin dependencias)
```

**c) Importar un JSON de Cortecloud** (`{"parts": [...]}`)

```js
import { importCortecloud } from './src/engine/cortecloud.js';
const { parts, sheets, notes, skipped } = importCortecloud(json, { swap: false });
```

`c` → alto y `l` → ancho (`swap: true` los intercambia), `quantity` → cantidad,
`function` → etiqueta, `material` → material y medida de tablero, `c1/c2/l1/l2` → canto por
lado, `machining` → pieza mecanizada. Todo eso está **por revisar** (ver `../docs/por-revisar.md`).

**d) Exportar CSV** (capa del demo, no del motor)

```js
import { cutListCsv, placementsCsv } from './src/engine/csv.js';
cutListCsv(layout);      // CSV de lista de corte (RFC 4180)
placementsCsv(layout);   // CSV de posiciones pieza por pieza
```

### Pruebas

```bash
npm test                       # Vitest: motor (tests/) + demo (demo/tests/)
# dentro del compose:
docker compose -f ../docker-compose.base44.yml exec -T web npm test
```

### Decisiones de la demo

- **Motor**: `src/` (TypeScript, optimizer-engine PR #4) es la única fuente del motor.
  La demo no duplica el motor; los adaptadores del demo viven en `demo/src/engine/`.
- **Kerf**: se aplica entre piezas; las piezas pueden tocar los bordes del tablero.
- **Modos**: `guillotine` (filas con cortes pasantes, para escuadradora) y `maxrects`
  (nesting libre, para CNC). `auto` prueba ambos y devuelve el mejor.
- **Un tablero a la vez**: el fixture trae piezas de dos materiales; la demo las coloca
  todas sobre el tablero del primer material y lo avisa en pantalla. Falta optimizar por
  material (pendiente).
- **Canto**: la demo aplica el mismo espesor a los 4 lados; el desglose por lado del
  fixture se conserva en el importador.

---

## English

Minimal web demo (Vite, no UI framework) for the cutting engine: capture parts and sheet
stock, see the optimized layout as SVG and download PDF/CSV. Everything runs in the
browser; there is no backend or database. The engine lives in `../src` (TypeScript,
`optimizer-engine` branch, PR #4) and is shared through the `@engine` alias.

### Run it

```bash
docker compose -f ../docker-compose.base44.yml up -d   # http://localhost:3000
npm install && npm run dev                             # http://localhost:5173
```

### How it works

1. **Parts**: label, width, height, quantity, grain and edge banding (mm).
   `Cargar fixture Cortecloud` loads the real sample in `../tests/fixtures/cortecloud/`.
2. **Sheet stock**: size, thickness, kerf, available count (empty = unlimited), cutting
   mode and constraint profile.
3. **Layout**: recalculated on every edit; shows sheets used, yield, pieces placed, waste
   and profile warnings.
4. **Downloads**: PDF (one page per sheet at 1:1 scale plus the cut list) and two CSVs
   (grouped cut list and per-piece positions).

### Tests

```bash
npm test    # Vitest: engine (tests/) + demo (demo/tests/)
```

---

## Notas técnicas / Technical notes

- `demo/aliases.js` define el alias `@engine` → `../src` para Vite; `vitest.config.ts` en la
  raíz hace lo mismo para Vitest.
- El motor (`src/`) no tiene dependencias de ejecución; el PDF se genera con un escritor
  propio (`src/render/pdf-writer.ts`). `pdf-lib` es solo para los tests.
- Adaptadores del demo (no incluidos en el motor): `demo/src/engine/cortecloud.js`
  (importador), `demo/src/engine/csv.js` (CSV), `demo/src/engine/adapt.js` (estado→motor),
  `demo/src/engine/constants.js` (MODES, DEFAULT_KERF).
- El fixture real se importa directamente desde `../tests/fixtures/cortecloud/`, sin copias.
- Datos sin verificar y sus fuentes: [`../docs/por-revisar.md`](../docs/por-revisar.md).
