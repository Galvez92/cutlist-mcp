# Reglas para agentes de código / Rules for coding agents

1. Lee primero `docs/memoria/` (MEMORIA.md, tu ficha en `tareas/`, la última bitácora).
2. Trabaja solo en tu rama asignada. Nunca en `main`.
3. Abre un PR en **borrador** (draft). **Nunca hagas merge a `main`** ni force-push.
4. Sin secretos: no commits de tokens, claves, contraseñas ni datos personales.
5. Datos reales solamente. **Nunca inventes formatos de archivo.** Lo no verificado se marca `por revisar` con enlace a la fuente consultada.
6. No publiques releases, paquetes ni listados en marketplaces.
7. Al terminar cada corrida agrega una entrada en `docs/memoria/bitacora/AAAA-MM-DD.md` (rama, qué hiciste, pruebas, pendientes).
8. Incluye pruebas para todo lo que agregues.

## Entorno de desarrollo en el sandbox (Base44)

- La app se levanta con `docker compose -f docker-compose.base44.yml up -d --build`. Las dependencias
  se instalan al arrancar (volumen `node_modules`) desde `package-lock.json`, así que editar código no
  necesita reconstruir la imagen.
- Todo corre dentro de contenedores: `docker compose -f docker-compose.base44.yml exec mcp npm test`
  (pruebas) y `... exec mcp npm run typecheck` (tipos). En el host no hay Node.
- El puerto 3000 sirve `/` (página informativa) y `/mcp` (servidor MCP por Streamable HTTP).
  `src/stdio.ts` es la entrada que usan los clientes de escritorio.
- Único ajuste por el sandbox: las listas de `Host`/`Origin` permitidas en `src/http.ts` sólo se
  amplían si `BASE44_PREVIEW_MODE` vale exactamente `"1"`.
- Detalles, estado de verificación de cada formato y pendientes: `docs/mcp-server.md`.
