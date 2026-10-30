# Lista de verificación: lado físico de cada pieza exportada

Para confirmar **con el taller** qué lado de cada pieza es el frente (o el arriba)
antes de mandar el despiece a Cortecloud o a la máquina. Nace del pendiente del
repo: el JSON de Cortecloud no declara en qué orientación se dibujó cada pieza,
así que un canto «frontal» puede terminar en el dorso si la pieza se cargó girada.

- **Rama:** `parametric-modules`
- **Fecha de la lista:** 2026-10-29 (medidas de cocina y librero actualizadas el
  2026-10-30 al encastrar su trasera en ranura)
- **Medidas:** las que genera cada módulo con sus **parámetros por omisión**
  (se recalculan solas si cambia el módulo; esta lista sirve para verificar la
  *lectura*, no las medidas).
- **Cómo marcar:** `OK` si el lado declarado coincide con el físico; `Corregir`
  con la observación del taller si no. Una fila sin marcar queda pendiente.

## Convención de lectura

Pieza vista por la **cara interna**, como en la guía de
[Cortecloud](https://cortecloud.com/api-docs/en/guias/json_import/#part-coordinate-system):

| Arista del repo | Lado del motor | Lado Cortecloud |
| --- | --- | --- |
| `largo_a` | izquierda | `c1` (segmento 0-1) |
| `largo_b` | derecha | `c2` (2-3) |
| `ancho_a` | arriba | `l2` (3-0) |
| `ancho_b` | abajo | `l1` (1-2) |

En las piezas **verticales** (costados) el frente del mueble se marca en `largo_a`;
en las **horizontales** (base, tapa, repisas, zócalo) en `ancho_a`.

## Cajonera (`cajonera`, 450 x 800 x 500 mm)

| Pieza | Medidas (largo × ancho, mm) | Cantos declarados | Lado físico a confirmar | OK / Corregir |
| --- | --- | --- | --- | --- |
| Costado (×2) | 800 × 500 | `largo_a` | la arista de 500 mm va al **frente** del mueble | ☐ |
| Base | 500 × 414 | `ancho_a` | la arista de 414 mm va al **frente** | ☐ |
| Tapa | 500 × 414 | `ancho_a` | la arista de 414 mm va al **frente** | ☐ |
| Travesaño trasero | 414 × 100 | sin canto | va **al dorso**, arriba entre costados | ☐ |
| Trasera | 782 × 432 | sin canto | encastrada en la ranura a **15 mm del dorso** | ☐ |
| Frente de cajón (×4) | 197,75 × 450 | las 4 aristas | cara **vista** hacia afuera; `ancho_a` arriba | ☐ |
| Lateral de cajón (×8) | 450 × 177,75 | `largo_a` | la arista de 450 mm va **arriba** | ☐ |
| Frente interior de cajón (×4) | 353 × 177,75 | — | va **detrás** del frente cubriente | ☐ |
| Trasera de cajón (×4) | 353 × 177,75 | — | va **al dorso** de la caja | ☐ |
| Piso de cajón (×4) | 450 × 389 | — | clava/atornilla **por debajo** de la caja | ☐ |

## Clóset (`closet`, 1500 x 2400 x 600 mm)

| Pieza | Medidas (largo × ancho, mm) | Cantos declarados | Lado físico a confirmar | OK / Corregir |
| --- | --- | --- | --- | --- |
| Costado (×2) | 2400 × 600 | `largo_a` | la arista de 600 mm va al **frente** | ☐ |
| Base | 600 × 1464 | `ancho_a` | la arista de 1464 mm va al **frente** | ☐ |
| Tapa | 600 × 1464 | `ancho_a` | la arista de 1464 mm va al **frente** | ☐ |
| Repisa (×3) | 579,3 × 1464 | `ancho_a` | la arista de 1464 mm va al **frente**; el dorso queda recortado | ☐ |
| Puerta batiente (×2) | 2397 × 748,5 | las 4 aristas | lado de **bisagra** y lado de **tirador** de cada hoja | ☐ |
| Trasera | 2382 × 1482 | sin canto | encastrada en la ranura a **15 mm del dorso** | ☐ |

## Cocina (`cocina`, módulo bajo 600 x 900 mm)

| Pieza | Medidas (largo × ancho, mm) | Cantos declarados | Lado físico a confirmar | OK / Corregir |
| --- | --- | --- | --- | --- |
| Costado (×2) | 800 × 582 | `largo_a` | la arista de 582 mm va al **frente** | ☐ |
| Base | 582 × 564 | `ancho_a` | la arista de 564 mm va al **frente** | ☐ |
| Travesaño frontal | 564 × 100 | — | va **al frente**, arriba entre costados | ☐ |
| Travesaño trasero | 564 × 100 | — | va **al dorso**, arriba entre costados | ☐ |
| Zócalo frontal | 600 × 100 | `largo_a` | la arista de 600 mm va **arriba** | ☐ |
| Zócalo lateral (×2) | 507 × 100 | — | retranqueado **al frente** | ☐ |
| Trasera | 782 × 582 | — | encastrada en la ranura a **15 mm del dorso** | ☐ |
| Puerta cubriente (×2) | 797 × 298,5 | las 4 aristas | cara **vista** hacia afuera | ☐ |

## Escritorio (`escritorio`, 1200 x 600 x 750 mm)

| Pieza | Medidas (largo × ancho, mm) | Cantos declarados | Lado físico a confirmar | OK / Corregir |
| --- | --- | --- | --- | --- |
| Cubierta | 600 × 1200 | `ancho_a`, `largo_a`, `largo_b` | `ancho_a` es el **frente**; el dorso queda sin canto | ☐ |
| Costado (×2) | 732 × 600 | `largo_a` | la arista de 600 mm va al **frente** | ☐ |
| Faldón | 1164 × 100 | `ancho_b` | el canto va **abajo**; la cara vista al frente | ☐ |
| Travesaño trasero | 1164 × 100 | — | va **al dorso** (fijación a muro) | ☐ |

## Librero (`librero`, 800 x 2000 x 300 mm)

| Pieza | Medidas (largo × ancho, mm) | Cantos declarados | Lado físico a confirmar | OK / Corregir |
| --- | --- | --- | --- | --- |
| Costado (×2) | 2000 × 300 | `largo_a`, `ancho_a` | canto de 300 mm al **frente** y canto de 2000 mm **arriba** | ☐ |
| Base | 300 × 764 | `ancho_a` | la arista de 764 mm va al **frente** | ☐ |
| Tapa | 300 × 764 | `ancho_a` | la arista de 764 mm va al **frente** | ☐ |
| Repisa (×4) | 279,3 × 764 | `ancho_a` | la arista de 764 mm va al **frente**; el dorso queda recortado | ☐ |
| Trasera | 1982 × 782 | — | encastrada en la ranura a **15 mm del dorso** (rigidiza el librero) | ☐ |

## Cajón individual (`cajon`, 600 x 500 x 150 mm)

| Pieza | Medidas (largo × ancho, mm) | Cantos declarados | Lado físico a confirmar | OK / Corregir |
| --- | --- | --- | --- | --- |
| Lateral (×2) | 500 × 150 | `largo_a` | la arista de 500 mm va **arriba** | ☐ |
| Frente | 564 × 150 | `largo_a` | la arista de 564 mm va **arriba**; cara vista al frente | ☐ |
| Trasera | 564 × 150 | — | va **al dorso** del cajón | ☐ |
| Fondo | 584 × 484 | — | entra en la **ranura** de laterales, frente y trasera | ☐ |

## Piezas donde la lectura es más frágil

Estas no llevan canto que las delate y dependen de cómo se dibujó la pieza:

1. **Traseras encastradas** (clóset, cajonera, cocina y librero): la ranura está a
   15 mm del borde del dorso; confirmar que ese borde queda al fondo del mueble.
2. **Travesaños** (cajonera, cocina, escritorio): confirmar cuál es el travesaño
   frontal y cuál el trasero cuando los dos miden lo mismo (cocina: 564 × 100).
3. **Faldón del escritorio**: el canto va en `ancho_b` (abajo); confirmar que no
   se espera el canto arriba.
4. **Piso de cajón y frentes de cajón de la cajonera**: no llevan canto; confirmar
   la cara que se ve.

## Qué hacer con el resultado

- Si el taller confirma la lectura: marcar la fila `OK` y actualizar la fecha de
  esta lista; el estado de `docs/por-revisar.md` pasa a *verificado en taller*.
- Si corrige un lado: cambiar el `Cantos`/`funcion` de la pieza en el generador,
  ajustar la prueba que la cubre y actualizar la tabla de esta lista.
- La lectura física se guarda en `funcion`; el mapeo a `c1`/`c2`/`l1`/`l2` está en
  `src/modules/cortecloud.ts`.

## Estado en la documentación

- `docs/por-revisar.md` → fila «Lado físico de cada canto al exportar»: **por revisar**,
  con esta lista como fuente de la verificación pendiente.
- `docs/modulos-parametricos.md` → sección de cantos: enlaza a esta lista.
- `docs/memoria/MEMORIA.md` → pendiente registrado desde 2026-10-29.

## Registro del taller

| Fecha | Taller / persona | Piezas revisadas | Resultado |
| --- | --- | --- | --- |
| | | | |
