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
- Formato Cortecloud conocido: JSON `{"parts":[...]}` con campos `quantity`, `c` (largo, mm), `l` (ancho, mm), `function`, `complement`, `material`, cantos `c1`,`c2`,`l1`,`l2` (texto del canto o null), `machining`. Muestra real: `tests/fixtures/cortecloud/escritorio_D_simple.json`. El importador de Cortecloud no vincula materiales automáticamente.
- Sistema de coordenadas de Cortecloud (verificado 2026-10-29 en la guía oficial de Serrabits): pieza vista por la cara interna; esquinas 0 superior izquierda, 1 inferior izquierda, 2 inferior derecha, 3 superior derecha. `c1` = segmento 0-1 (lado del largo, izquierda), `l1` = 1-2 (del ancho, inferior), `c2` = 2-3 (largo, derecha), `l2` = 3-0 (ancho, superior). `c` es el largo y `l` el ancho, en milímetros.
- Bisagras de las puertas batientes del clóset y de la cocina (verificado 2026-10-29 con catálogos; tabla compartida en `src/modules/bisagras.ts`): 2/3/4/5 bisagras por puerta hasta 900/1600/2000/2400 mm de alto y puertas de hasta 600 mm de ancho (Hettich *Sensys*); revelado mínimo de 1.3 mm por puerta de 18 mm con la copa a 3 mm, o sea ≥ 2.6 mm entre dos puertas (Blum CLIP top; Hettich publica valores menores). El `juego` de 3 mm del módulo lo cumple. La cantidad también se calcula por peso (Blum: 2 bisagras de 4 a 6 kg y 3 de 6 a 12 kg), con el peso de la puerta a 750 kg/m³ más el tirador (`peso_tirador`, 0.09 kg por omisión: tirador de acero de 96 mm según su ficha de producto, *por revisar* contra el tirador elegido), porque Blum pide contar la puerta con sus tiradores; se pide la mayor de las dos guías y se avisa sobre 12 kg.

## Perfil de restricciones de ejemplo (opcional): Cortecloud/Madijal
Restricciones observadas en uso real (no son reglas del motor por defecto):
- Pieza mínima 65 mm de corte (a la medida de corte, descontando canto: con canto 0.4 mm en ambos lados, la terminada debe ser ≥ ~66 mm; recomendado 70).
- Pieza mecanizada: largo ≥ 250 mm.
- Pieza máxima 2480 × 1810 mm.
- Tablero 2500 × 1830 mm, 18 mm.
- Ranuras permitidas: 5.7/6.2/6.7/7/9.7/12.7/15.7/18.7/25.7 mm. Barrenos horizontales Ø3/8; verticales Ø3/5/8/10/15/20/35.

## Estado de formatos (2026-10-27, rama `formatos-import-export`)
- Paquete `src/formats/` en TypeScript (Node estándar, sin dependencias de ejecución) sobre los tipos del motor (`src/types.ts`, rama `optimizer-engine`); registro en `src/formats/index.ts`. Cada formato declara dirección, estado y fuentes, y lo no verificado viaja como aviso «por revisar» con enlace. Los formatos usan los tipos del motor donde encajan sin pérdida (DXF exporta desde el `LayoutResult` del motor).
- Verificado: CSV genérico (especificación propia, `docs/formatos/csv-generico.md`).
- Parcial (interfaz documentada, contenido sin verificar): Cortecloud JSON (unidad y semántica de `c`/`l` sin declarar en la guía oficial), OpenCutList CSV (títulos por defecto configurables/traducibles; `.skp` no se lee), PolyBoard (columnas/orden y opciones de cotas configurables), DXF (escritura limitada a R12; lectura sólo de rectángulos alineados a los ejes).
- Por revisar: Promob (columnas del CSV de Cut Pro configurables por optimizador; esquema del XML de listagem no publicado, importador XML pendiente) y PRO100 (layout del listado exportado no publicado; el archivo no trae tipo de material por pieza).
- PolyBoard, Promob y PRO100: sólo importación (no está documentado que importen listas de corte externas). DXF se exporta desde un `Layout`, no desde una `ListaCorte`.
- Detalle y fuentes: `docs/formatos/`.

## Entorno de desarrollo
- `docker compose -f docker-compose.base44.yml up -d --build` (servicio `docs` en el puerto 3000 para el preview; el branch no tiene UI web todavía, la demo llega con `demo-web-docs`).
- Entorno TypeScript (rama `formatos-import-export`): el servicio `web` (node:22) sirve la documentación en el puerto 3000 (`tools/preview/server.ts`). Pruebas y tipos: `docker compose -f docker-compose.base44.yml exec -T web npm test` (59 pruebas `vitest`) y `npm run typecheck`.

## Reglas
- Nunca merge a `main` ni force-push sin OK del owner.
- No releases, ni listados en marketplaces (DataVendor, Flippa, etc.) sin OK del owner.
- Sin secretos. Datos reales; nada inventado.
