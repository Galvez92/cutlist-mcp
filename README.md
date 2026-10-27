# cutlist-mcp

> **Estado / Status: en construcción (under construction)**

## Español
Optimizador de corte de tableros open-source, **independiente de Cortecloud**.

Alcance:
1. **Motor:** piezas (ancho, alto, cantidad, veta, canto) + tableros en stock (medidas, espesor, kerf) → layout optimizado (guillotina y no guillotina), % de aprovechamiento, lista de corte, etiquetas, PDF/SVG.
2. **Importadores/exportadores:** Cortecloud, Promob, CSV genérico, SketchUp/OpenCutList, Polyboard, Pro100, DXF. Formatos basados en documentación pública real; lo no verificado se marca *por revisar*.
3. **Servidor MCP:** para que el agente de cualquier usuario diseñe muebles a partir de medidas (módulos paramétricos: cajonera, clóset, cocina, librero → piezas → optimizar → exportar).
4. **Demo web simple**, pruebas y documentación es/en.

### Formatos (rama `formatos-import-export`)

| Formato | Clave | Dirección | Estado |
|---|---|---|---|
| Cortecloud (JSON) | `cortecloud` | importar + exportar | parcial |
| CSV genérico (propio) | `csv_generico` | importar + exportar | verificado |
| SketchUp / OpenCutList (CSV) | `opencutlist` | importar + exportar | parcial |
| PolyBoard (lista de corte) | `polyboard` | sólo importar | parcial |
| Promob (listado TXT/CSV) | `promob` | sólo importar | por revisar |
| PRO100 (listado TXT/CSV) | `pro100` | sólo importar | por revisar |
| DXF (ASCII R12) | `dxf` | importar + exportar | parcial |

```python
from cutlist.formats import importar_archivo, importar, exportar

lista = importar_archivo("proyecto.json")                 # Cortecloud
lista = importar(texto, "promob", columnas=("nombre", "cantidad", "largo", "ancho", "espesor"))
print(lista.total_piezas, lista.area_total_m2)
for aviso in lista.por_revisar():                        # lo no verificado, con su fuente
    print(aviso.texto())
```

Cada formato declara su estado y sus fuentes públicas; lo que no se pudo verificar
se marca **por revisar** con enlace. Ver `docs/formatos/`.

Pruebas (biblioteca estándar, sin dependencias): `docker compose -f docker-compose.base44.yml run --rm pruebas` o `python3 -m unittest discover -s tests -t .`.

Licencia MIT.

## English
Open-source panel cutting optimizer, **independent of Cortecloud**.

Scope:
1. **Engine:** parts (width, height, qty, grain, edge banding) + stock sheets (size, thickness, kerf) → optimized layout (guillotine and non-guillotine), yield %, cut list, labels, PDF/SVG.
2. **Importers/exporters:** Cortecloud, Promob, generic CSV, SketchUp/OpenCutList, Polyboard, Pro100, DXF. Formats based on real public docs; unverified items are marked *por revisar* (to be verified).
3. **MCP server:** lets any user's agent design furniture from measurements (parametric modules: drawer unit, closet, kitchen, bookcase → parts → optimize → export).
4. **Simple web demo**, tests and es/en docs.

### Formats (branch `formatos-import-export`)

`cutlist/formats/` ships importers/exporters for Cortecloud (JSON, import+export),
our own generic CSV (import+export), SketchUp/OpenCutList CSV (import+export),
PolyBoard, Promob and PRO100 cut lists (import only), and DXF R12 (layout export +
rectangle reading). Each format declares its verification status and its public
sources; anything that could not be verified is flagged **por revisar** (to be
verified) with a link — see `docs/formatos/`. Python 3.12 standard library only, no
third-party dependencies; tests run with
`docker compose -f docker-compose.base44.yml run --rm pruebas`.

MIT licensed.
