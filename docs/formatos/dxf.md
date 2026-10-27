# DXF (ASCII, AutoCAD R12)

Clave: `dxf` · Dirección: importar y exportar · Estado: **parcial**

## Fuentes (DXF Reference de Autodesk)

- Sección ENTITIES:
  <https://help.autodesk.com/view/ACD/2023/ENU/?guid=GUID-7D07C886-FD1D-4A0C-A7AB-B4D21F18E484>
- POLYLINE (código 66 «vertices follow», flag 70 bit 1 = cerrada):
  <https://help.autodesk.com/view/ACD/2023/ENU/?guid=GUID-ABF6B778-BE20-4B49-9B58-A94E64CEFFF3>
- LINE: <https://help.autodesk.com/view/ACD/2023/ENU/?guid=GUID-FCEF5726-53AE-4C43-B4EA-C84EB8686A66>
- LWPOLYLINE (sólo lectura):
  <https://help.autodesk.com/view/ACD/2023/ENU/?guid=GUID-748FC305-F3F2-4F74-825A-61F04D757A50>

## Exportación

Se escribe DXF R12 (`$ACADVER = AC1009`, `$INSUNITS = 4` = milímetros) con pares
código/valor: tabla LAYER, contorno de cada tablero y de cada pieza como POLYLINE
cerrada (VERTEX + SEQEND) y las etiquetas como TEXT.

Capas:

| Capa | Contenido | Color |
|---|---|---|
| `HOJA` | contorno del tablero | 7 |
| `PIEZAS` | contorno de cada pieza colocada | 3 |
| `ETIQUETAS` | identificador y medidas de la pieza | 2 |

Las hojas se dibujan una al lado de la otra con 50 mm de separación.

```python
from cutlist.formats import exportar

dxf = exportar(layout, "dxf")                       # Layout: hojas + colocaciones
dxf = exportar(layout, "dxf", incluir_etiquetas=False, alto_texto=30)
```

La exportación no acepta una `ListaCorte`: el DXF describe **dónde** se corta cada
pieza, así que necesita el `Layout` que produce el motor de optimización.

## Lectura

Se leen contornos **rectangulares alineados a los ejes**:

- polilíneas cerradas de 4 vértices (`POLYLINE` con flag 70 = 1 o `LWPOLYLINE`), y
- grupos de 4 `LINE` que comparten extremos (dos horizontales y dos verticales).

El nombre de la pieza se toma del primer `TEXT` que cae dentro del rectángulo; si
no hay ninguno, se numera `contorno N`. La capa se guarda en `grupo`/`etiqueta`, y
la posición en `extra = {"x", "y"}`.

Por defecto se excluyen las capas propias `HOJA` y `ETIQUETAS`; con DXF de otros
programas conviene indicar la capa (o capas) que contienen las piezas:

```python
from cutlist.formats import importar

lista = importar(texto_dxf, "dxf")                       # excluye HOJA y ETIQUETAS
lista = importar(texto_dxf, "dxf", solo_capa="PIEZAS")
lista = importar(texto_dxf, "dxf", excluir_capas=())     # todo lo rectangular
```

## Por revisar

- La escritura se limita a R12 (AC1009) con POLYLINE/VERTEX/SEQEND y TEXT: no se
  emiten bloques, arcos ni entidades de versiones posteriores.
- La lectura sólo reconoce rectángulos alineados a los ejes; otros contornos
  (arcos, polilíneas curvas, contornos inclinados) se ignoran y no se convierten
  en piezas.
- No está verificado ningún convenio de capas de otros programas (PolyBoard,
  software de CNC); las capas se usan como `grupo` de la pieza.

## Pruebas

`tests/test_dxf.py`: escritura R12 (cabecera, capas, POLYLINE/VERTEX/SEQEND),
ida y vuelta del layout, exclusión de capas propias, lectura de un DXF hecho a
mano con 4 `LINE` por rectángulo (`tests/fixtures/dxf/rectangulo_lineas.dxf`) y
errores de archivo.
