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
- La página `/` muestra el resultado sobre el fixture real de `tests/fixtures/cortecloud/`, permite pegar un CSV propio y editar el catálogo de **stocks** (material, ancho, alto, espesor, kerf) que usa `POST /api/optimize`; la lista se guarda en el `localStorage` del navegador (`cutlist.stocks.v1`). La API es `/api/health`, `/api/demo?algorithm=guillotine|nonguillotine`, `/api/example` y `POST /api/optimize` (`{"csv": "...", "algorithm": "...", "sheet": {...}}` o, con varios tipos de stock, `"stocks": [{"material", "width", "height", "thickness", "kerf"}, ...]`).
- `cutlist/stock.py` asigna cada pieza al stock de su `material` (varios stocks por material permitidos; un stock sin material es comodín; si no hay stock del material, la pieza queda sin ubicar con un aviso). `{"sheet": ...}` sin `material` sigue siendo comodín para todo.
- El CSV es un formato **propio de cutlist-mcp** (documentado en `cutlist/csv_import.py`), no el de Cortecloud ni el de otro programa.
- El fixture de Cortecloud se importa en `cutlist/cortecloud.py`: agrupa las piezas por el texto `material` y cada material se corta de su propio tablero (`cutlist/materials.py`). Faltan los demás formatos de la tarea `formatos-import-export`.
