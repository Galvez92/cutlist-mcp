# Tarea: formatos-import-export
**Rama:** `formatos-import-export`  **Estado:** completado (PR en borrador)

## Objetivo
Importadores/exportadores: Cortecloud (fixture real en tests/fixtures/cortecloud), Promob, CSV genérico, SketchUp/OpenCutList, Polyboard, Pro100, DXF. Investigar documentación pública; lo no verificable = por revisar.

## Entregado
- Paquete `cutlist/` (biblioteca estándar de Python 3.12, sin dependencias):
  - `cutlist/model.py` — `Pieza`, `ListaCorte`, `Hoja`, `Colocacion`, `Layout`, `Aviso`/`Fuente` y estados de verificación.
  - `cutlist/formats/` — `cortecloud`, `csv_generico`, `opencutlist`, `polyboard`, `promob`, `pro100`, `dxf`, más `base.py` (utilidades de tabla y contrato), `listado.py` (listados con columnas declaradas) y `__init__.py` (registro).
- Documentación por formato en `docs/formatos/` (índice con tabla de estados + una ficha por formato con fuentes y «por revisar»).
- Pruebas: `tests/test_cortecloud.py`, `test_csv_generico.py`, `test_opencutlist.py`, `test_listados.py`, `test_dxf.py`, `test_registry.py` (59 pruebas, todas pasando).
- Fixtures nuevos en `tests/fixtures/` con `README.md` que distingue reales de ejemplos construidos.
- Entorno: `docker-compose.base44.yml`, `.base44/environment.json` y la sección de entorno en `AGENTS.md`.

## Criterios de aceptación
- [x] Pruebas automatizadas pasando (58).
- [x] PR en borrador, sin merge a main.
- [x] Formatos/datos no verificados marcados `por revisar` con fuente (descriptor + avisos en cada lista).
- [x] Entrada en la bitácora.

## Pendientes (por revisar)
- Conseguir muestras reales de PolyBoard, Promob y PRO100 para fijar columnas por defecto (hoy exigen declararlas o avisan del orden asumido).
- Conseguir el esquema del XML de listagem de Promob (el importador XML no está implementado).
- Confirmar con Cortecloud: unidad de medida y semántica de `c`/`l`.
- Confirmar con OpenCutList: títulos de columna nativos y uso de unidades.
