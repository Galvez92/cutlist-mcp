# Tarea: demo-web-docs
**Rama:** `demo-web-docs`  **Estado:** entregado (PR en borrador)

## Objetivo
Demo web simple (subir piezas/CSV, ver layout SVG, descargar), README es/en, guía de uso.

## Criterios de aceptación
- Pruebas automatizadas pasando.
- PR en borrador, sin merge a main.
- Formatos/datos no verificados marcados `por revisar` con fuente.
- Entrada en la bitácora.

## Avance
- Demo Vite (DOM nativo) que consume el motor TypeScript de `src/` (optimizer-engine, PR #4)
  por el alias `@engine`. Paneles: piezas, tablero/modo/perfil, layout SVG, descargas PDF/CSV.
- Ejemplo por omisión: el **escritorio compacto** real (fixture de Cortecloud,
  `tests/fixtures/cortecloud/escritorio_D_simple.json`).
- **Módulos paramétricos** integrados desde la rama `parametric-modules`: un panel
  (`demo/src/ui/modules-panel.js`) genera cajonera, clóset, cocina y librero desde medidas y
  pasa el despiece al optimizador (`demo/src/engine/modules.js` puentea `Pieza.toPartInput()`).
- Pruebas: 186 (motor + módulos + demo) en verde; `tsc --noEmit` en verde.
