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
- **Cajón** (`cajon.ts`): cajón individual con fondo en ranura, armado con minifix: caja Ø15 mm con 13.5 mm de profundidad (18 mm de tablero) y **pasador Ø7 mm** (`diametro_pin`, acepta Ø8 y 9.525) según Häfele *IXCONNECT Minifix 15* (verificado 2026-10-30), correderas al centro. El perfil Cortecloud/Madijal solo tiene Ø9.525 mm en horizontal, así que el barreno real sale como `barreno_no_permitido` y queda por revisar con el proveedor.
- **Escritorio** (`escritorio.ts`): cubierta + 2 costados + faldón ≥ 70 mm + travesaño trasero.
- **Mapeo de cantos a Cortecloud** (`cortecloud.ts`): verificado contra la guía oficial de Serrabits (2026-10-29). `c1` = `largo_a` (segmento 0-1), `c2` = `largo_b` (2-3), `l1` = `ancho_b` (1-2, inferior) y `l2` = `ancho_a` (3-0, superior); el importador del demo tenía `l1`/`l2` invertidos y se corrigió.
- **Bisagras de puertas batientes** (`bisagras.ts`, compartido): cantidad por alto de puerta 2/3/4/5 hasta 900/1600/2000/2400 mm y revelado mínimo verificados con Hettich *Sensys* y Blum CLIP top (2026-10-29). El clóset avisa si la holgura queda bajo 2 × 1.3 mm; clóset y cocina avisan si las puertas superan 600 mm de ancho o 2400 mm de alto. La cocina dejó su regla local de 2/3 y usa la misma tabla. La cantidad también se calcula por **peso de la puerta** (Blum: 2 bisagras de 4 a 6 kg, 3 de 6 a 12 kg): `pesoPuertaKg()` usa área × espesor × 750 kg/m³, se le suma el **peso del tirador** (`peso_tirador`, 0.09 kg por omisión: ficha del tirador de 96 mm verificada el 2026-10-29; otro tirador cambia el valor) y `bisagrasPuerta()` pide la mayor de las dos guías, avisando sobre 12 kg o cuando el peso manda, con el desglose tablero + tirador. Suites en `tests/test_closet_herrajes.test.ts`, `tests/test_bisagras_peso.test.ts`, `tests/test_bisagras_tirador.test.ts` y `tests/test_cocina.test.ts`.
- **Ranura de trasera** (`common.ts`, `encajeTrasera()`): clóset, cajonera, cocina y librero encastran la trasera de 3 mm en una ranura de 5.7 × 9 mm a 15 mm del borde del dorso (`trasera_ranura`, `ranura_ancho`, `ranura_profundidad`, `ranura_distancia`); la trasera crece 2 × profundidad, las repisas de clóset y librero se recortan, el travesaño de la cajonera va por delante y en la cocina la ranura va en costados, base y travesaño trasero (con la caja del cajón terminando en la cara frontal de la trasera). Medidas `por revisar` con el taller. Suite en `tests/test_trasera_ranura.test.ts`.
- **Tabla de pesos de tiradores** (`PESOS_TIRADOR_REFERENCIA` en `bisagras.ts`): 96 mm SKU 103910 y 128 mm SKU 103911/103916, todos 0.09 kg según sus fichas.
- **Lista de verificación del lado físico** (`docs/verificacion-lados-piezas.md`): una fila por pieza de los seis módulos, con el canto marcado, el lado esperado y casilla para el taller. Desde el 2026-10-30 cada fila detalla **dónde declara el JSON el lado físico** (`cantos`, `funcion`, `mecanizado.ranuras[].cara`/`distancia`, `barrenos[].cara`/`horizontal`, `veta`, `rol`), con el texto de `funcion` copiado del generador.
- **Ranura y fondo del cajón** (2026-10-30): `encajeTrasera()` recibe el espesor de la trasera, la rechaza si la ranura no la admite y devuelve la holgura del panel (2.7 mm); `fondoUtilCajon()` fija el fondo libre de la caja del cajón en cajonera y cocina, y la cocina publica `fondo_util_cajon` y `largo_caja_cajon` en `medidas`. Suite: `tests/test_trasera_ranura.test.ts` (fondo útil 441.3 → corredera de 400 mm con ranura frente a 459 → 450 mm con la trasera clavada).
- **Pieza máxima girada** (`validateParts` en `src/profiles.ts` y `src/engine/profiles.ts`): el
  puente al motor comparaba eje por eje y el demo marcaba `pieza-sobre-maximo` en piezas que
  caben giradas (costado de 600 × 2400 mm del clóset, lateral de 300 × 2000 mm del librero).
  Ahora compara lado mayor contra 2480 y menor contra 1810, igual que `cabe()` y
  `validarConPerfil`. Suites: `tests/profiles.test.ts`.
- Pendiente: confirmar el lado físico de cada canto y las medidas de la ranura con el taller, y enlazar con las ramas `optimizer-engine` y `mcp-server`.
