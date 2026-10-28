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

El entorno vive en `docker-compose.base44.yml` (no usar el compose propio del
repo, si aparece). Un solo servicio `web` monta el código y recarga solo:

```bash
docker compose -f docker-compose.base44.yml up -d --build   # http://localhost:3000
docker compose -f docker-compose.base44.yml exec -T web python -m pytest -q
```

- La app es Python 3.12 + FastAPI; `uvicorn --reload` vigila `app/` y `cutlist/`.
  Los archivos de `web/` se sirven estáticos: tras cambiarlos hay que recargar el
  navegador.
- No requiere credenciales externas ni `/run/base44/app.env`. Si algún día se
  agregan, ese `env_file` va último en el servicio para que no gane un
  placeholder de compose.
- La muestra del inicio es el fixture real `tests/fixtures/cortecloud/escritorio_D_simple.json`;
  sirve como prueba de humo de la API (`GET /api/demo`).
