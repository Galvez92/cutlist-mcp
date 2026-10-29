# Módulos paramétricos (cajonera, clóset, cocina, librero)

Convierte **medidas e ideas** en una **lista de piezas** con cantos, veta y
mecanizado, y la puede validar contra un **perfil de restricciones opcional**
(hoy: el perfil Cortecloud/Madijal registrado en `docs/memoria/MEMORIA.md`).

Esta capa es la entrada de la cadena descrita en la MEMORIA:
`medidas → módulo con piezas → optimizador → exportadores → servidor MCP`.
Aquí solo se resuelve el primer paso (piezas), que es lo que consumen las demás
ramas (`optimizer-engine`, `mcp-server`, `formatos-import-export`).

## Uso rápido

```ts
import { construirDesdeTexto } from "../src/modules/spec.js";

const modulo = construirDesdeTexto("cajonera ancho=450 alto=800 fondo=500 cajones=4");
console.log(modulo.tabla());        // lista de corte en texto plano
for (const hallazgo of modulo.validar()) {   // perfil Cortecloud/Madijal
  console.log(hallazgo.nivel, hallazgo.regla, hallazgo.mensaje);
}
```

```ts
import { generarModulo } from "../src/modules/index.js";

const modulo = generarModulo("closet", { ancho: 1800, alto: 2400, puertas: 3 });
const datos = modulo.toDictConPerfil();   // piezas, accesorios, notas y hallazgos
```

Sintaxis de las ideas escritas (propia de esta herramienta, **no** es un formato
de intercambio): `tipo clave=valor clave=valor`, con el tipo entre los alias de
`src/modules/index.js` (`clóset`, `placard`, `biblioteca`, `bajo mesada`, ...).
Las listas van en JSON (`posiciones_repisas=[500,1000]`), los booleanos aceptan
`si/no` y las cadenas con espacios van entre comillas (`nombre="Clóset pieza 2"`).

Las piezas generadas se bridgean al motor de optimización con
`Pieza.toPartInput()`/`toPart()` (width = ancho, height = largo, veta → grain,
cantos → `EdgeBanding`) y el perfil con `PerfilRestricciones.toConstraintProfile()`,
usando los tipos de `src/types.ts` (traídos de la rama `optimizer-engine`). El
reparto de las aristas geométricas a los lados absolutos del motor es
`por revisar` (no verificado contra el formato de Cortecloud).

## Convención de medidas y de cantos

- Todas las medidas exteriores son **de costado exterior a costado exterior**,
  criterio de modulación de ARAUCO (ver *Fuentes*).
- Cada pieza se define con `largo` y `ancho`, el vocabulario del despiece de
  Cortecloud registrado en la MEMORIA (`c` = largo, `l` = ancho).
- Las cuatro aristas se llaman `largo_a`, `largo_b` (las de longitud `largo`) y
  `ancho_a`, `ancho_b` (las de longitud `ancho`). El canto de una arista de
  longitud `largo` **engrosa el `ancho` terminado** de la pieza (y al revés),
  por eso la lista trae `largo_terminado` y `ancho_terminado`.
- Como el despiece no distingue izquierda/derecha y cada pieza y su espejo son
  la misma línea, el frente del mueble se marca siempre en la arista **`a`** del
  eje correspondiente: `largo_a` cuando el frente es una arista de longitud
  `largo` (piezas verticales: costados) y `ancho_a` cuando es de longitud
  `ancho` (piezas horizontales: base, tapa, repisas, zócalo). La lectura física
  va en `funcion` ("canto en la arista frontal", "canto en la arista superior").
