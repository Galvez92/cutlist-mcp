# Reglas para agentes de código / Rules for coding agents

1. Lee primero `docs/memoria/` (MEMORIA.md, tu ficha en `tareas/`, la última bitácora).
2. Trabaja solo en tu rama asignada. Nunca en `main`.
3. Abre un PR en **borrador** (draft). **Nunca hagas merge a `main`** ni force-push.
4. Sin secretos: no commits de tokens, claves, contraseñas ni datos personales.
5. Datos reales solamente. **Nunca inventes formatos de archivo.** Lo no verificado se marca `por revisar` con enlace a la fuente consultada.
6. No publiques releases, paquetes ni listados en marketplaces.
7. Al terminar cada corrida agrega una entrada en `docs/memoria/bitacora/AAAA-MM-DD.md` (rama, qué hiciste, pruebas, pendientes).
8. Incluye pruebas para todo lo que agregues.

## Entorno de desarrollo (Base44)

- Levantar: `docker compose -f docker-compose.base44.yml up -d` (el servicio `web`
  queda en el puerto 3000 y sirve la vista previa de desarrollo desde
  `tools/preview/server.ts`, en Node + tsx).
- Pruebas: `docker compose -f docker-compose.base44.yml --profile tests run --rm tests`.
  El host del sandbox no tiene Node: todo se corre dentro del contenedor.
- `web` corre `tsx watch`, que recarga el servidor al cambiar archivos; si no
  refresca, `docker compose -f docker-compose.base44.yml restart web`.
- El proyecto es una biblioteca TypeScript. Las dependencias de desarrollo son
  `tsx`, `typescript` y `vitest` (`package.json`). No hay base de datos, colas ni
  secretos.
- Los tipos del motor de optimización (`src/types.ts`, `src/geometry.ts`,
  `src/errors.ts`) se traen de la rama `optimizer-engine` (PR 4) y son la base
  compartida; la pieza paramétrica se bridgea al motor con `Pieza.toPartInput()`.
- El repositorio todavía no tiene optimizador, importadores/exportadores, servidor
  MCP ni demo web: cada uno es una rama con su ficha en `docs/memoria/tareas/`.
  Aquí solo vive la capa de módulos paramétricos (`src/modules/`) y su vista previa
  (`tools/preview/`); ver `docs/modulos-parametricos.md`.
