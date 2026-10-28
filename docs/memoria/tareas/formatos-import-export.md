# Tarea: formatos-import-export
**Rama:** `formatos-import-export`  **Estado:** completado (PR en borrador)

## Objetivo
Importadores/exportadores: Cortecloud (fixture real en tests/fixtures/cortecloud), Promob, CSV genérico, SketchUp/OpenCutList, Polyboard, Pro100, DXF. Investigar documentación pública; lo no verificable = por revisar.

## Entregado
- Paquete `src/formats/` en TypeScript (Node estándar, sin dependencias de ejecución), sobre los tipos del motor (`src/types.ts`, rama `optimizer-engine`):
  - `src/formats/model.ts` — `Piece`, `CutList`, `Notice`/`Source` y estados de verificación. La pieza conserva veta tri-estado y cantos de texto (no se fuerza a `PartInput` para no inventar datos); los formatos usan los tipos del motor donde encajan sin pérdida (DXF exporta desde `LayoutResult`).
  - `src/formats/` — `cortecloud`, `csv_generico`, `opencutlist`, `polyboard`, `promob`, `pro100`, `dxf`, más `base.ts` (utilidades de tabla y contrato), `listado.ts` (listados con columnas declaradas) e `index.ts` (registro). DXF exporta desde el `LayoutResult` del motor.
- Documentación por formato en `docs/formatos/` (índice con tabla de estados + una ficha por formato con fuentes y «por revisar»).
- Pruebas: `tests/cortecloud.test.ts`, `csv-generico.test.ts`, `opencutlist.test.ts`, `listados.test.ts`, `dxf.test.ts`, `registry.test.ts` (59 pruebas `vitest`, todas pasando; las 59 de Python portadas a TypeScript).
- Fixtures en `tests/fixtures/` con `README.md` que distingue reales de ejemplos construidos.
- Entorno: `docker-compose.base44.yml` (node:22), `.base44/environment.json` y la sección de entorno en `AGENTS.md`. El código Python original se eliminó.

## Criterios de aceptación
- [x] Pruebas automatizadas pasando (59 `vitest`, portadas de Python).
- [x] PR en borrador, sin merge a main.
- [x] Formatos/datos no verificados marcados `por revisar` con fuente (descriptor + avisos en cada lista).
- [x] Entrada en la bitácora.

## Pendientes (por revisar)
- Conseguir muestras reales de PolyBoard, Promob y PRO100 para fijar columnas por defecto (hoy exigen declararlas o avisan del orden asumido).
- Conseguir el esquema del XML de listagem de Promob (el importador XML no está implementado).
- Confirmar con Cortecloud: unidad de medida y semántica de `c`/`l`.
- Confirmar con OpenCutList: títulos de columna nativos y uso de unidades.
