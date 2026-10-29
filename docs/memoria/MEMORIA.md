# MEMORIA del proyecto cutlist-mcp

## Objetivo
Optimizador de corte de tableros open-source, independiente de Cortecloud, usable por humanos (demo web) y por agentes (servidor MCP).

## Alcance
1. **Motor:** piezas (ancho, alto, cantidad, veta, canto) + tableros en stock (medidas, espesor, kerf) → layout optimizado (guillotina y no guillotina), % aprovechamiento, lista de corte, etiquetas, PDF/SVG.
2. **Import/export:** Cortecloud, Promob, CSV genérico, SketchUp/OpenCutList, Polyboard, Pro100, DXF. Investigar formatos en documentación pública real; lo no verificado = `por revisar` con enlace.
3. **Servidor MCP:** módulos paramétricos (cajonera, clóset, cocina, librero) → piezas → optimizar → exportar.
4. **Demo web simple**, pruebas, README es/en.

## Decisiones
- Repo público, licencia MIT (2026-10-27).
- Desarrollo con Base44 Base Code (modelo Auto gratis), una rama por área, PR en borrador. Hermes/opencode solo tareas mecánicas y revisión.
- Formato Cortecloud conocido: JSON `{"parts":[...]}` con campos `quantity`, `c` (largo, mm), `l` (ancho, mm), `function`, `complement`, `material`, cantos `c1`,`c2`,`l1`,`l2` (texto del canto o null), `machining`. Muestra real: `tests/fixtures/cortecloud/escritorio_D_simple.json`. El importador (`cutlist/cortecloud.py`) agrupa las piezas por el texto `material` del archivo y toma de ahí las medidas del tablero; no valida códigos de material contra un catálogo. Los errores de lectura (archivo ausente, directorio, bytes que no son UTF-8) y los datos mal formados se informan como `ValueError` con el número de pieza que falla.

- Asignación de materiales (2026-10-29): las piezas llevan `material` y el motor recibe un catálogo de stocks (`Sheet.material`); `cutlist/stock.py` reparte cada pieza al stock de su material, admite varios stocks del mismo material (medidas distintas) y no mezcla dos materiales en un mismo tablero. Un stock sin `material` es comodín; si ninguna regla aplica, la pieza queda sin ubicar con un aviso que dice qué material falta. El texto de material se compara sin mayúsculas, acentos ni espacios de más.
- Catálogo de stocks persistente (2026-10-29): el catálogo se guarda en `data/stocks.json` (fuera de git, ruta configurable con `CUTLIST_STOCKS`) y se lee/escribe con `GET`/`PUT /api/stocks`. `cutlist/catalog.py` valida cada stock con el mismo formato de la API y escribe el archivo de forma atómica; un archivo corrupto se reemplaza en memoria por el catálogo por defecto con un aviso, nunca deja la página sin stocks.
- Reporte PDF (2026-10-29): `cutlist/pdf.py` genera un PDF 1.4 válido sin dependencias (objetos, `xref` y fuentes base Helvetica/Courier con WinAnsi). Incluye el resumen (aprovechamiento, tableros, piezas, sin ubicar), la tabla de tableros usados y, por tablero, **cada pieza con su medida final** después del giro, su posición y su etiqueta; además la lista de corte y los avisos. `POST /api/report.pdf` lo sirve con `Content-Disposition: attachment`.
- Importador DXF (2026-10-29): `cutlist/dxf.py` lee DXF ASCII y convierte cada contorno cerrado (`LWPOLYLINE`, `POLYLINE`/`VERTEX`, o `LINE` encadenadas por extremos) en una pieza rectangular; la **capa** es el material (capa `0` = sin material) y un `TEXT`/`MTEXT` dentro del contorno es la etiqueta. Lee `$INSUNITS` para las unidades. Subconjunto **por revisar**: los `INSERT` (bloques) no se expanden y las formas no rectangulares se omiten con aviso. Fuente: *DXF Reference* (Autodesk), https://images.autodesk.com/adsk/files/autocad_2012_pdf_dxf-reference_enu.pdf

## Perfil de restricciones de ejemplo (opcional): Cortecloud/Madijal
Restricciones observadas en uso real (no son reglas del motor por defecto):
- Pieza mínima 65 mm de corte (a la medida de corte, descontando canto: con canto 0.4 mm en ambos lados, la terminada debe ser ≥ ~66 mm; recomendado 70).
- Pieza mecanizada: largo ≥ 250 mm.
- Pieza máxima 2480 × 1810 mm.
- Tablero 2500 × 1830 mm, 18 mm.
- Ranuras permitidas: 5.7/6.2/6.7/7/9.7/12.7/15.7/18.7/25.7 mm. Barrenos horizontales Ø3/8; verticales Ø3/5/8/10/15/20/35.

## Reglas
- Nunca merge a `main` ni force-push sin OK del owner.
- No releases, ni listados en marketplaces (DataVendor, Flippa, etc.) sin OK del owner.
- Sin secretos. Datos reales; nada inventado.
