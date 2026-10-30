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
- Bisagras de las puertas batientes del clóset y de la cocina (verificado 2026-10-29 con catálogos; tabla compartida en `src/modules/bisagras.ts`): 2/3/4/5 bisagras por puerta hasta 900/1600/2000/2400 mm de alto y puertas de hasta 600 mm de ancho (Hettich *Sensys*); revelado mínimo de 1.3 mm por puerta de 18 mm con la copa a 3 mm, o sea ≥ 2.6 mm entre dos puertas (Blum CLIP top; Hettich publica valores menores). El `juego` de 3 mm del módulo lo cumple. La cantidad también se calcula por peso (Blum: 2 bisagras de 4 a 6 kg y 3 de 6 a 12 kg; el límite de 6.0 kg es inclusivo: con 6.0 kg todavía van 2 y la tercera entra sobre 6.0 kg), con el peso de la puerta a 750 kg/m³ más el tirador (`peso_tirador`, 0.09 kg por omisión: tirador de acero de 96 mm, peso de su ficha de producto verificado el 2026-10-29; los tiradores rectos de 128 mm —liviano SKU 103911 y pesado SKU 103916— también publican 0.09 kg en sus fichas; con otro tirador hay que pasar el peso real), porque Blum pide contar la puerta con sus tiradores; se pide la mayor de las dos guías y se avisa sobre 12 kg. Con el tirador incluido, la tercera bisagra se activa cuando el tablero pasa de 5.91 kg.

- Trasera en ranura (2026-10-29, clóset y cajonera): ranura de 5.7 mm de ancho × 9 mm de profundidad a 15 mm del borde del dorso. Profundidad y distancia salen del *Manual Técnico de Melamina #02* (manual de taller, *por revisar*); el ancho es el menor que admite el perfil Cortecloud/Madijal. La trasera mide el interior + 2 × profundidad, las repisas del clóset terminan en la cara frontal de la trasera y el travesaño trasero de la cajonera va por delante. `trasera_ranura: false` vuelve a la trasera clavada. La cocina y el librero se sumaron el 2026-10-30 (cocina: ranura en costados, base y travesaño trasero; librero: ranura en costados, base y tapa, con las repisas recortadas). La caja del cajón de la cajonera y de la cocina termina en la cara frontal de la trasera (`caraFrontalTrasera()` en `common.ts`: `ranura_distancia + ranura_ancho` con ranura, el espesor de la trasera sin ella, 0 sin trasera), así que el fondo útil descuenta 20.7 mm con los valores por omisión. `encajeTrasera()` exige que el ancho de la ranura sea mayor que el espesor de la trasera y devuelve la holgura del panel (2.7 mm con los valores por omisión); el fondo libre de la caja del cajón se calcula en `fondoUtilCajon()` y la cocina lo publica en `medidas` (`fondo_util_cajon`, `largo_caja_cajon`). El 2026-10-30 el clóset pasó a calcular la profundidad de sus repisas con ese mismo `caraFrontalTrasera()` (600 − 20.7 = 579.3 mm de fondo, igual que antes) en lugar de repetir `fondo − distancia − ancho`, y su nota dice dónde va la ranura (costados, base y tapa; el frente queda sin ranura), como la de la cocina.
- Herraje del cajón (2026-10-30, verificado con Häfele *IXCONNECT Minifix 15*): caja Ø15 mm con 13.5 mm de profundidad en tablero de 18 mm (12.0/12.5/13.5/14.0 para 15/16/18/19 mm) y barreno del pasador de **Ø7 u Ø8 mm** en el canto del panel. El módulo usa Ø7 mm (`diametro_pin`, ajustable) porque el perfil Cortecloud/Madijal solo admite Ø9.525 mm (3/8") en horizontal: el cajón por omisión devuelve `barreno_no_permitido` y queda *por revisar* con el proveedor.
- Pesos de tiradores de referencia (2026-10-29) en `PESOS_TIRADOR_REFERENCIA` (`src/modules/bisagras.ts`): 96 mm SKU 103910 y 128 mm SKU 103911 (liviano) / 103916 (pesado), los tres 0.09 kg según sus fichas de Promart. Las fichas no distinguen liviano de pesado, así que el taller debe pesar el tirador elegido.
- Lado físico de las piezas exportadas: sigue pendiente de confirmar con el taller; hay una lista de verificación pieza por pieza en `docs/verificacion-lados-piezas.md` (2026-10-29) con el lado esperado y casillas para marcar.

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
