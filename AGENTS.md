# Reglas para agentes de código / Rules for coding agents

1. Lee primero `docs/memoria/` (MEMORIA.md, tu ficha en `tareas/`, la última bitácora).
2. Trabaja solo en tu rama asignada. Nunca en `main`.
3. Abre un PR en **borrador** (draft). **Nunca hagas merge a `main`** ni force-push.
4. Sin secretos: no commits de tokens, claves, contraseñas ni datos personales.
5. Datos reales solamente. **Nunca inventes formatos de archivo.** Lo no verificado se marca `por revisar` con enlace a la fuente consultada.
6. No publiques releases, paquetes ni listados en marketplaces.
7. Al terminar cada corrida agrega una entrada en `docs/memoria/bitacora/AAAA-MM-DD.md` (rama, qué hiciste, pruebas, pendientes).
8. Incluye pruebas para todo lo que agregues.

## Entorno local (Base44)

- El motor (`src/`) es TypeScript **sin dependencias de ejecución**. Las de desarrollo (`typescript`, `tsx`, `vitest`, `pdf-lib` para validar el PDF en las pruebas) están en `package.json` y las instala el contenedor al arrancar.
- Levantar: `docker compose -f docker-compose.base44.yml up -d` (servicio `web`, puerto 3000). El servicio corre `npm install` y luego `tsx tools/preview/server.ts`.
- `node_modules` es un volumen Docker, no un directorio del repo. El código se monta por bind mount, así que los cambios se aplican sin reconstruir la imagen.
- Pruebas y tipos (dentro del contenedor, nunca en el host):
  - `docker compose -f docker-compose.base44.yml exec -T web npm test`
  - `docker compose -f docker-compose.base44.yml exec -T web npm run typecheck`
- `http://localhost:3000` sirve `tools/preview/server.ts`: una vista de desarrollo que ejecuta el motor sobre un pedido de EJEMPLO (`/`, `/health`, `/layout.svg`, `/layout.pdf`, `/layout.json`). No es la demo web final (esa va en su rama); sirve para ver y verificar el motor.
- El kerf no tiene valor por defecto: si no se pasa en la petición, es 0. La memoria no documenta el kerf de ninguna máquina.
- `tests/fixtures/cortecloud/` son datos reales de un pedido. Lo que no está verificado contra una fuente pública se marca `por revisar` (ver el perfil en `src/profiles.ts`).
