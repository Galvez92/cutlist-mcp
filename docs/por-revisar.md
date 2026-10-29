# Por revisar

Datos y formatos **no verificados**, con la fuente consultada. Regla del repo: nada
inventado; lo que no se puede comprobar se marca aquí y en el código (`// por revisar`).

Fecha de esta revisión: 2026-10-27 (rama `demo-web-docs`); cantos y ejes de Cortecloud
verificados el 2026-10-29 (rama `parametric-modules`).

## Verificado con fuente

| Tema | Fuente | Nota |
| --- | --- | --- |
| CSV (lista de corte y posiciones) | [RFC 4180](https://www.rfc-editor.org/rfc/rfc4180) | Fin de línea CRLF, comillas dobles para campos con coma/comilla/salto, comilla escapada `""`, MIME `text/csv`. |
| SVG del layout | [SVG 1.1 (W3C)](https://www.w3.org/TR/SVG11/) | `viewBox` en milímetros; `xmlns` incluido para que el archivo se abra solo. |
| PDF del layout | [pdf-lib](https://pdf-lib.js.org/) | PDF 1.7; las pruebas lo vuelven a leer con `pdf-lib` (páginas y tamaño de página). |
| Medidas y espesores del fixture | `tests/fixtures/cortecloud/escritorio_D_simple.json` | 21 líneas, 30 piezas, 2 materiales 2500×1830×18. |
| Campos `c` y `l` | [Guía oficial de importación JSON (Cortecloud/Serrabits)](https://apis.cortecloud.com.br/docs/es/guias/importacao-json/) | Tabla de campos: `c` = largo y `l` = ancho, en milímetros. |
| Lados de canto `c1`,`c2`,`l1`,`l2` | [Sistema de coordenadas de la guía oficial](https://cortecloud.com/api-docs/en/guias/json_import/#part-coordinate-system) | Pieza vista por la cara interna; esquinas 0 superior izquierda, 1 inferior izquierda, 2 inferior derecha, 3 superior derecha. `c1` = segmento 0-1 (largo izquierda), `l1` = 1-2 (ancho inferior), `c2` = 2-3 (largo derecha), `l2` = 3-0 (ancho superior). |

## Por revisar (sin documentación pública encontrada)

| Tema | Fuente consultada | Qué se asume hoy |
| --- | --- | --- |
| Formato Cortecloud `{"parts":[...]}` | Muestra real del repo (`tests/fixtures/cortecloud/`) y `docs/memoria/MEMORIA.md` | No se encontró documentación pública oficial. La lectura se basa en la muestra. |
| Campos `c` y `l` | misma muestra | `c` → alto y `l` → ancho. La demo permite intercambiarlos (`swap`). |
| Canto `c1`,`c2`,`l1`,`l2` | misma muestra | Convención documentada: `c1` = arista del largo izquierda, `c2` = del largo derecha, `l1` = del ancho inferior, `l2` = del ancho superior (ver la tabla de *Verificado con fuente*). El largo total de canto es exacto; el lado físico depende de cómo se dibujó la pieza. |
| Espesor y medida del tablero | texto de `material` | Se leen con expresiones regulares (`18 mm`, `(2500x1830)`). Es una heurística. |
| `machining` | misma muestra | Solo se usa su presencia/ausencia (`machined`), no su contenido (trae `{x, y, z, start...}`). |
| Veta | ninguna | El formato no declara veta: las piezas se importan como `grain: 'none'` (pueden girar). |
| Perfil de restricciones Cortecloud / Madijal | `docs/memoria/MEMORIA.md` | Observaciones de uso real (pieza mínima 65 mm, mecanizada ≥ 250 mm, máximo 2480×1810, tablero 2500×1830×18), **no** reglas del motor ni documentación del proveedor. Solo genera avisos. |
| Kerf por defecto 4 mm | ninguna | Valor de partida editable en la demo; debe ajustarse al disco de la máquina. |
| Descuento de canto en el perfil | `docs/memoria/MEMORIA.md` | El mínimo se compara contra el lado terminado (lado corto − 2 × canto). Aproximación. |
| Un `Kerf` único por corrida | decisión de diseño | El motor usa un solo kerf; no modela kerf distinto por sentido de corte. |

## Pendiente en otras ramas

| Tema | Rama dueña |
| --- | --- |
| Motor completo (algoritmos, perfiles, validaciones) | `motor-optimizador` |
| Importadores/exportadores: Promob, CSV genérico, SketchUp/OpenCutList, Polyboard, Pro100, DXF | `formatos-import-export` |
| Servidor MCP y módulos paramétricos | `mcp-server`, `modulos-parametricos` |

## Cómo marcar algo nuevo

1. Añade la fila aquí con la fuente consultada (enlace) o «ninguna».
2. En el código, un comentario `// por revisar: <motivo o enlace>`.
3. Si la duda afecta a lo que ve el usuario, menciónalo en la UI (la demo ya muestra los
   avisos del perfil y el aviso de importación).
