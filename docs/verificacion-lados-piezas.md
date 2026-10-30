# Lista de verificación: lado físico de cada pieza exportada

Para confirmar **con el taller** qué lado de cada pieza es el frente (o el arriba)
antes de mandar el despiece a Cortecloud o a la máquina. Nace del pendiente del
repo: el JSON de Cortecloud no declara en qué orientación se dibujó cada pieza,
así que un canto «frontal» puede terminar en el dorso si la pieza se cargó girada.

- **Rama:** `parametric-modules`
- **Fecha de la lista:** 2026-10-29; medidas de cocina y librero actualizadas el
  2026-10-30 al encastrar su trasera en ranura y **declaración del JSON** de cada
  pieza detallada el 2026-10-30.
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

## Dónde declara el JSON el lado físico

El JSON de cada pieza (`Pieza.toDict()`) **no tiene un campo `frente` ni
`arriba`**: el lado físico se declara hoy en estos campos, y esta lista los
transcribe pieza por pieza para que el taller los confirme.

| Campo del JSON | Qué declara | Ejemplo |
| --- | --- | --- |
| `largo` / `ancho` | medidas de corte; el `largo` va en vertical en el dibujo | `"largo": 800, "ancho": 500` |
| `cantos` | arista con canto, por nombre geométrico | `"cantos": {"largo_a": "PVC 0.4 mm"}` |
| `funcion` | **el lado físico en palabras**: «canto en la arista frontal / superior / inferior», «va al dorso» | `"Costado — canto en la arista frontal…"` |
| `mecanizado.ranuras[].cara` y `.distancia` | de qué cara se fresa y a qué distancia del borde (con la trasera, fija el dorso) | `{"cara": "i", "distancia": 15}` |
| `mecanizado.barrenos[].cara` y `.horizontal` | cara del barreno y si va en el canto | `{"cara": "i", "horizontal": true}` |
| `veta` | sentido de la veta respecto de `largo` / `ancho` | `"vertical"` en el motor, `"largo"` en la pieza |
| `rol` | papel de la pieza en el mueble | `"costado"`, `"trasera"` |

Ninguno de esos campos viaja al formato de Cortecloud: `c1`/`c2`/`l1`/`l2` son
**solo geométricos**. Por eso `funcion` es la declaración que hay que verificar, y
por eso el lado físico de cada fila se copia aquí tal cual sale del generador.

## Cajonera (`cajonera`, 450 x 800 x 500 mm)

| Pieza | Medidas (largo × ancho, mm) | Declaración en el JSON | Lado físico a confirmar | OK / Corregir |
| --- | --- | --- | --- | --- |
| Costado (×2) | 800 × 500 | `cantos.largo_a` · `funcion`: «Costado — canto en la arista frontal, ranura para la trasera a 15.0 mm del borde del dorso» · `mecanizado.ranuras[0]`: `cara i, distancia 15` | la arista de 500 mm va al **frente** del mueble | ☐ |
| Base | 500 × 414 | `cantos.ancho_a` · `funcion`: «Base entre costados — canto en la arista frontal, ranura para la trasera» | la arista de 414 mm va al **frente** | ☐ |
| Tapa | 500 × 414 | `cantos.ancho_a` · `funcion`: «Tapa entre costados — canto en la arista frontal, ranura para la trasera» | la arista de 414 mm va al **frente** | ☐ |
| Travesaño trasero | 414 × 100 | sin `cantos` ni `mecanizado` · `funcion`: «Travesaño trasero de rigidez, entre costados» | va **al dorso**, arriba entre costados | ☐ |
| Trasera | 782 × 432 | sin cantos · `funcion`: «Trasera encastrada en la ranura de costados, base y tapa» | encastrada en la ranura a **15 mm del dorso** | ☐ |
| Frente de cajón (×4) | 197,75 × 450 | `cantos` las 4 aristas · `funcion`: «Frente de cajón cubriente — canto en las 4 aristas» | cara **vista** hacia afuera; `ancho_a` arriba | ☐ |
| Lateral de cajón (×8) | 450 × 177,75 | `cantos.largo_a` · `funcion`: «Lateral de cajón: canto en la arista superior» | la arista de 450 mm va **arriba** | ☐ |
| Frente interior de cajón (×4) | 353 × 177,75 | sin cantos · `funcion`: «Frente interior de cajón, entre laterales (bajo el frente cubriente)» | va **detrás** del frente cubriente | ☐ |
| Trasera de cajón (×4) | 353 × 177,75 | sin cantos · `funcion`: «Trasera de cajón, entre laterales» | va **al dorso** de la caja | ☐ |
| Piso de cajón (×4) | 450 × 389 | sin cantos · `funcion`: «Piso de cajón, clavado/atornillado bajo la caja» | clava/atornilla **por debajo** de la caja | ☐ |

## Clóset (`closet`, 1500 x 2400 x 600 mm)

