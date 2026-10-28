# Reglas para agentes de código / Rules for coding agents

1. Lee primero `docs/memoria/` (MEMORIA.md, tu ficha en `tareas/`, la última bitácora).
2. Trabaja solo en tu rama asignada. Nunca en `main`.
3. Abre un PR en **borrador** (draft). **Nunca hagas merge a `main`** ni force-push.
4. Sin secretos: no commits de tokens, claves, contraseñas ni datos personales.
5. Datos reales solamente. **Nunca inventes formatos de archivo.** Lo no verificado se marca `por revisar` con enlace a la fuente consultada.
6. No publiques releases, paquetes ni listados en marketplaces.
7. Al terminar cada corrida agrega una entrada en `docs/memoria/bitacora/AAAA-MM-DD.md` (rama, qué hiciste, pruebas, pendientes).
8. Incluye pruebas para todo lo que agregues.

## Entorno de desarrollo (Base44 / sandbox)

- El proyecto es **TypeScript sin dependencias de ejecución** (sólo biblioteca
  estándar de Node). Las de desarrollo (`typescript`, `tsx`, `vitest`,
  `@types/node`) están en `package.json` y las instala el contenedor al arrancar.
- `docker compose -f docker-compose.base44.yml up -d` levanta `web` (node:22,
  puerto 3000): `npm install` y luego `tsx watch tools/preview/server.ts`, que
  sirve la documentación del repo (`docs/`). Es lo que muestra el preview: esta
  rama no tiene UI web (la demo llega con `demo-web-docs`). El código se monta por
  bind mount y `node_modules` es un volumen Docker.
- Pruebas y tipos (dentro del contenedor, nunca en el host):
  - `docker compose -f docker-compose.base44.yml exec -T web npm test`
  - `docker compose -f docker-compose.base44.yml exec -T web npm run typecheck`
- Sin secretos, sin variables de entorno requeridas y **sin overrides de sandbox**:
  el servidor de preview no valida el encabezado `Host`. `BASE44_PREVIEW_MODE` no
  se usa en este repositorio; si alguna vez se necesita, debe compararse con `"1"`
  y pasarse como variable sin valor por defecto en el compose.
- Formatos: el registro está en `src/formats/index.ts`; cada formato declara
  dirección, estado (`verificado`/`parcial`/`por revisar`) y fuentes, y lo no
  verificado viaja como aviso en la lista de corte (`src/formats/model.ts`). Los
  tipos del motor vienen de `src/types.ts` (copia de la rama `optimizer-engine` /
  PR 4); los formatos los usan donde encajan sin pérdida (DXF exporta desde el
  `LayoutResult` del motor). Detalle en `docs/formatos/`.
  Los fixtures nuevos se documentan en `tests/fixtures/README.md` (real vs ejemplo
  construido).
