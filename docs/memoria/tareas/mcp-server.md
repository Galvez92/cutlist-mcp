# Tarea: mcp-server
**Rama:** `mcp-server`  **Estado:** hecho (PR en borrador, 2026-10-27)

## Objetivo
Servidor MCP con herramientas: crear módulo, listar piezas, optimizar, exportar. Documentar instalación para clientes MCP.

## Criterios de aceptación
- Pruebas automatizadas pasando.
- PR en borrador, sin merge a main.
- Formatos/datos no verificados marcados `por revisar` con fuente.
- Entrada en la bitácora.

## Resultado (2026-10-27)
- Servidor MCP en TypeScript con el SDK oficial v2 (`@modelcontextprotocol/server`), con dos entradas:
  `src/stdio.ts` (clientes de escritorio) y `src/http.ts` (Streamable HTTP en `/mcp` + página en `/`).
- Herramientas: `crear_modulo`, `listar_piezas`, `optimizar_corte` y `exportar` (sin `formato` devuelve
  el catálogo con el estado de verificación de cada uno).
- **Motor:** una sola copia en `src/` (raíz del motor). El adaptador `src/core/adaptador.ts` traduce
  entre los tipos del MCP (Pieza/Tablero con cantos de texto) y los del motor (PartInput/SheetInput
  con cantos numéricos), llama a `optimize()` y traduce el resultado; `optimizarConLayout()` devuelve
  además el layout crudo para PDF y etiquetas. La copia `src/engine/` se eliminó el 2026-11-11.
- Módulos paramétricos y resumen de piezas propios del MCP: `src/core/modulos.ts`, `src/core/listar.ts`.
- Exportadores: `src/export/` (cortecloud, csv, svg, dxf, pdf y etiquetas) y `src/esquemas.ts`.
- Pruebas: `npm test` → 373 pruebas vitest + 74 del servidor MCP, 0 fallos; `npm run typecheck` sin errores.
- Instalación para clientes MCP y lista de datos `por revisar`: `docs/mcp-server.md`.
- Entorno del sandbox: `docker-compose.base44.yml` (puerto 3000) y `.base44/environment.json`.
