# PolyBoard (lista de corte CSV/TXT)

Clave: `polyboard` · Dirección: **sólo importar** · Estado: **parcial**

## Fuentes

- Exportación de la lista de corte (Wood Designer):
  <https://wooddesigner.org/help-centre/polyboard-cutting-list-export/>
  — «Cutting list menu > CSV/TXT export» produce `.csv` o `.txt`; con
  «Cutting list options > Format» se eligen los campos, su orden y el separador
  (la captura de la documentación muestra `;`).
- Formatos para otras aplicaciones:
  <https://wooddesigner.org/formating-cutting-lists-for-other-applications/>
  — dos vías de salida: ASCII (CSV/TXT) y el «PP Report» de PolyBoard Pro.

## Uso

Como el archivo es configurable, el importador pide el orden de las columnas
(campos canónicos: `nombre`, `largo`, `ancho`, `cantidad`, `espesor`, `material`,
`veta`, `grupo`, `etiqueta`, `notas`, `canto_c1`, `canto_c2`, `canto_l1`,
`canto_l2`):

```ts
import { importar } from "../../src/formats/index.js";

let lista = importar(texto, "polyboard", {
  columnas: ["nombre", "largo", "ancho", "cantidad", "espesor", "material"],
});
lista = importar(texto, "polyboard", { encabezado: true });  // si el archivo trae cabecera
lista = importar(texto, "polyboard");                       // orden por defecto, avisa «por revisar»
```

Sin `columnas=` se usa un orden por defecto y la lista queda marcada con un aviso
«por revisar», porque ese orden no está publicado.

## Por revisar

- No hay conjunto ni orden de columnas por defecto publicados.
- Se asume separador `;` y decimal coma; ambos son configurables en PolyBoard.
- Las opciones *Overall vs net dimensions*, *Including oversizing* y
  *Grouped vs individual* cambian el contenido exportado (cotas brutas o netas,
  piezas idénticas agrupadas o sueltas); no está verificado cuál es la salida por
  defecto.
- No se implementa exportación: PolyBoard no documenta importar listas de corte
  externas (importa modelos DXF/3DS).

## Pruebas

`tests/listados.test.ts` (PolyBoard): lectura con columnas por defecto (con
aviso), con columnas declaradas, con encabezado real y errores de columnas/datos.