| Pieza | Medidas (largo × ancho, mm) | Declaración en el JSON | Lado físico a confirmar | OK / Corregir |
| --- | --- | --- | --- | --- |
| Costado (×2) | 2400 × 600 | `cantos.largo_a` · `funcion`: «Costado — canto en la arista frontal, ranura para la trasera a 15.0 mm del borde del dorso» | la arista de 600 mm va al **frente** | ☐ |
| Base | 600 × 1464 | `cantos.ancho_a` · `funcion`: «Base entre costados — canto en la arista frontal, ranura para la trasera» | la arista de 1464 mm va al **frente** | ☐ |
| Tapa | 600 × 1464 | `cantos.ancho_a` · `funcion`: «Tapa entre costados — canto en la arista frontal, ranura para la trasera» | la arista de 1464 mm va al **frente** | ☐ |
| Repisa (×3) | 579,3 × 1464 | `cantos.ancho_a` · `funcion`: «Repisa entre costados — canto en la arista frontal, recortada contra la trasera encastrada» | la arista de 1464 mm va al **frente**; el dorso queda recortado | ☐ |
| Puerta batiente (×2) | 2397 × 748,5 | `cantos` las 4 aristas · `funcion`: «Puerta batiente cubriente — canto en las 4 aristas» | lado de **bisagra** y lado de **tirador** de cada hoja | ☐ |
| Trasera | 2382 × 1482 | sin cantos · `funcion`: «Trasera encastrada en la ranura de costados, base y tapa» | encastrada en la ranura a **15 mm del dorso** | ☐ |

## Cocina (`cocina`, módulo bajo 600 x 900 mm, costado de 582 mm)

| Pieza | Medidas (largo × ancho, mm) | Declaración en el JSON | Lado físico a confirmar | OK / Corregir |
| --- | --- | --- | --- | --- |
| Costado (×2) | 800 × 582 | `cantos.largo_a` · `funcion`: «Costado — canto en la arista frontal, ranura para la trasera a 15.0 mm del borde del dorso» | la arista de 582 mm va al **frente** | ☐ |
| Base | 582 × 564 | `cantos.ancho_a` · `funcion`: «Base entre costados — canto en la arista frontal, ranura para la trasera» | la arista de 564 mm va al **frente** | ☐ |
| Travesaño frontal | 564 × 100 | sin `cantos` ni `mecanizado` · `funcion`: «Barra de armar frontal, arriba entre costados» | va **al frente**, arriba entre costados | ☐ |
| Travesaño trasero | 564 × 100 | sin cantos · `funcion`: «Barra de armar trasera, arriba entre costados, ranura para la trasera» · `mecanizado.ranuras[0]`: `cara i, distancia 15` | va **al dorso**, arriba entre costados | ☐ |
| Zócalo frontal | 600 × 100 | `cantos.largo_a` · `funcion`: «Zócalo frontal — canto en la arista superior» | la arista de 600 mm va **arriba** | ☐ |
| Zócalo lateral (×2) | 507 × 100 | sin cantos · `funcion`: «Zócalo lateral, retranqueado al frente» | retranqueado **al frente** | ☐ |
| Trasera | 782 × 582 | sin cantos · `funcion`: «Trasera encastrada en la ranura de costados, base y travesaño trasero» | encastrada en la ranura a **15 mm del dorso** | ☐ |
| Puerta cubriente (×2) | 797 × 298,5 | `cantos` las 4 aristas · `funcion`: «Puerta cubriente — canto en las 4 aristas» | cara **vista** hacia afuera | ☐ |

Con cajones en vez de puertas, la cocina agrega los frentes de cajón (197,75 × 600
mm, cuatro aristas) y la caja de cajón del fixture, con las mismas declaraciones
que la cajonera.

## Escritorio (`escritorio`, 1200 x 600 x 750 mm)

| Pieza | Medidas (largo × ancho, mm) | Declaración en el JSON | Lado físico a confirmar | OK / Corregir |
| --- | --- | --- | --- | --- |
| Cubierta | 600 × 1200 | `cantos.ancho_a`, `largo_a` y `largo_b` · `funcion`: «Cubierta del escritorio — canto en el frente y los dos costados» | `ancho_a` es el **frente**; el dorso queda sin canto | ☐ |
| Costado (×2) | 732 × 600 | `cantos.largo_a` · `funcion`: «Costado del escritorio — canto en la arista frontal» | la arista de 600 mm va al **frente** | ☐ |
| Faldón | 1164 × 100 | `cantos.ancho_b` · `funcion`: «Faldón frontal entre costados — canto en la arista inferior (100 mm, ≥ 70 mm)» | el canto va **abajo**; la cara vista al frente | ☐ |
| Travesaño trasero | 1164 × 100 | sin cantos · `funcion`: «Travesaño trasero de rigidez entre costados — permite fijar a muro» | va **al dorso** (fijación a muro) | ☐ |

## Librero (`librero`, 800 x 2000 x 300 mm)

