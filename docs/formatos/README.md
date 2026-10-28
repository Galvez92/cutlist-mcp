# Formatos de importación / exportación

Estado de cada formato, con la documentación pública consultada. Regla del
proyecto: **no se inventan formatos**; lo que no se pudo verificar en fuentes
públicas se marca **por revisar** con el enlace a la fuente y viaja con la lista
de corte como aviso (ver `CutList.avisos` / `porRevisar()` de `src/formats/index.ts`).

| Formato | Clave | Dirección | Estado | Documentación |
|---|---|---|---|---|
| Cortecloud (JSON) | `cortecloud` | importar + exportar | parcial | [cortecloud.md](cortecloud.md) |
| CSV genérico (propio) | `csv_generico` | importar + exportar | verificado | [csv-generico.md](csv-generico.md) |
| SketchUp / OpenCutList (CSV) | `opencutlist` | importar + exportar | parcial | [opencutlist.md](opencutlist.md) |
| PolyBoard (lista de corte CSV/TXT) | `polyboard` | sólo importar | parcial | [polyboard.md](polyboard.md) |
| Promob (listado TXT/CSV) | `promob` | sólo importar | por revisar | [promob.md](promob.md) |
| PRO100 (listado TXT/CSV) | `pro100` | sólo importar | por revisar | [pro100.md](pro100.md) |
| DXF (ASCII R12) | `dxf` | importar + exportar | parcial | [dxf.md](dxf.md) |

- **verificado**: la estructura del archivo está especificada en documentación
  pública (o es definida por este proyecto) y hay pruebas que la cubren.
- **parcial**: la interfaz existe y está documentada, pero parte del contenido
  (columnas por defecto, unidades, opciones) no pudo verificarse.
- **por revisar**: sólo se conocen los rasgos generales del archivo; hasta tener
  una muestra real, el importador exige declarar las columnas.

## Uso

```ts
import { importar, exportar, importarArchivo, listarFormatos } from "../../src/formats/index.js";

const lista = importarArchivo("proyecto.json");          // deduce por extensión
const lista2 = importar(texto, "promob", {
  columnas: ["nombre", "cantidad", "largo", "ancho", "espesor"],
});
console.log(lista.totalPiezas, lista.areaTotalM2);

for (const aviso of lista.porRevisar()) {                // lo no verificado, con fuente
  console.log(aviso.mensaje, aviso.fuente);
}

const textoCsv = exportar(lista, "csv_generico");
```

Para exportar DXF hace falta un `LayoutResult` (resultado del motor: hojas con
piezas colocadas), no una lista de piezas:

```ts
import { exportar } from "../../src/formats/index.js";
import type { LayoutResult } from "../../src/types.js";

// El DXF se exporta desde un LayoutResult del motor (hojas con piezas
// colocadas), no desde una lista de piezas:
const layout: LayoutResult = optimizar(/* partes, tableros */);
const dxf = exportar(layout, "dxf");
```

## Qué falta (por revisar)

- Cortecloud: unidad de medida y semántica de `c`/`l` no declaradas en la guía.
- OpenCutList: títulos de columna nativos y uso de unidades en la exportación real.
- PolyBoard: conjunto/orden de columnas y decimales por defecto; efecto de
  «overall vs net» y del sobredimensionado.
- Promob: esquema del XML de listagem y columnas por defecto del CSV de Cut Pro.
- PRO100: layout del listado exportado (nombres de columna, orden, separador).
- DXF: sólo rectángulos alineados a los ejes; sin bloques ni arcos.

Ver también `tests/fixtures/README.md` para saber qué fixtures son reales y
cuáles son ejemplos construidos a partir de la estructura documentada.
