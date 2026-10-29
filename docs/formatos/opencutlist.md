# SketchUp / OpenCutList (CSV)

Clave: `opencutlist` · Dirección: importar y exportar · Estado: **parcial**

## Fuentes

- Exportar a CSV o XLSX: <https://docs.opencutlist.org/features/parts/export-to-csv>
  (separador tabulador, coma o punto y coma; codificación configurable, UTF-8
  recomendado; se exporta la *List of Instances*, la *Parts List* o el *Summary*).
- Importar CSV: <https://docs.opencutlist.org/features/import>
  (campos obligatorios **Designation, Length, Width, Thickness**; opcionales
  **Quantity, Material, Tags**; sin columna de cantidad se asume 1; sin unidad,
  las dimensiones se interpretan en las unidades del modelo).
- Columnas y fórmulas: <https://docs.opencutlist.org/features/parts/export-to-csv/customization>
  (los títulos, el orden y el contenido son configurables con un editor de
  fórmulas en Ruby).

## Lo que hacemos

Exportar, con los títulos documentados y en el orden que OpenCutList reconoce:

```csv
Designation;Length;Width;Thickness;Quantity;Material;Tags
```

Importar: se reconocen los encabezados de esos campos (en inglés o español) con
separador `;`, `,` o tabulador, y se exige el cuarteto obligatorio documentado.

```ts
import { importar, exportar } from "../../src/formats/index.js";

const lista = importar(textoCsv, "opencutlist");
let texto = exportar(lista, "opencutlist");                  // ; y decimal punto
texto = exportar(lista, "opencutlist", { incluirEtiquetas: false });
```

## Por revisar

- Los títulos de columna de una exportación real son configurables y traducibles:
  no se pudo verificar cuál es el texto por defecto que escribe OpenCutList.
- Las dimensiones se escriben sin unidad; OpenCutList las interpreta en las
  unidades del modelo, así que al importar hay que elegir milímetros.
- El archivo `.skp` (binario propietario de SketchUp) **no** se lee: el camino
  soportado es la exportación CSV de OpenCutList.

## Pruebas

`tests/opencutlist.test.ts`: columnas obligatorias y opcionales, cantidad asumida
1, otros separadores, encabezados en español, ida y vuelta y errores.
