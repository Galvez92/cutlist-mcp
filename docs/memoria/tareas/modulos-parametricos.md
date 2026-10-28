# Tarea: modulos-parametricos
**Rama:** `modulos-parametricos` (Base Code: `parametric-modules`)  **Estado:** en PR borrador

## Objetivo
Generadores paramétricos de cajonera, clóset, cocina y librero a partir de medidas → lista de piezas con canto y veta, usando medidas de referencia reales.

## Criterios de aceptación
- Pruebas automatizadas pasando. ✔ 95 pruebas vitest con `docker compose -f docker-compose.base44.yml --profile tests run --rm tests`; `tsc --noEmit` estricto pasa.
- PR en borrador, sin merge a main. ✔ (borrador, sin merge).
- Formatos/datos no verificados marcados `por revisar` con fuente. ✔ tabla de fuentes en `docs/modulos-parametricos.md`; el puente de aristas al motor también queda `por revisar`.
- Entrada en la bitácora. ✔ `docs/memoria/bitacora/2026-10-27.md` y `2026-10-28.md`.

## Avance
- **TypeScript** (porte desde el Python original): `src/modules/parts.ts`, `modulo.ts`, `profiles.ts`, `spec.ts` y `src/modules/` (cajonera, closet, cocina, librero, **cajon**, **escritorio**) + registro en `index.ts`.
- Tipos del motor de `optimizer-engine` (PR 4) en `src/types.ts`, `src/geometry.ts`, `src/errors.ts`; puente `Pieza.toPartInput()`/`toPart()` y `PerfilRestricciones.toConstraintProfile()`.
- Vista previa de desarrollo en `tools/preview/` + `docker-compose.base44.yml` (puerto 3000 con tsx watch, servicio de pruebas vitest).
- Documentación en `docs/modulos-parametricos.md`.
- **Cajón** (`cajon.ts`): cajón individual con fondo en ranura, armado con minifix Ø15 (vertical, a ~50 mm de las orillas) + pines Ø9.525 (horizontal, por revisar), correderas al centro.
- **Escritorio** (`escritorio.ts`): cubierta + 2 costados + faldón ≥ 70 mm + travesaño trasero.
- Pendiente: mapeo de cantos a `c1/c2/l1/l2` de Cortecloud, reparto de aristas a lados absolutos del motor, ranura de trasera y enlace con las ramas `optimizer-engine` y `mcp-server`.
