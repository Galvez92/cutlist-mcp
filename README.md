# cutlist-mcp

> **Estado / Status: en construcción (under construction)**

## Español
Optimizador de corte de tableros open-source, **independiente de Cortecloud**.

Alcance:
1. **Motor:** piezas (ancho, alto, cantidad, veta, canto) + tableros en stock (medidas, espesor, kerf) → layout optimizado (guillotina y no guillotina), % de aprovechamiento, lista de corte, etiquetas, PDF/SVG.
2. **Importadores/exportadores:** Cortecloud, Promob, CSV genérico, SketchUp/OpenCutList, Polyboard, Pro100, DXF. Formatos basados en documentación pública real; lo no verificado se marca *por revisar*.
3. **Servidor MCP:** para que el agente de cualquier usuario diseñe muebles a partir de medidas (módulos paramétricos: cajonera, clóset, cocina, librero → piezas → optimizar → exportar). Instalación y estado de cada formato: [`docs/mcp-server.md`](docs/mcp-server.md).
4. **Demo web simple**, pruebas y documentación es/en.

Licencia MIT.

## English
Open-source panel cutting optimizer, **independent of Cortecloud**.

Scope:
1. **Engine:** parts (width, height, qty, grain, edge banding) + stock sheets (size, thickness, kerf) → optimized layout (guillotine and non-guillotine), yield %, cut list, labels, PDF/SVG.
2. **Importers/exporters:** Cortecloud, Promob, generic CSV, SketchUp/OpenCutList, Polyboard, Pro100, DXF. Formats based on real public docs; unverified items are marked *por revisar* (to be verified).
3. **MCP server:** lets any user's agent design furniture from measurements (parametric modules: drawer unit, closet, kitchen, bookcase → parts → optimize → export). Setup and per-format status: [`docs/mcp-server.md`](docs/mcp-server.md).
4. **Simple web demo**, tests and es/en docs.

MIT licensed.
