# Cortecloud (JSON de piezas)

Clave: `cortecloud` · Dirección: importar y exportar · Estado: **parcial**

## Fuente

- Guía oficial «Importar JSON Cortecloud» (Serrabits):
  <https://cortecloud.com/api-docs/guias/json_import/>
- Muestra real saneada del proyecto usada en las pruebas:
  `tests/fixtures/cortecloud/escritorio_D_simple.json` (escritorio Atelier Simple
  1700x600x750, 22 líneas de piezas).

## Estructura documentada

```json
{
  "parts": [
    {
      "quantity": 1,
      "c": 500,
      "l": 500,
      "function": "Lateral",
      "complement": "Balcao A",
      "c1": "Branco 0.4",
      "c2": null,
      "l1": null,
      "l2": null,
      "material": "Branco 18",
      "machining": {
        "x": 500, "y": 500, "z": 18, "startSide": 0,
        "horizontalDrills": [], "verticalDrills": [],
        "furrowMachining": null, "furrowMachiningPair": null
      }
    }
  ]
}
```

Atributos de usinaje documentados (se conservan sin interpretar):

- `startSide`: 0 o 1; con 1 rota 90° toda la usinaje de la pieza.
- `horizontalDrills`: furos horizontales (en el canto superior); `direction` es
  `XP` o `YP`; `x` debe ser 0 para `XP` y `y` debe ser 0 para `YP`.
- `verticalDrills`: furos verticales (en la cara); `bolthole` indica si el furo es
  pasante.
- `corner`: canto de referencia para las medidas X/Y (0, 1, 2 o 3).
- `face`: `i` (cara interna) o `e` (cara externa); en furos horizontales siempre
  `i`.
- `z`: sólo en furos horizontales; posición respecto del espesor, medida desde la
  cara interna (para un furo al centro de una pieza de 15 mm, `z` = 7.5).
- `furrowMachining` / `furrowMachiningPair`: rasgo o rebaixo en la cara interna o
  externa; se realiza en el segmento 2-3 (C2); `width` es el ancho del rasgo y
  `distance` la distancia al borde.
- `depth` y `diameter`: profundidad y diámetro de furos, rasgos y rebaixos.

## Mapeo a nuestro modelo

| Cortecloud | `Pieza` |
|---|---|
| `function` | `nombre` |
| `c` | `largo` |
| `l` | `ancho` |
| `quantity` | `cantidad` |
| `complement` | `grupo` |
| `c1`,`c2`,`l1`,`l2` | `cantos["c1"…"l2"]` |
| `material` | `material` |
| `machining`, `startSide` | `extra` (tal cual, ida y vuelta fiel) |

El espesor no viene en el archivo: el importador lo deja en `null` (el material
suele llevarlo en el texto, pero no se parsea adivinando).

## Uso

```ts
import { importar, exportar } from "../../src/formats/index.js";

const lista = importar(textoJson, "cortecloud");
const jsonCortecloud = exportar(lista, "cortecloud");   // listo para cargar en Cortecloud
```

## Por revisar

- La guía oficial **no declara la unidad de medida**: se asume milímetro (mm).
- Leer `c` como largo y `l` como ancho se deduce de los «lados C1/C2/L1/L2» del
  diagrama oficial; conviene confirmarlo con Cortecloud/Serrabits.
- El bloque `machining` se conserva sin validar cotas ni geometría.
- El importador no vincula materiales automáticamente (decisión del proyecto).

## Pruebas

`tests/cortecloud.test.ts`: lectura del fixture real, mapeo de campos,
conservación de `machining`, avisos «por revisar» con fuente, ida y vuelta fiel
(`JSON.parse(exportar(importar(x)))` igual a `JSON.parse(x)`) y errores de formato.
