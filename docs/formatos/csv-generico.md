# CSV genérico (formato propio)

Clave: `csv_generico` · Dirección: importar y exportar · Estado: **verificado**
(especificado por este proyecto)

## Especificación

- Codificación UTF-8; una fila por línea; encabezado **obligatorio**.
- Separador por defecto `;` (se autodetecta entre `;`, `,`, tabulador y `|` al
  importar); decimal por defecto coma al exportar (Excel en español) y
  autodetectado al importar.
- Unidades: **milímetros** (mm).
- Convención de cantos: `canto_c1`/`canto_c2` son los lados del largo y
  `canto_l1`/`canto_l2` los del ancho (misma convención que Cortecloud); el valor
  es el texto del canto, vacío = sin canto.

Columnas, en el orden en que se exportan:

| Columna | Obligatoria | Contenido |
|---|---|---|
| `nombre` | sí | nombre de la pieza |
| `largo` | sí | largo en mm |
| `ancho` | sí | ancho en mm |
| `cantidad` | no (1) | unidades iguales de la pieza |
| `espesor` | no | espesor en mm |
| `material` | no | material (texto libre) |
| `veta` | no | `si`/`no` (vacío = desconocido) |
| `grupo` | no | módulo o complemento (como `complement` en Cortecloud) |
| `etiqueta` | no | etiqueta de taller |
| `notas` | no | texto libre |
| `canto_c1`, `canto_c2`, `canto_l1`, `canto_l2` | no | texto del canto |

Ejemplo (ver `tests/fixtures/csv_generico/piezas_basico.csv`):

```csv
nombre;largo;ancho;cantidad;espesor;material;veta;grupo;etiqueta;notas;canto_c1;canto_c2;canto_l1;canto_l2
Pata costado exterior acento der;732;600;1;18;Roble Americano 2 C 18 mm 719L ARAUCO (2500x1830);si;D01;A;doble 36;PVC 719L Roble Americano 0.4 x 22 mm REHAU ®;;PVC 719L Roble Americano 0.4 x 22 mm REHAU ®;
```

## Alias aceptados al importar

Los encabezados se reconocen por nombre (sin acentos ni mayúsculas) en español,
inglés y portugués: `nombre`/`name`/`nome`/`designation`/`pieza`…,
`largo`/`length`/`comprimento`, `ancho`/`width`/`largura`,
`cantidad`/`quantity`/`qtde`, `espesor`/`thickness`, `material`, `veta`/`grain`,
`grupo`/`complement`/`movel`, `notas`/`notes`, `etiqueta`/`tags`.

## Uso

```ts
import { importar, exportar } from "../../src/formats/index.js";

const lista = importar(texto, "csv_generico");                 // por defecto y autodetección
const lista2 = importar(texto, "csv_generico", { separador: ",", decimal: "." });
let texto = exportar(lista, "csv_generico");                    // ; y decimal coma
texto = exportar(lista, "csv_generico", { separador: ",", decimal: ".", unidad: true });
```

## Pruebas

`tests/csv-generico.test.ts`, incluida la ida y vuelta sin pérdida de datos y las
utilidades de tabla (números con coma, separadores, alias).
