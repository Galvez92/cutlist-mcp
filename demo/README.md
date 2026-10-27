# Demo web — cutlist-mcp

Demo mínima (Vite, sin frameworks de UI) del motor de corte: captura piezas y tablero,
muestra el layout en SVG y descarga PDF/CSV. Todo corre en el navegador; no hay backend
ni base de datos. El motor está en `../core/src` y se comparte por el alias `@core`.

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
tableros 3 · aprovechamiento 36.97 % · piezas 30/30 · sobrante 8.65 m²
```

**b) Piezas propias** (mismo tablero, kerf 4 mm): `Lateral 600×732 ×2` con canto 0.4 mm,
`Base 1173.5×600 ×1`, `Estante 900×250 ×3` con veta en el alto:

```
tableros 1 · aprovechamiento 49.34 % · piezas 6/6
Base @0,0 1173.5×600      Lateral @1177.5,0 732×600 (girada)
Lateral @0,604 600×732    Estante @604,604 900×250    Estante @1508,604 900×250
Estante @0,1340 900×250
```

La pieza con veta declarada nunca se gira; las piezas sin veta sí (`(girada)`), para
aprovechar mejor el tablero.

**c) Usar el motor desde código**

```js
import { optimize, renderLayoutSvg, cutListCsv } from '../core/src/index.js';
import { layoutToPdf } from '../core/src/pdf.js';

const layout = optimize({
  parts: [
    { label: 'Lateral', width: 600, height: 732, qty: 2, edges: 0.4 },
    { label: 'Estante', width: 900, height: 250, qty: 3, grain: 'length' },
  ],
  sheets: [{ name: 'MDF blanco 18 mm', width: 2500, height: 1830, thickness: 18, stock: null }],
  kerf: 4,
  mode: 'guillotine', // o 'maxrects'
});

layout.stats;            // { sheetsUsed, yieldPct, piecesPlaced, ... }
renderLayoutSvg(layout); // string SVG con todos los tableros
cutListCsv(layout);      // CSV (RFC 4180)
await layoutToPdf(layout); // Uint8Array de un PDF válido
```

**d) Importar un JSON de Cortecloud** (`{"parts": [...]}`)

```js
import { importCortecloud } from '../core/src/importers/cortecloud.js';
const { parts, sheets, notes, skipped } = importCortecloud(json, { swap: false });
```

`c` → alto y `l` → ancho (`swap: true` los intercambia), `quantity` → cantidad,
`function` → etiqueta, `material` → material y medida de tablero, `c1/c2/l1/l2` → canto por
lado, `machining` → pieza mecanizada. Todo eso está **por revisar** (ver `../docs/por-revisar.md`).

**e) Salida CSV real** (recorte del fixture, CRLF entre registros)

```csv
etiqueta,cantidad,ancho_mm,alto_mm,veta,material,canto_mm_total,mecanizada,tableros,area_m2
Cubierta izquierda (pasacables Ø35),1,600,1173.5,none,Roble Americano 2 C 18 mm 719L ARAUCO (2500x1830),2947,sí,1,0.7041
Pata costado exterior acento der (doble 36),1,600,732,none,Roble Americano 2 C 18 mm 719L ARAUCO (2500x1830),1332,no,1,0.4392
```

```csv
tablero,pieza,etiqueta,x_mm,y_mm,ancho_mm,alto_mm,girada,veta
1,C5#1,Cubierta izquierda (pasacables Ø35),0,0,600,1173.5,no,none
1,C1#1,Pata costado exterior acento der (doble 36),604,0,600,732,no,none
```

### Pruebas

```bash
npm test                       # Vitest: motor, importador, salidas y UI (jsdom)
# dentro del compose:
docker compose -f ../docker-compose.base44.yml exec -T web npm test
```

Cubren: validación de entrada, empaquetado (sin solapes, dentro del tablero, kerf, veta,
stock, determinismo), SVG (geometría y escapado), CSV (ida y vuelta según RFC 4180),
PDF (se vuelve a leer con `pdf-lib` y se comparan páginas y tamaños), importador
Cortecloud (fixture real) y la UI de la demo (carga, edición, descargas, errores).

### Decisiones de la demo

- **Kerf**: se aplica entre piezas; las piezas pueden tocar los bordes del tablero.
- **Modos**: `guillotine` (filas con cortes pasantes, para escuadradora) y `maxrects`
  (nesting libre, para CNC).
- **Un tablero a la vez**: el fixture trae piezas de dos materiales; la demo las coloca
  todas sobre el tablero del primer material y lo avisa en pantalla. Falta optimizar por
  material (pendiente).
- **Canto**: la demo aplica el mismo espesor a los 4 lados; el desglose por lado del
  fixture se conserva en el largo total de canto del CSV.

---

## English

Minimal web demo (Vite, no UI framework) for the cutting engine: capture parts and sheet
stock, see the optimized layout as SVG and download PDF/CSV. Everything runs in the
browser; there is no backend or database. The engine lives in `../core/src` and is shared
through the `@core` alias.

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

### Examples

**Real Cortecloud fixture** (21 groups / 30 pieces, 2500×1830×18 sheet, 4 mm kerf,
guillotine mode, Cortecloud/Madijal profile):

```
sheets 3 · yield 36.97 % · pieces 30/30 · waste 8.65 m²
```

**Your own parts** (same sheet, 4 mm kerf): `Lateral 600×732 ×2` with 0.4 mm edge banding,
`Base 1173.5×600 ×1`, `Estante 900×250 ×3` with length grain:

```
sheets 1 · yield 49.34 % · pieces 6/6
Base @0,0 1173.5×600   Lateral @1177.5,0 732×600 (rotated)
```

A piece with declared grain is never rotated; pieces without grain are (`(rotated)`), to
use the sheet better.

**Use the engine from code**

```js
import { optimize, renderLayoutSvg, cutListCsv } from '../core/src/index.js';
import { layoutToPdf } from '../core/src/pdf.js';

const layout = optimize({
  parts: [{ label: 'Lateral', width: 600, height: 732, qty: 2, edges: 0.4 }],
  sheets: [{ name: 'MDF white 18 mm', width: 2500, height: 1830, thickness: 18 }],
  kerf: 4,
  mode: 'guillotine', // or 'maxrects'
});
```

**Formats**: CSVs follow RFC 4180 (CRLF, double quotes, `text/csv`), the SVG viewBox is in
millimetres and the PDF is generated with `pdf-lib` at real sheet scale. The Cortecloud
importer is **por revisar** (to be verified): see `../docs/por-revisar.md`.

### Tests

```bash
npm test    # Vitest: engine, importer, exports and UI (jsdom)
```

---

## Notas técnicas / Technical notes

- `demo/aliases.js` define el alias `@core` → `../core/src` para Vite y para Vitest.
- `@core/pdf.js` no se reexporta desde `core/src/index.js` porque importa `pdf-lib`
  (dependencia declarada en `core/package.json`, instalada en la raíz del monorepo).
- El fixture real se importa directamente desde `../tests/fixtures/cortecloud/`, sin copias.
- Datos sin verificar y sus fuentes: [`../docs/por-revisar.md`](../docs/por-revisar.md).
