# core — motor de corte

Motor mínimo de optimización de corte de tableros: piezas + tableros en stock → layout,
estadísticas, lista de corte, SVG, CSV y PDF.

> Este `core` es el mínimo que la demo web necesita para funcionar. La tarea
> `docs/memoria/tareas/motor-optimizador.md` (rama `motor-optimizador`) es la dueña del
> motor completo: perfiles de restricciones, más algoritmos y validaciones. La interfaz de
> `optimize()` está pensada para que ese trabajo la extienda sin romper la demo.

## API

```js
import { optimize, renderLayoutSvg, cutListCsv, placementsCsv, importCortecloud } from './src/index.js';
import { layoutToPdf } from './src/pdf.js'; // aparte: usa pdf-lib
```

### Entrada de `optimize()`

```js
{
  parts: [{
    id, label,              // identificadores; label aparece en el layout y el CSV
    width, height,          // medidas de corte en mm
    qty,                    // unidades (entero ≥ 1)
    grain,                  // 'none' (puede girar) | 'length' | 'width'
    edges,                  // canto en mm: número (4 lados) u objeto {top,right,bottom,left}
    material, machined,     // informativos (material va al CSV; machined al perfil)
  }],
  sheets: [{ name, width, height, thickness, stock }], // stock: null = ilimitado
  kerf,                     // mm entre piezas (por defecto 0)
  mode,                     // 'guillotine' (por defecto) | 'maxrects'
  profile,                  // PROFILES['cortecloud-madijal'] o null (solo avisos)
}
```

Los valores inválidos lanzan `InputError` con la lista completa en `error.issues`.

### Salida

`{ mode, kerf, profile, parts, stock, sheets, stats, cutList, unplaced, warnings }`
— ver `src/optimize.js`. Cada tablero trae `placements` (x, y, ancho, alto, `rotated`,
`labelText`) y `stats` (`pieces`, `usedArea`, `wasteArea`, `yieldPct`).

### Semántica

- **Kerf**: se aplica entre piezas (cada pieza reserva `kerf` mm a su derecha y abajo);
  las piezas pueden tocar los bordes del tablero.
- **Veta**: `length`/`width` fijan la orientación; solo `none` permite girar.
- **Stock**: se abren tableros en el orden declarado y solo si la pieza cabe en esa medida;
  si no hay stock, la pieza va a `unplaced` con el motivo.
- **Modos**: `guillotine` = filas separadas por cortes pasantes (escuadradora);
  `maxrects` = lista de rectángulos libres, nesting más denso.
- **Perfiles**: `PROFILES` en `src/profile.js`; son avisos (`warnings`), nunca cambian la
  colocación. El perfil Cortecloud/Madijal son observaciones de uso real (**por revisar**).

### Salidas

| Módulo | Salida |
| --- | --- |
| `src/svg.js` | SVG con `viewBox` en mm, un grupo por tablero |
| `src/csv.js` | lista de corte y posiciones, RFC 4180 (CRLF, comillas dobles) |
| `src/pdf.js` | PDF con `pdf-lib`: página resumen + una página por tablero a escala 1:1 |

## Pruebas

Las pruebas viven en `../demo/tests` y se ejecutan con Vitest desde la raíz del monorepo:

```bash
npm test
docker compose -f docker-compose.base44.yml exec -T web npm test
```
