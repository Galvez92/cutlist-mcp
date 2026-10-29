# Fixtures de pruebas

Cada archivo se marca según su procedencia (regla del proyecto: datos reales, no
formatos inventados).

## Reales

- `cortecloud/escritorio_D_simple.json` — muestra real saneada de un proyecto
  Cortecloud (escritorio Atelier Simple 1700x600x750, 22 líneas de piezas). Base
  del importador/exportador de Cortecloud.

## Sintéticos (por revisar)

Los siguientes archivos **no** son exportaciones reales de esos programas: son
ejemplos construidos con el **orden de columnas declarado** por cada importador
para poder probar el lector. Cuando se consiga una muestra real, se reemplazan y
se actualiza `docs/formatos/`.

- `csv_generico/piezas_basico.csv` — formato propio (especificado en
  `docs/formatos/csv-generico.md`); no es «por revisar»: es la definición.
- `opencutlist/parts_opencutlist.csv` — columnas obligatorias documentadas por
  OpenCutList (Designation, Length, Width, Thickness) más Quantity, Material y
  Tags. Los títulos por defecto de una exportación real no están verificados.
- `polyboard/lista_corte.csv` — orden asumido `nombre;largo;ancho;cantidad;espesor;material`.
- `promob/listagem.txt` — orden asumido de `COLUMNAS_POR_DEFECTO` de Promob.
- `pro100/listado_detalles.txt` — orden asumido `nombre;cantidad;largo;ancho;espesor`.

## DXF

- `dxf/rectangulo_lineas.dxf` — DXF R12 mínimo escrito a mano según el DXF
  Reference de Autodesk (4 LINE por rectángulo + TEXT), para probar la lectura de
  contornos formados por LINE.
