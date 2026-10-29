# Reglas para agentes de código / Rules for coding agents

1. Lee primero `docs/memoria/` (MEMORIA.md, tu ficha en `tareas/`, la última bitácora).
2. Trabaja solo en tu rama asignada. Nunca en `main`.
3. Abre un PR en **borrador** (draft). **Nunca hagas merge a `main`** ni force-push.
4. Sin secretos: no commits de tokens, claves, contraseñas ni datos personales.
5. Datos reales solamente. **Nunca inventes formatos de archivo.** Lo no verificado se marca `por revisar` con enlace a la fuente consultada.
6. No publiques releases, paquetes ni listados en marketplaces.
7. Al terminar cada corrida agrega una entrada en `docs/memoria/bitacora/AAAA-MM-DD.md` (rama, qué hiciste, pruebas, pendientes).
8. Incluye pruebas para todo lo que agregues.

## Entorno de desarrollo (Base44) / Dev environment

- Todo el código es Python con **sólo biblioteca estándar**: no hay `pip install`, ni base de datos, ni servicios externos, ni secretos que configurar.
- Levantar / arrancar: `docker compose -f docker-compose.base44.yml up -d --build`. Sirve `server.py` en el puerto 3000 (interno 8000).
- Pruebas, siempre dentro del contenedor (el host no tiene Python):
  `docker compose -f docker-compose.base44.yml exec -T web python -m unittest discover -s tests -t .`
- `server.py --reload` reinicia el proceso cuando cambia un `.py`, así que las ediciones se ven sin rebuild ni reinicio manual.
- La página `/` muestra el resultado sobre el fixture real de `tests/fixtures/cortecloud/` y permite pegar un CSV propio. La API es `/api/health`, `/api/demo?algorithm=guillotine|nonguillotine`, `/api/example` y `POST /api/optimize` (`{"csv": "...", "algorithm": "...", "sheet": {...}}`).
- El CSV es un formato **propio de cutlist-mcp** (documentado en `cutlist/csv_import.py`), no el de Cortecloud ni el de otro programa.
- El mapeo fixture → motor vive en `cutlist/demo.py` y es **provisional**: el importador completo es la tarea `formatos-import-export` y todavía no asigna materiales, por eso todo se optimiza sobre un único stock.
