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
  `app/servidor.py`).
- Pruebas: `docker compose -f docker-compose.base44.yml --profile tests run --rm tests`.
  El host del sandbox no tiene Python: todo se corre dentro del contenedor.
- `web` usa el servidor HTTP de la biblioteca estándar y **no recarga código solo**:
  después de editar, `docker compose -f docker-compose.base44.yml restart web`.
- El proyecto es una biblioteca Python sin dependencias de ejecución. La única
  dependencia de desarrollo es `pytest` (`requirements-dev.txt`). No hay base de
  datos, colas ni secretos.
- El repositorio todavía no tiene optimizador, importadores/exportadores, servidor
  MCP ni demo web: cada uno es una rama con su ficha en `docs/memoria/tareas/`.
  Aquí solo vive la capa de módulos paramétricos (`cutlist/`) y su vista previa
  (`app/`); ver `docs/modulos-parametricos.md`.
