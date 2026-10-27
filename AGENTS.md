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

- El proyecto es una **biblioteca de Python 3.12 sin dependencias externas** (sólo
  biblioteca estándar) más documentación. No hay que instalar nada.
- `docker compose -f docker-compose.base44.yml up -d --build` levanta:
  - `docs` (puerto 3000, larga duración): sirve `docs/` con `python -m http.server`.
    Es lo que muestra el preview, porque **esta rama todavía no tiene UI web** (la
    demo web llega con la rama `demo-web-docs`). Los archivos se sirven por bind
    mount, directo desde el repo.
  - `pruebas` (un solo uso): corre la suite `unittest` y termina.
- Pruebas: `docker compose -f docker-compose.base44.yml run --rm pruebas`
  (equivale a `python3 -m unittest discover -s tests -t .`). 58 pruebas.
- Sin secretos, sin variables de entorno requeridas y **sin overrides de sandbox**:
  no hay allowlist de host/origen ni HMR que ajustar (`python -m http.server` no
  valida el encabezado `Host` y no hay servidor de recarga). `BASE44_PREVIEW_MODE`
  no se usa en este repositorio; si alguna vez se necesita, debe compararse con
  `"1"` y pasarse como variable sin valor por defecto en el compose.
- Formatos: el registro está en `cutlist/formats/__init__.py`; cada formato declara
  dirección, estado (`verificado`/`parcial`/`por revisar`) y fuentes, y lo no
  verificado viaja como aviso en la lista de corte. Detalle en `docs/formatos/`.
  Los fixtures nuevos se documentan en `tests/fixtures/README.md` (real vs ejemplo
  construido).
