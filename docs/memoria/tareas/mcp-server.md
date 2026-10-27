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
- Piezas de apoyo creadas en esta rama, porque motor/modulos/formatos siguen pendientes:
  `src/core/modulos.ts`, `src/core/optimizar.ts` (guillotina y MaxRects), `src/core/listar.ts`,
  `src/export/` (cortecloud, csv, svg, dxf) y `src/esquemas.ts`.
- Pruebas: `npm test` → 55 pruebas, 0 fallos; `npm run typecheck` sin errores.
- Instalación para clientes MCP y lista de datos `por revisar`: `docs/mcp-server.md`.
- Entorno del sandbox: `docker-compose.base44.yml` (puerto 3000) y `.base44/environment.json`.
