# Por revisar

Datos y formatos **no verificados**, con la fuente consultada. Regla del repo: nada
inventado; lo que no se puede comprobar se marca aquí y en el código (`// por revisar`).

Fecha de esta revisión: 2026-10-27 (rama `demo-web-docs`); cantos y ejes de Cortecloud
verificados el 2026-10-29, y bisagras del clóset y de la cocina (cantidad por alto
y por peso, revelado y copa) el 2026-10-29; los pesos publicados de los tiradores de
96 y 128 mm se consultaron y confirmaron el 2026-10-29; la ranura de la trasera y la
lista del lado físico de las piezas se agregaron el 2026-10-29 (rama `parametric-modules`).

## Verificado con fuente

| Tema | Fuente | Nota |
| --- | --- | --- |
| CSV (lista de corte y posiciones) | [RFC 4180](https://www.rfc-editor.org/rfc/rfc4180) | Fin de línea CRLF, comillas dobles para campos con coma/comilla/salto, comilla escapada `""`, MIME `text/csv`. |
| SVG del layout | [SVG 1.1 (W3C)](https://www.w3.org/TR/SVG11/) | `viewBox` en milímetros; `xmlns` incluido para que el archivo se abra solo. |
| PDF del layout | [pdf-lib](https://pdf-lib.js.org/) | PDF 1.7; las pruebas lo vuelven a leer con `pdf-lib` (páginas y tamaño de página). |
| Medidas y espesores del fixture | `tests/fixtures/cortecloud/escritorio_D_simple.json` | 21 líneas, 30 piezas, 2 materiales 2500×1830×18. |
| Campos `c` y `l` | [Guía oficial de importación JSON (Cortecloud/Serrabits)](https://apis.cortecloud.com.br/docs/es/guias/importacao-json/) | Tabla de campos: `c` = largo y `l` = ancho, en milímetros. |
| Lados de canto `c1`,`c2`,`l1`,`l2` | [Sistema de coordenadas de la guía oficial](https://cortecloud.com/api-docs/en/guias/json_import/#part-coordinate-system) | Pieza vista por la cara interna; esquinas 0 superior izquierda, 1 inferior izquierda, 2 inferior derecha, 3 superior derecha. `c1` = segmento 0-1 (largo izquierda), `l1` = 1-2 (ancho inferior), `c2` = 2-3 (largo derecha), `l2` = 3-0 (ancho superior). |
| Bisagras por alto de puerta | [Hettich *Sensys*, p. 14](https://web.hettich.com/fileadmin/media/Sensys_Catalogue_11309_en.pdf) | 2/3/4/5 bisagras hasta 900/1600/2000/2400 mm de alto, para puertas de hasta 600 mm de ancho (tablero de 19 mm, 750 kg/m³). |
| Bisagras por peso de puerta | [Blum, *CLIP top BLUMOTION: Number of hinges*](https://ea.blum.com/en/number-of-hinges/) | 2 bisagras para 4–6 kg y 3 para 6–12 kg, con el peso de la puerta y sus tiradores; vale hasta 600 mm de ancho. El módulo calcula el peso con área × espesor × densidad (750 kg/m³, el valor que publica Hettich) más el tirador (`peso_tirador`, 0.09 kg por omisión) y toma la mayor de las dos guías; sobre 12 kg avisa y deja la cantidad a revisar. |
| Peso del tirador de referencia (0.09 kg) | [Promart, ficha del tirador Orient recto de acero inoxidable 96 mm pulido, SKU 103910](https://www.promart.pe/tirador-recto-acero-inox-96mm/p) | «Peso Del Producto 0.09 kg», verificado el 2026-10-29. Es el peso publicado de **ese** tirador, no una regla de fabricante: los tiradores van de ~0.04 a ~0.5 kg según modelo y largo, así que el taller debe pasar el peso del tirador elegido en `peso_tirador` (y `0` si la puerta no lleva). |
| Peso del tirador de referencia de 128 mm (0.09 kg) | [Promart, tirador recto liviano 128 mm, SKU 103911](https://www.promart.pe/tirador-recto-acero-inoxidable-liviano-128mm/p) y [tirador recto pesado 128 mm, SKU 103916](https://www.promart.pe/tirador-recto-pesado-acero-inoxidable-128mm/p) | Las dos fichas publican «Peso Del Producto 0.09 kg», verificado el 2026-10-29: el mismo valor que el tirador de 96 mm y también para el modelo «pesado», señal de un peso redondeado. El taller debe pesar el tirador elegido. |
| Revelado mínimo y copa de la bisagra | [Blum, guía rápida](https://downloads2.cabinetparts.com/54af8d4d-ea85-4fdd-a601-1a0a31dbcd92.pdf), [Blum CLIP top](https://d2.blum.com/services/BEC003/cliptopbmn_fl_dok_bus_$sen-us_$aof_$v1.pdf), [Hettich *Sensys*, p. 14](https://web.hettich.com/fileadmin/media/Sensys_Catalogue_11309_en.pdf) | Puerta de 18 mm con la copa a 3 mm del borde: revelado mínimo 1.3 mm (Blum) / 0.6–0.8 mm (Hettich); entre dos puertas, ≥ 2 × el revelado. Copa Ø35 mm, distancia de copa 3–8 mm, espesor de puerta 15–24 mm. |

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
| Cantidad de bisagras con puertas de más de 600 mm de ancho | [Hettich *Sensys*, p. 14](https://web.hettich.com/fileadmin/media/Sensys_Catalogue_11309_en.pdf) | La tabla vale hasta 600 mm de ancho por hoja (Blum suma una bisagra entre 600 y 650 mm). Sobre eso el módulo avisa y deja la cantidad a revisar con el fabricante. |
| Ranura para la trasera: 9 mm de profundidad a 15 mm del borde del dorso | [Manual Técnico de Melamina #02](https://es.slideshare.net/slideshow/manual-tcnico-de-melamina-02pdfffffff/266978938) | Son las medidas con que ese manual de taller ranura el fondo de un cajón de 4 mm; no son una especificación de fabricante. Se usan por omisión en `ranura_profundidad` / `ranura_distancia` del clóset y la cajonera; confirmar con el taller. |
| Ancho de la ranura de la trasera (5.7 mm) | perfil Cortecloud/Madijal (`docs/memoria/MEMORIA.md`); el manual propone 4 mm | 5.7 mm es el menor ancho de ranura que admite ese perfil, pero para una trasera de 3 mm queda holgado. Es `ranura_ancho`, ajustable por módulo. |
| Lado físico (frente/arriba) de cada pieza exportada | [Lista de verificación para el taller](verificacion-lados-piezas.md) (2026-10-29) | El JSON no declara en qué orientación se dibujó la pieza. La lista recorre cada pieza de los seis módulos con su canto y el lado que se espera, para que el taller la confirme. |
| Traslape de 30 mm y juego de guía de 45 mm de las correderas | ninguna (los catálogos de correderas fijan su propio traslape y juego) | Valores de taller ajustables; hay que confirmarlos contra el sistema de correderas elegido. |

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
