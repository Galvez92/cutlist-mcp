# cutlist-mcp

> **Estado / Status: en construcción (under construction)**

## Español
Optimizador de corte de tableros open-source, **independiente de Cortecloud**.

Alcance:
1. **Motor:** piezas (ancho, alto, cantidad, veta, canto) + tableros en stock (medidas, espesor, kerf) → layout optimizado (guillotina y no guillotina), % de aprovechamiento, lista de corte, etiquetas, PDF/SVG.
2. **Importadores/exportadores:** Cortecloud, Promob, CSV genérico, SketchUp/OpenCutList, Polyboard, Pro100, DXF. Formatos basados en documentación pública real; lo no verificado se marca *por revisar*.
3. **Servidor MCP:** para que el agente de cualquier usuario diseñe muebles a partir de medidas (módulos paramétricos: cajonera, clóset, cocina, librero → piezas → optimizar → exportar). Los generadores de módulos (medidas → piezas con cantos, con perfil de restricciones opcional) están documentados en [`docs/modulos-parametricos.md`](docs/modulos-parametricos.md).
4. **Demo web simple**, pruebas y documentación es/en.

Licencia MIT.

## English
Open-source panel cutting optimizer, **independent of Cortecloud**.

Scope:
1. **Engine:** parts (width, height, qty, grain, edge banding) + stock sheets (size, thickness, kerf) → optimized layout (guillotine and non-guillotine), yield %, cut list, labels, PDF/SVG.
2. **Importers/exporters:** Cortecloud, Promob, generic CSV, SketchUp/OpenCutList, Polyboard, Pro100, DXF. Formats based on real public docs; unverified items are marked *por revisar* (to be verified).
3. **MCP server:** lets any user's agent design furniture from measurements (parametric modules: drawer unit, closet, kitchen, bookcase → parts → optimize → export). The module generators (measurements → parts with edge banding, optional restriction profile) are documented in [`docs/modulos-parametricos.md`](docs/modulos-parametricos.md).
4. **Simple web demo**, tests and es/en docs.

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
