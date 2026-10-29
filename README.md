# cutlist-mcp

> **Estado / Status: en construcción (under construction)**

## Español
Optimizador de corte de tableros open-source, **independiente de Cortecloud**.

Alcance:
1. **Motor:** piezas (ancho, alto, cantidad, veta, canto) + tableros en stock (medidas, espesor, kerf) → layout optimizado (guillotina y no guillotina), % de aprovechamiento, lista de corte, etiquetas, PDF/SVG.
2. **Importadores/exportadores:** Cortecloud, Promob, CSV genérico, SketchUp/OpenCutList, Polyboard, Pro100, DXF. Formatos basados en documentación pública real; lo no verificado se marca *por revisar*.
3. **Servidor MCP:** para que el agente de cualquier usuario diseñe muebles a partir de medidas (módulos paramétricos: cajonera, clóset, cocina, librero → piezas → optimizar → exportar). Los generadores de módulos (medidas → piezas con cantos, con perfil de restricciones opcional) están documentados en [`docs/modulos-parametricos.md`](docs/modulos-parametricos.md). Instalación del servidor MCP y estado de cada formato: [`docs/mcp-server.md`](docs/mcp-server.md).
4. **Demo web simple**, pruebas y documentación es/en.

### Formatos (rama `formatos-import-export`)

| Formato | Clave | Dirección | Estado |
|---|---|---|---|
| Cortecloud (JSON) | `cortecloud` | importar + exportar | parcial |
| CSV genérico (propio) | `csv_generico` | importar + exportar | verificado |
| SketchUp / OpenCutList (CSV) | `opencutlist` | importar + exportar | parcial |
| PolyBoard (lista de corte) | `polyboard` | sólo importar | parcial |
| Promob (listado TXT/CSV) | `promob` | sólo importar | por revisar |
| PRO100 (listado TXT/CSV) | `pro100` | sólo importar | por revisar |
| DXF (ASCII R12) | `dxf` | importar + exportar | parcial |

```ts
import { importarArchivo, importar, exportar } from "./src/formats/index.js";

const lista = importarArchivo("proyecto.json");          // Cortecloud (deduce por extensión)
const lista2 = importar(texto, "promob", {
  columnas: ["nombre", "cantidad", "largo", "ancho", "espesor"],
});
console.log(lista.totalPiezas, lista.areaTotalM2);
for (const aviso of lista.porRevisar()) {                // lo no verificado, con su fuente
  console.log(aviso.mensaje, aviso.fuente);
}
```

Cada formato declara su estado y sus fuentes públicas; lo que no se pudo verificar
se marca **por revisar** con enlace. Ver `docs/formatos/`.

Pruebas (TypeScript, sin dependencias de ejecución): `docker compose -f docker-compose.base44.yml exec -T web npm test` (59 pruebas `vitest`), o `npx vitest run` sobre Node. Tipos: `npm run typecheck`.

Licencia MIT.

## English
Open-source panel cutting optimizer, **independent of Cortecloud**.

Scope:
1. **Engine:** parts (width, height, qty, grain, edge banding) + stock sheets (size, thickness, kerf) → optimized layout (guillotine and non-guillotine), yield %, cut list, labels, PDF/SVG.
2. **Importers/exporters:** Cortecloud, Promob, generic CSV, SketchUp/OpenCutList, Polyboard, Pro100, DXF. Formats based on real public docs; unverified items are marked *por revisar* (to be verified).
3. **MCP server:** lets any user's agent design furniture from measurements (parametric modules: drawer unit, closet, kitchen, bookcase → parts → optimize → export). The module generators (measurements → parts with edge banding, optional restriction profile) are documented in [`docs/modulos-parametricos.md`](docs/modulos-parametricos.md). MCP server setup and per-format status: [`docs/mcp-server.md`](docs/mcp-server.md).
4. **Simple web demo**, tests and es/en docs.

### Formats (branch `formatos-import-export`)

`src/formats/` ships importers/exporters for Cortecloud (JSON, import+export),
our own generic CSV (import+export), SketchUp/OpenCutList CSV (import+export),
PolyBoard, Promob and PRO100 cut lists (import only), and DXF R12 (layout export +
rectangle reading), built on the engine types in `src/types.ts` (branch
`optimizer-engine`). Each format declares its verification status and its public
sources; anything that could not be verified is flagged **por revisar** (to be
verified) with a link — see `docs/formatos/`. TypeScript, Node standard library
only, no runtime dependencies; tests run with
`docker compose -f docker-compose.base44.yml exec -T web npm test`.

MIT licensed.

## Demo web

Demo mínima (Vite) del motor: piezas y tablero en stock → layout SVG, PDF y CSV. Genera el
despiece de un **módulo paramétrico** (cajonera, clóset, cocina, librero) o carga el ejemplo
real del **escritorio compacto** (fixture de Cortecloud). Guía, ejemplos y pruebas en
[`demo/README.md`](demo/README.md); el motor está en [`src/`](src/) (rama `optimizer-engine`),
los módulos en [`src/modules/`](src/modules/) y lo no verificado en
[`docs/por-revisar.md`](docs/por-revisar.md) y [`docs/modulos-parametricos.md`](docs/modulos-parametricos.md).

```bash
docker compose -f docker-compose.base44.yml up -d   # http://localhost:3000
npm install && npm test
```

Minimal Vite demo of the engine: parts plus sheet stock → SVG layout, PDF and CSV. Generate the
cut list of a **parametric module** (drawer unit, closet, kitchen, bookcase) or load the real
**compact desk** example (Cortecloud fixture). See [`demo/README.md`](demo/README.md) for usage,
examples and tests; the engine lives in [`src/`](src/) (`optimizer-engine` branch), modules in
[`src/modules/`](src/modules/), and unverified items in
[`docs/por-revisar.md`](docs/por-revisar.md) and [`docs/modulos-parametricos.md`](docs/modulos-parametricos.md).
