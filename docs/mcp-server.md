# Servidor MCP · cutlist-mcp

Servidor MCP (TypeScript, [SDK oficial v2](https://ts.sdk.modelcontextprotocol.io/v2/) — `@modelcontextprotocol/server`)
que expone el optimizador de corte a cualquier agente: **módulos paramétricos → piezas → optimización → exportación**.

- Documentación del SDK usada: <https://ts.sdk.modelcontextprotocol.io/v2/get-started/first-server.html> y
  <https://ts.sdk.modelcontextprotocol.io/v2/serving/http.html> (consultadas el 2026-10-27).
- Transportes: **stdio** (clientes de escritorio) y **Streamable HTTP** (un endpoint para varios clientes).

## Herramientas

| Herramienta | Entrada | Salida |
| --- | --- | --- |
| `crear_modulo` | `tipo` (`cajonera`, `closet`, `cocina`, `librero`), `ancho`, `alto`, `profundidad` en mm y opciones (`espesor`, `cantoFrente`, `numeroCajones`, `numeroEstantes`, `numeroPuertas`, `altoZocalo`, `holgura`, `nombre`, `material`) | lista de piezas con cantidad, veta y cantos + resumen (unidades, m²) |
| `listar_piezas` | `piezas` | piezas normalizadas y resumen por grupo/material |
| `optimizar_corte` | `piezas`, `tableros` y opciones (`estrategia`: `guillotina` \| `no-guillotina`, `kerf`, `permitirRotacion`) | layout por hoja con coordenadas en mm, aprovechamiento, consumo y piezas que no cupieron |
| `exportar` | `formato` (opcional), `piezas`, `tableros` (para los formatos con layout) | contenido del formato pedido; sin `formato`, el catálogo de formatos soportados con su estado |

Las piezas llevan `largo` y `ancho` en mm; `veta: true` significa que la veta sigue el eje `largo`
y que la pieza no se rota. Los cantos se nombran por la dimensión sobre la que corren
(`largo1`, `largo2`, `ancho1`, `ancho2`).

## Instalación

Requiere Node.js 20 o posterior.

```sh
npm ci
npm test          # pruebas (node:test + tsx)
npm run typecheck # tsc --noEmit
```

### stdio (clientes de escritorio)

```sh
npx tsx src/stdio.ts
```

La configuración del cliente es siempre «comando + argumentos». Ejemplos verificados contra la
documentación oficial ([Plug into a real host](https://ts.sdk.modelcontextprotocol.io/v2/get-started/real-host.html),
[Connect to local MCP servers](https://modelcontextprotocol.io/docs/2026-07-28/develop/connect-local-servers)):

- **VS Code** — ya está en el repositorio, en `.vscode/mcp.json`:

  ```json
  { "servers": { "cutlist": { "type": "stdio", "command": "npx", "args": ["tsx", "src/stdio.ts"] } } }
  ```

- **Claude Code** — `claude mcp add cutlist -- npx tsx src/stdio.ts`
- **Cursor** — `.cursor/mcp.json` con la clave `mcpServers` y el mismo `command`/`args`.
- **Claude Desktop** — `claude_desktop_config.json` (macOS: `~/Library/Application Support/Claude/`,
  Windows: `%APPDATA%\Claude\`), misma entrada.

> stdout es el canal del protocolo: los mensajes del servidor van siempre a stderr.

### HTTP (Streamable HTTP)

```sh
PORT=3000 npm run start:http   # o npm run dev:http para recarga al editar
```

- `POST /mcp` — servidor MCP.
- `GET /` — página informativa (herramientas, conexión y estado de cada formato).

```sh
curl -s -X POST http://localhost:3000/mcp \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

El endpoint valida `Host` y `Origin` (protección contra DNS rebinding) y **no** implementa
autenticación: pensado para uso local. Si se publica, hay que ponerle autenticación delante.

## Formatos de exportación

| `formato` | Archivo | Estado | Fuente |
| --- | --- | --- | --- |
| `cortecloud` | `.json` | verificado | muestra real saneada `tests/fixtures/cortecloud/escritorio_D_simple.json` |
| `csv` | `.csv` | verificado | esquema propio del proyecto (cabecera fija, se prueba ida y vuelta) |
| `svg` | `.svg` | verificado | [W3C SVG 2](https://www.w3.org/TR/SVG2/) |
| `dxf` | `.dxf` | **por revisar** | [Autodesk DXF Reference (R12)](https://damassets.autodesk.net/content/dam/autodesk/www/developer-network/platform-technologies/autocad-dxf-archive/acad_r12_dxf.pdf) y [ezdxf: estructura mínima R12](https://ezdxf.readthedocs.io/en/stable/dxfinternals/filestructure.html) |

`exportar` devuelve también el estado y las fuentes de cada formato, para que el agente sepa qué
está verificado y qué no.

## Datos por revisar

Todo lo que no se ha podido contrastar con una fuente real queda marcado `por revisar`
(regla 5 de `AGENTS.md`):

1. **Correspondencia de orillas.** `largo → c`, `ancho → l`, `largo1 → c1`, `largo2 → c2`,
   `ancho1 → l1`, `ancho2 → l2`, `nombre → function`, `grupo → complement` se dedujo de los nombres
   de los campos de la muestra real citada arriba. La convención «`largo1` es la orilla frontal» y
   qué orilla física es cada campo quedan por revisar con una segunda muestra.
2. **Mecanizado.** El export de Cortecloud **no** genera `machining` (barrenos y ranuras). La muestra
   real trae ese bloque en 3 de sus 21 piezas, así que falta por implementar y verificar.
3. **DXF.** Se emite la estructura mínima R12 (sección `ENTITIES` y `EOF`) con entidades `LINE` y
   `TEXT`; no se ha abierto en un CAD real ni se incluye tabla de capas.
4. **Valores por defecto sin norma de fabricante.** Kerf 3 mm, holgura entre frentes 3 mm, zócalo
   100 mm, 3 cajones, 4 estantes (librero), 1 estante (clóset) y 2 puertas son valores de partida del
   proyecto; conviene pasarlos explícitos en cada corrida. El espesor por defecto (18 mm) sí sale del
   perfil de `docs/memoria/MEMORIA.md`.
5. **Restricciones de fabricación.** El motor (de `optimizer-engine`) ya tiene perfiles de
   restricciones (`CORTECLOUD_MADIJAL_PROFILE` en `src/engine/profiles.ts`), pero el adaptador del
   MCP (`src/core/adaptador.ts`) todavía no los pasa a `optimize()`. Falta exponer el perfil como
   parámetro de `optimizar_corte`.
6. **Alcance de la cajonera.** Genera el cuerpo y los frentes de cajón, no la caja del cajón.
7. **Trasera.** Se modela con el mismo espesor que el cuerpo, no con un fondo delgado.
8. **Optimizador.** El motor es el de la rama `optimizer-engine` (PR 4), integrado en `src/engine/`.
   Con `auto` (por defecto) prueba guillotina y MaxRects con cuatro órdenes de piezas cada uno y
   devuelve el mejor resultado (menos piezas sin colocar → menos hojas → menos desperdicio). La
   guillotina hace partición recursiva con cortes de lado a lado; MaxRects usa cortes en L. El
   kerf se respeta entre piezas vecinas. Las piezas con veta **pueden** rotarse sobre un tablero sin
   veta (el motor lo permite); sobre un tablero con veta, no. No garantiza el óptimo.

## Entorno del sandbox de Base44

`docker-compose.base44.yml` levanta el mismo código en el sandbox (dependencias al arrancar desde
`package-lock.json`, puerto 3000).

Única concesión al sandbox: `src/http.ts` añade el `Host` del proxy (`<puerto>-<id>.$BASE44_SANDBOX_HOST_DOMAIN`)
y el `Origin` público (`https://<puerto>-$BASE44_PUBLIC_HOST_SUFFIX`) a las listas permitidas **sólo**
cuando `BASE44_PREVIEW_MODE` vale exactamente `"1"`. Sin esa variable (o con otro valor) el servidor
solo acepta `localhost`, `127.0.0.1` y `[::1]`, que es el comportamiento original.
