# Reglas para agentes de código / Rules for coding agents

1. Lee primero `docs/memoria/` (MEMORIA.md, tu ficha en `tareas/`, la última bitácora).
2. Trabaja solo en tu rama asignada. Nunca en `main`.
3. Abre un PR en **borrador** (draft). **Nunca hagas merge a `main`** ni force-push.
4. Sin secretos: no commits de tokens, claves, contraseñas ni datos personales.
5. Datos reales solamente. **Nunca inventes formatos de archivo.** Lo no verificado se marca `por revisar` con enlace a la fuente consultada.
6. No publiques releases, paquetes ni listados en marketplaces.
7. Al terminar cada corrida agrega una entrada en `docs/memoria/bitacora/AAAA-MM-DD.md` (rama, qué hiciste, pruebas, pendientes).
8. Incluye pruebas para todo lo que agregues.

## Entorno de desarrollo del sandbox (Base44) / Dev environment

- Arrancar: `docker compose -f docker-compose.base44.yml up -d` (un solo servicio `web`;
  Vite queda en el puerto público 3000). Parar: `... down` (sin `-v`, no borres volúmenes).
- El compose monta el repo en `/app` y ejecuta `npm install` al arrancar (npm workspaces en la
  raíz: `demo`). No se usa imagen preconstruida, así que las ediciones del código se ven con
  recarga en vivo; no hace falta rehacer imágenes.
- Pruebas: `docker compose -f docker-compose.base44.yml exec -T web npm test`
  (Vitest; la suite cubre el motor en `tests/`, los módulos paramétricos en `tests/test_*` y
  la demo en `demo/tests/`).
- Node: `jsdom` 30.1.3 arrastra `undici` 8.12.3, que exige Node ≥ 22.19; con Node 20 los
  workers de jsdom (`demo/tests/app/*.test.js`) no arrancan
  (`TypeError: Cannot read properties of undefined (reading 'bind')` en
  `undici/lib/interceptor/decompress.js`). `package.json` declara el mismo rango que jsdom
  (`^22.22.2 || ^24.15.0 || >=26.0.0`), `.nvmrc` fija `22.23.4` y
  `.github/workflows/ci.yml` lo usa (`node-version-file: .nvmrc`) para correr `npm ci`,
  `npm test` y `npm run typecheck`. La imagen `node:22-bookworm-slim` del compose sigue la
  línea 22 LTS, así que también cumple; si actualizas jsdom, revisa estos tres valores.
- Hosts y orígenes: el compose pasa `__VITE_ADDITIONAL_SERVER_ALLOWED_HOSTS=.${BASE44_SANDBOX_HOST_DOMAIN}`
  (Vite ≥ 6.1 lo agrega a `allowedHosts`); sin efecto cuando la variable no está definida.
  No hay hosts fijos en el código ni overrides condicionados a `BASE44_PREVIEW_MODE`: no hizo
  falta tocar configuración compartida para el sandbox.
- Motor: `src/` (TypeScript, rama `optimizer-engine`, PR #4). Alias `@engine` → `src/`
  declarado en `demo/aliases.js` (lo comparten Vite y el `vitest.config.ts` de la raíz).
  El motor no tiene dependencias de ejecución; el PDF se genera con un escritor propio
  (`src/render/pdf-writer.ts`). `pdf-lib` es solo para los tests del motor.
- Módulos paramétricos: `src/modules/` (rama `parametric-modules`). Generadores de cajón,
  cajonera, clóset, cocina, escritorio y librero (`Pieza`, `Modulo`, `PerfilRestricciones`), intérprete de ideas
  escritas (`spec.ts`) y puente al motor (`Pieza.toPartInput()`,
  `PerfilRestricciones.toConstraintProfile()`). Vista previa de desarrollo opcional en
  `tools/preview/` (`npm run preview`; vista del motor con pedido de ejemplo en `npm run preview:motor`, `tools/preview/motor.ts`; documentación de formatos en `npm run preview:formatos`, `tools/preview/formatos.ts`). Ver `docs/modulos-parametricos.md`.
- Demo: `demo/` (Vite, DOM nativo). Adaptadores del demo en `demo/src/engine/`:
  `cortecloud.js` (importador, no incluido en el motor), `csv.js` (exportación CSV,
  no incluida en el motor), `adapt.js` (conversión estado→motor), `constants.js`
  (MODES, DEFAULT_KERF).
- Datos reales: el fixture de Cortecloud se importa directo desde `tests/fixtures/` (sin
  copias). Lo no verificado está en `docs/por-revisar.md` y `docs/modulos-parametricos.md`
  con su fuente.
- Si otra rama agrega un paquete al monorepo, decláralo en `workspaces` de la raíz y añade el
  servicio correspondiente a `docker-compose.base44.yml` con sus etiquetas `base44.*`.
- Servidor MCP: `src/servidor.ts`, `src/http.ts` (Streamable HTTP en `/mcp`) y `src/stdio.ts`. Servicio `mcp` del compose en el puerto 3001; `npm run start:stdio` / `npm run start:http`. Sus pruebas usan `node:test` y corren con `npm run test:mcp` (incluidas en `npm test`). Las listas de `Host`/`Origin` de `src/http.ts` solo se amplían si `BASE44_PREVIEW_MODE` vale exactamente `"1"`. Ver `docs/mcp-server.md`.
