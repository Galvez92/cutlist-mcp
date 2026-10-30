# Reglas para agentes de código / Rules for coding agents

1. Lee primero `docs/memoria/` (MEMORIA.md, tu ficha en `tareas/`, la última bitácora).
2. Trabaja solo en tu rama asignada. Nunca en `main`.
3. Abre un PR en **borrador** (draft). **Nunca hagas merge a `main`** ni force-push.
4. Sin secretos: no commits de tokens, claves, contraseñas ni datos personales.
5. Datos reales solamente. **Nunca inventes formatos de archivo.** Lo no verificado se marca `por revisar` con enlace a la fuente consultada.
6. No publiques releases, paquetes ni listados en marketplaces.
7. Al terminar cada corrida agrega una entrada en `docs/memoria/bitacora/AAAA-MM-DD.md` (rama, qué hiciste, pruebas, pendientes).
8. Incluye pruebas para todo lo que agregues.

## Entorno de desarrollo (Base44) / Dev environment

- Todo el código es Python con **sólo biblioteca estándar**: no hay `pip install`, ni base de datos, ni servicios externos, ni secretos que configurar.
- Levantar / arrancar: `docker compose -f docker-compose.base44.yml up -d --build`. Sirve `server.py` en el puerto 3000 (interno 8000).
- Pruebas, siempre dentro del contenedor (el host no tiene Python):
  `docker compose -f docker-compose.base44.yml exec -T web python -m unittest discover -s tests -t .`
- `server.py --reload` reinicia el proceso cuando cambia un `.py`, así que las ediciones se ven sin rebuild ni reinicio manual.
- La página `/` muestra el resultado sobre el fixture real de `tests/fixtures/cortecloud/`, permite pegar un CSV, subir un DXF o un XML de Promob y editar el catálogo de **stocks** (material, ancho, alto, espesor, kerf) que usa `POST /api/optimize`.
- El catálogo de stocks se guarda **en el servidor** (`data/stocks.json`, fuera de git; ruta configurable con `CUTLIST_STOCKS`) con `GET`/`PUT /api/stocks`, así que se reutiliza entre sesiones y navegadores. `cutlist/catalog.py` valida el catálogo (`parse_catalog`) y lo escribe de forma atómica (`CatalogStore`); si el archivo está corrupto se usa el catálogo por defecto y se avisa, nunca se rompe la página.
- API: `/api/health`, `/api/demo?algorithm=guillotine|nonguillotine`, `/api/example`, `/api/stocks` (GET/PUT), `POST /api/optimize` (`{"csv": "..."}`, `{"dxf": "..."}` o `{"promob": "..."}`, más `"algorithm"`, `"sheet"` o `"stocks": [{"material", "width", "height", "thickness", "kerf"}, ...]`) y `POST /api/report.pdf` (el mismo cuerpo, o `{"source": "demo"}`), que devuelve el reporte en PDF.
- `cutlist/pdf.py` arma el PDF con la biblioteca estándar, sin dependencias: resumen, tabla de tableros usados, piezas por tablero con su medida final y posición, lista de corte y avisos. No comprime los `streams` para que las pruebas lean el contenido.
- `cutlist/dxf.py` lee **DXF ASCII**: cada contorno cerrado (`LWPOLYLINE`, `POLYLINE`/`VERTEX` o `LINE` encadenadas) es una pieza rectangular, su **capa** es el material (capa `0` = sin material) y un `TEXT`/`MTEXT` dentro del contorno es la etiqueta. `$INSUNITS` da las unidades del dibujo. Los `INSERT` se expanden **recursivamente** con escala (`41`/`42`), rotación (`50`) y arreglo (`70`/`71`, `44`/`45`), heredando la capa del INSERT cuando la entidad está en la capa `0`; las formas no rectangulares se incluyen como su rectángulo envolvente con aviso. Arcos, splines y atributos quedan **por revisar** (https://images.autodesk.com/adsk/files/autocad_2012_pdf_dxf-reference_enu.pdf).
- `cutlist/promob.py` lee el **Plugin Builder XML** de Promob (una `PROGRAM` por pieza, mm): `HEADER DX/DY/DZ`, `PARTDESCRIPTION`, `HOLE` (`X`,`Y`,`DIAMETER`), `SLOT` (`SX`,`SY`,`EX`,`EY`,`WIDTH`) y el contorno exterior; si no es rectangular se avisa y se corta el rectángulo envolvente. No trae material ni veta (stock comodín, se puede girar). Ejemplo oficial en `tests/fixtures/promob/SID0036A.xml`. El XML del presupuesto de Promob («Enviar para > XML») no tiene esquema público: **por revisar**.
- `cutlist/constraints.py`: reglas del mecanizado y del perfil. `machining_outside()` valida que el mecanizado quepa en la pieza —barreno vertical como círculo completo sobre la cara; barreno horizontal (al canto) contra el canto y el espesor (`Part.thickness`, que Cortecloud toma del texto del material y Promob del `DZ`); ranura con eje con su ancho perpendicular— y `Part.invalid_reasons` lo expone: `optimize` no ubica esas piezas, las deja en `OptimizationResult.invalid` y avisa. `Constraints` (perfil Cortecloud/Madijal) vive también ahí y se reexporta desde `cutlist/models.py`. Las ranuras de Cortecloud sin eje siguen *por revisar*.
- `cutlist/stock.py` asigna cada pieza al stock de su `material` (varios stocks por material permitidos; un stock sin material es comodín; si no hay stock del material, la pieza queda sin ubicar con un aviso). `{"sheet": ...}` sin `material` sigue siendo comodín para todo.
- El CSV es un formato **propio de cutlist-mcp** (documentado en `cutlist/csv_import.py`), no el de Cortecloud ni el de otro programa.
- El fixture de Cortecloud se importa en `cutlist/cortecloud.py`: agrupa las piezas por el texto `material` y cada material se corta de su propio tablero (`cutlist/materials.py`). De `machining` importa los diámetros de barreno y los anchos de ranura; `Constraints` (`cutlist/models.py`) los valida contra el perfil y los reporta como avisos, no rechaza el archivo. El archivo no trae veta: por la regla documentada de Cortecloud (el largo sigue la veta del tablero) cada pieza se importa con `grain=True`, así que no se gira. Faltan los demás formatos de la tarea `formatos-import-export`.