- Equivalencia con Cortecloud (según su [sistema de
  coordenadas](https://cortecloud.com/api-docs/en/guias/json_import/#part-coordinate-system),
  pieza vista por la cara interna): `c1` = `largo_a` (segmento 0-1),
  `c2` = `largo_b` (2-3), `l1` = `ancho_b` (1-2, lado inferior) y `l2` = `ancho_a`
  (3-0, lado superior). La conversión vive en `src/modules/cortecloud.ts`
  (`cantosACortecloud` / `cantosDesdeCortecloud`).
- *Por revisar*: el JSON no dice en qué orientación se dibujó cada pieza, así que
  el lado **físico** (frente, arriba) sigue dependiendo de cómo se cargó la pieza
  en Cortecloud. Por eso la lectura física se guarda en `funcion`.

## Qué genera cada módulo

| Módulo | Cuerpo | Frente | Otros |
| --- | --- | --- | --- |
| `cajonera` | 2 costados, base y tapa entre costados, travesaño trasero de 100 mm, trasera de 3 mm | frentes cubrientes de cajón + caja de cajón (laterales, frente interior, trasera, piso) | correderas 400/450/500 mm, tiradores |
| `closet` | 2 costados, base y tapa, trasera de 3 mm | puertas batientes cubrientes o correderas traslapadas | repisas (repartidas o explícitas), barral, soportes Ø5 |
| `cocina` | 2 costados, base, travesaño frontal y trasero, trasera de 3 mm, zócalo retranqueado | puertas cubrientes o frentes de cajón (no se mezclan) | bisagras, correderas, patas regulables |
| `librero` | 2 costados (con canto frontal y superior), base y tapa entre costados, trasera de 3 mm | — | repisas, soportes Ø5 |

Las **cajas de cajón** siguen el despiece real del fixture Cortecloud: laterales
de `largo x alto` con canto en la arista superior, frente interior y trasera de
`(ancho exterior - 2 x espesor) x alto`, y piso de `largo x ancho exterior`.

Los herrajes y complementos (correderas, bisagras, barral, patas, tiradores) van
en `modulo.accesorios`, no como piezas de tablero.

## Bisagras y revelado de las puertas batientes (clóset)

La cantidad de bisagras y el revelado mínimo salen de catálogos de herraje:

- **Cantidad por alto de puerta** ([Hettich *Sensys*, p. 14, «Number of hinges
  per door»](https://web.hettich.com/fileadmin/media/Sensys_Catalogue_11309_en.pdf)):
  2 bisagras hasta 900 mm, 3 hasta 1600 mm, 4 hasta 2000 mm y 5 hasta 2400 mm.
  La guía vale para puertas de hasta 600 mm de ancho (Blum suma una bisagra
  entre 600 y 650 mm) y para tablero de 19 mm y 750 kg/m³.
- **Revelado mínimo** ([Blum, guía rápida de
  bisagras](https://downloads2.cabinetparts.com/54af8d4d-ea85-4fdd-a601-1a0a31dbcd92.pdf);
  [Hettich *Sensys*, p. 14](https://web.hettich.com/fileadmin/media/Sensys_Catalogue_11309_en.pdf)):
  una puerta de 18 mm con la copa a 3 mm del borde necesita 1.3 mm (Blum) o
  0.6–0.8 mm (Hettich, según la tabla del catálogo); entre dos puertas el total
  debe ser al menos el doble, 2.6 mm. El `juego` por omisión de 3 mm lo cumple.
- **Herraje**: copa Ø35 mm, distancia de copa de 3–8 mm y espesor de puerta de
  15–24 mm ([Blum CLIP
  top](https://d2.blum.com/services/BEC003/cliptopbmn_fl_dok_bus_$sen-us_$aof_$v1.pdf)).

`bisagrasPorPuerta()` aplica la tabla y el módulo avisa en `notas` cuando el caso
queda fuera de la guía: holgura menor que 2.6 mm, puertas de más de 2400 mm de
alto o de más de 600 mm de ancho. La cantidad no considera el peso de la puerta
(los catálogos piden 2 bisagras para 4–6 kg y 3 para 6–12 kg,
[Blum](https://ea.blum.com/en/number-of-hinges/)): ese dato el módulo no lo
modela y queda `por revisar`. Las correderas mantienen su traslape y juego de
guía `por revisar`, porque los fija el sistema elegido.

## Perfil de restricciones (opcional)

`src/modules/profiles.js` (`PERFIL_CORTECLOUD_MADIJAL`) transcribe el perfil de
ejemplo de la MEMORIA: pieza mínima de corte 65 mm (recomendado 70; terminada ≥ ~66
mm con canto de 0.4 mm), pieza mecanizada de largo ≥ 250 mm, pieza máxima
2480 x 1810 mm, tablero 2500 x 1830 x 18 mm, ranuras permitidas
5.7/6.2/6.7/7/9.7/12.7/15.7/18.7/25.7 mm, barrenos horizontales Ø 3/8" (9.525 mm) y
verticales Ø 3/5/8/10/15/20/35 mm.

```ts
import { PERFIL_CORTECLOUD_MADIJAL, validar } from "../src/modules/profiles.js";

const perfilTaller = PERFIL_CORTECLOUD_MADIJAL.con({ piezaMinCorte: 80.0 });
const hallazgos = validar(modulo.resumen(), perfilTaller);
```

Reglas y niveles: `error` (no fabricable en ese perfil) y `aviso` (revisar). El
perfil no cambia las medidas generadas: solo informa. La luz máxima entre apoyos
de una repisa (`luz_max_repisa_aviso`) viene **desactivada**: no hay fuente
verificada para un valor de carga.

## Fuentes y estado de los valores de referencia

| Valor | Uso | Fuente | Estado |
| --- | --- | --- | --- |
| 900 mm del piso a la cubierta; 100–150 mm bajo el módulo; retranqueo de zócalo ≥ 75 mm | mueble bajo de cocina | ARAUCO, *Cómo Diseñar y Construir Correctamente una Cocina* (serie Cómo Hacer 17) | verificado (documento público) |
| 600 mm de profundidad total = 580 mm de costado + 18 mm de puerta | mueble bajo de cocina | ARAUCO #17 | verificado |
| trasera de 3 mm; puertas de 18 mm; correderas de 40/50/60 cm | cocina | ARAUCO #17 | verificado |
| travesaños de 100 mm de ancho | cajonera y cocina | fixture real `tests/fixtures/cortecloud/escritorio_D_simple.json` | verificado (despiece del repo) |
| barrenos de repisa: Ø5, a 40–50 mm del borde, con 30 mm entre barrenos, una posición y dos arriba y dos abajo | clóset y librero | ARAUCO, *Cómo Instalar Repisas* (serie Cómo Hacer 6) | verificado |
| 65 mm mínimo de corte; 250 mm para piezas mecanizadas; 2480 x 1810 mm máximo; tablero 2500 x 1830 x 18; ranuras y barrenos permitidos | perfil Cortecloud/Madijal | `docs/memoria/MEMORIA.md` (restricciones observadas en uso real) | según la MEMORIA; **por revisar** contra el proveedor |
| juego de 3 mm entre puertas/frentes | todos | valor de taller; en el clóset cubre el revelado mínimo de la bisagra (≥ 2 × 1.3 mm) | clóset batiente: verificado como suficiente; cajonera y cocina: **por revisar** |
| juego de corredera 25 mm; margen de alto de caja 20 mm; juego de fondo 10 mm | cajonera y cocina | valor de taller | **por revisar** |
| profundidad del barreno de repisa 12 mm | clóset y librero | valor de taller | **por revisar** |
| traslape de 30 mm y juego de guía de 45 mm | clóset con correderas | valor de taller (lo fija el sistema de correderas elegido) | **por revisar** |
| 2/3/4/5 bisagras por puerta hasta 900/1600/2000/2400 mm de alto; puertas de hasta 600 mm de ancho; espesor de puerta 15–24 mm | clóset (la cocina sigue con su regla local de 2/3) | [Hettich *Sensys*, p. 14](https://web.hettich.com/fileadmin/media/Sensys_Catalogue_11309_en.pdf) y [Blum CLIP top](https://d2.blum.com/services/BEC003/cliptopbmn_fl_dok_bus_$sen-us_$aof_$v1.pdf) | verificado |
| revelado mínimo de 1.3 mm por puerta de 18 mm con la copa a 3 mm del borde (Hettich *Sensys*: 0.6–0.8 mm); entre dos puertas, ≥ 2 × el revelado | clóset batiente | [Blum, guía rápida de bisagras](https://downloads2.cabinetparts.com/54af8d4d-ea85-4fdd-a601-1a0a31dbcd92.pdf); [Hettich *Sensys*](https://web.hettich.com/fileadmin/media/Sensys_Catalogue_11309_en.pdf) | verificado (se toma el mayor) |
| fondo de 600 mm (clóset) y de 300 mm (librero) | clóset y librero | guías de taller (https://www.closetworld.com/blog/standard-closet-dimensions, https://www.instagram.com/p/B7RItFOH3XF/) | **por revisar** |
| barral a 1700 mm del piso | clóset | valor de taller | **por revisar** |

Ninguna medida de esta tabla se inventó: lo que no tiene documento se marca
`por revisar` y queda como parámetro ajustable del módulo.

## Pruebas

```bash
docker compose -f docker-compose.base44.yml --profile tests run --rm tests
```

Cubren: modelo de piezas y cantos (medidas terminadas, agrupación de líneas,
totales), las reglas del perfil (una prueba por regla, incluidos los umbrales de
65/70/66 mm), la geometría de los cuatro módulos con sus cantos y el reparto de
puertas y frentes, la idea escrita y el punto de entrada HTTP, y el mapeo de
cantos a los lados `c1`/`c2`/`l1`/`l2` de Cortecloud
(`tests/test_cantos_cortecloud.test.ts`, con ida y vuelta sobre las 21 líneas del
fixture) y las tolerancias de bisagras y juegos de herraje del clóset contra las
tablas de Hettich y Blum (`tests/test_closet_herrajes.test.ts`: tramos de 2/3/4/5
bisagras, revelado mínimo entre puertas, avisos de altura y ancho fuera de guía).
Son **311 pruebas vitest** y 60 del servidor MCP (`node:test`), y
`tsc --noEmit` estricto pasa.

## Vista previa de desarrollo

`tools/preview/server.ts` es un servidor HTTP de Node (sin framework, solo
`tsx`) que sirve una página para ver y probar los módulos en el puerto 3000, más:

- `GET /api/modulos` — módulos registrados con sus parámetros.
- `GET /api/perfil` — perfil de restricciones por omisión.
- `POST /api/previsualizar` — `{"tipo": "cajonera", "params": {...}}`.
- `POST /api/idea` — `{"texto": "cajonera ancho=450 cajones=3"}`.

Es una herramienta de desarrollo, **no** la demo web del proyecto (esa es la
tarea `demo-web-docs`). El servidor corre con `tsx watch`, que recarga el código
al editar; si no refresca, reinícialo con
`docker compose -f docker-compose.base44.yml restart web`.

## Integración con la demo web

La rama `demo-web-docs` integra esta capa en la demo (Vite, DOM nativo):

- Un panel **Módulos paramétricos** (`demo/src/ui/modules-panel.js`) lista los tipos
  (`MODULOS`) y redibuja los campos desde el registro del motor, así que añadir un
  parámetro al registro lo expone solo en la UI.
- Al pulsar *Generar piezas del módulo* se llama a `generarModulo(tipo, valores)` y las
  `Pieza` se bridgean al optimizador con `Pieza.toPartInput()` (`demo/src/engine/modules.js`):
  `width = ancho`, `height = largo`, veta → `grain`, cantos → `edges`.
- Los cantos viajan como texto en `Cantos` y se convierten a los lados
  `c1`/`c2`/`l1`/`l2` de Cortecloud con `cantosACortecloud()` /
  `cantosDesdeCortecloud()` (`src/modules/cortecloud.ts`).
- El tablero de stock pasa al recomendado por el perfil (2500×1830×18 mm) y el layout se
  recalcula en vivo, con los hallazgos del perfil como avisos.
- El ejemplo por omisión de la demo sigue siendo el **escritorio compacto** real (fixture de
  Cortecloud, `tests/fixtures/cortecloud/escritorio_D_simple.json`), cargado con el botón
  *Escritorio compacto (fixture)* del panel de piezas.

Pruebas: `demo/tests/app/modules-panel.test.js` (jsdom) cubre generar cajonera y clóset,
el redibujado de campos al cambiar de módulo y volver al ejemplo del escritorio compacto.

## Pendientes

- Confirmar con el taller el lado **físico** de cada canto en las piezas importadas
  (el JSON no declara la orientación del dibujo; ver arriba).
- Revisar los valores `por revisar` con el taller o el herraje antes de fabricar.
- Llevar la cantidad de bisagras de la cocina (hoy regla local de 2/3) a la tabla
  verificada de `bisagrasPorPuerta()`.
- Peso de puerta: la guía de bisagras por peso (4–6 kg / 6–12 kg) no está modelada.
- Resolver la ranura de trasera (hoy la trasera va clavada al dorso, sin ranura).
- Conectar con el servidor MCP (rama `mcp-server`). La integración con el optimizador y la
  demo web ya está resuelta en la rama `demo-web-docs`.

## English summary

Parametric furniture modules (drawer unit, closet, kitchen base cabinet,
bookcase): dimensions in, cut list with edge banding, grain direction and
machining out, optionally validated against an optional restriction profile
(`cortecloud_madijal`, transcribed from `docs/memoria/MEMORIA.md`).
Reference dimensions come from ARAUCO's public *Serie Cómo Hacer* documents and
from the real Cortecloud cut-list fixture in `tests/fixtures/`; every value
without a verified source is flagged `por revisar` (to be verified) and exposed
as an adjustable parameter. The edge-banding mapping to Cortecloud's
`c1`/`c2`/`l1`/`l2` fields is not verified yet.