| Pieza | Medidas (largo × ancho, mm) | Declaración en el JSON | Lado físico a confirmar | OK / Corregir |
| --- | --- | --- | --- | --- |
| Costado (×2) | 2000 × 300 | `cantos.largo_a` y `ancho_a` · `funcion`: «Costado — canto frontal y canto en la arista superior, ranura para la trasera a 15.0 mm del borde del dorso» | canto de 300 mm al **frente** y canto de 2000 mm **arriba** | ☐ |
| Base | 300 × 764 | `cantos.ancho_a` · `funcion`: «Base entre costados — canto en la arista frontal, ranura para la trasera» | la arista de 764 mm va al **frente** | ☐ |
| Tapa | 300 × 764 | `cantos.ancho_a` · `funcion`: «Tapa entre costados — canto en la arista frontal, ranura para la trasera» | la arista de 764 mm va al **frente** | ☐ |
| Repisa (×4) | 279,3 × 764 | `cantos.ancho_a` · `funcion`: «Repisa entre costados — canto en la arista frontal, recortada contra la trasera encastrada» | la arista de 764 mm va al **frente**; el dorso queda recortado | ☐ |
| Trasera | 1982 × 782 | sin cantos · `funcion`: «Trasera encastrada en la ranura de costados, base y tapa (rigidiza el librero)» | encastrada en la ranura a **15 mm del dorso** (rigidiza el librero) | ☐ |

## Cajón individual (`cajon`, 600 x 500 x 150 mm)

| Pieza | Medidas (largo × ancho, mm) | Declaración en el JSON | Lado físico a confirmar | OK / Corregir |
| --- | --- | --- | --- | --- |
| Lateral (×2) | 500 × 150 | `cantos.largo_a` · `funcion`: «Lateral del cajón — canto en la arista superior, ranura para el fondo, excentricas minifix Ø15 a 50 mm de cada orilla» · `mecanizado.barrenos`: 4 verticales Ø15 | la arista de 500 mm va **arriba**; cara interior fresada | ☐ |
| Frente | 564 × 150 | `cantos.largo_a` · `funcion`: «Frente del cajón entre laterales — canto en la arista superior, ranura para el fondo, pines minifix Ø7 mm en los cantos» · 4 barrenos horizontales | la arista de 564 mm va **arriba**; cara vista al frente; pines en el **canto** | ☐ |
| Trasera | 564 × 150 | sin cantos · `funcion`: «Trasera del cajón entre laterales — sin canto, ranura para el fondo, pines minifix Ø7 mm en los cantos» | va **al dorso** del cajón | ☐ |
| Fondo | 584 × 484 | sin cantos · `funcion`: «Fondo del cajón en ranura — panel delgado insertado en los canales de laterales, frente y trasera» | entra en la **ranura** de laterales, frente y trasera | ☐ |

## Piezas donde la lectura es más frágil

Estas no llevan canto que las delate y dependen de cómo se dibujó la pieza:

1. **Traseras encastradas** (clóset, cajonera, cocina y librero): la ranura está a
   15 mm del borde del dorso; confirmar que ese borde queda al fondo del mueble.
   En el JSON la única pista es `mecanizado.ranuras[0].distancia` en las piezas
   que la llevan; la trasera misma va sin cantos.
2. **Travesaños** (cajonera, cocina, escritorio): confirmar cuál es el travesaño
   frontal y cuál el trasero cuando los dos miden lo mismo (cocina: 564 × 100).
   El trasero de la cocina se distingue solo por su `funcion` y por la ranura.
3. **Faldón del escritorio**: el canto va en `ancho_b` (abajo); confirmar que no
   se espera el canto arriba.
4. **Piso de cajón y frentes de cajón de la cajonera**: no llevan canto; confirmar
   la cara que se ve.
5. **Piezas del cajón con minifix**: los barrenos declaran `cara: "i"` y
   `horizontal: true`, pero el JSON no dice hacia qué lado del canto entran;
   confirmar que los pines quedan en el canto que mira al lateral.

## Qué hacer con el resultado

- Si el taller confirma la lectura: marcar la fila `OK` y actualizar la fecha de
  esta lista; el estado de `docs/por-revisar.md` pasa a *verificado en taller*.
- Si corrige un lado: cambiar el `Cantos`/`funcion` de la pieza en el generador,
  ajustar la prueba que la cubre y actualizar la tabla de esta lista.
- La lectura física se guarda en `funcion`; el mapeo a `c1`/`c2`/`l1`/`l2` está en
  `src/modules/cortecloud.ts`. Cuando el taller confirme los seis módulos, el
  siguiente paso es agregar al JSON un campo propio (`lado_frente` / `lado_arriba`)
  en lugar de depender del texto libre.

## Estado en la documentación

- `docs/por-revisar.md` → fila «Lado físico de cada canto al exportar»: **por revisar**,
  con esta lista como fuente de la verificación pendiente.
- `docs/modulos-parametricos.md` → sección de cantos: enlaza a esta lista.
- `docs/memoria/MEMORIA.md` → pendiente registrado desde 2026-10-29.

## Registro del taller

| Fecha | Taller / persona | Piezas revisadas | Resultado |
| --- | --- | --- | --- |
| | | | |
