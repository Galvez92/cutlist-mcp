# Tarea: modulos-parametricos
**Rama:** `modulos-parametricos` (Base Code: `parametric-modules`)  **Estado:** en PR borrador

## Objetivo
Generadores paramétricos de cajonera, clóset, cocina y librero a partir de medidas → lista de piezas con canto y veta, usando medidas de referencia reales.

## Criterios de aceptación
- Pruebas automatizadas pasando. ✔ 92 pruebas con `docker compose -f docker-compose.base44.yml --profile tests run --rm tests`.
- PR en borrador, sin merge a main. ✔ (borrador, sin merge).
- Formatos/datos no verificados marcados `por revisar` con fuente. ✔ tabla de fuentes en `docs/modulos-parametricos.md`.
- Entrada en la bitácora. ✔ `docs/memoria/bitacora/2026-10-27.md`.

## Avance
- `cutlist/parts.py`, `cutlist/modulo.py`, `cutlist/profiles.py`, `cutlist/spec.py` y `cutlist/modules/` (cajonera, closet, cocina, librero).
- Vista previa de desarrollo en `app/` + `docker-compose.base44.yml` (puerto 3000, servicio de pruebas).
- Documentación en `docs/modulos-parametricos.md`.
- Pendiente: mapeo de cantos a `c1/c2/l1/l2` de Cortecloud, ranura de trasera y enlace con las ramas `optimizer-engine` y `mcp-server`.
