/**
 * Tipos del motor de optimización de corte (cutlist-mcp).
 *
 * Unidades: milímetros (mm).
 * Sistema de coordenadas de la hoja: origen en la esquina superior izquierda,
 * `x` crece hacia la derecha e `y` hacia abajo (el mismo que usa SVG).
 */

/** Dirección de la veta. `none` = pieza sin veta (se puede girar libremente). */
export type GrainDirection = "none" | "horizontal" | "vertical";

/** Lado de una pieza o de una hoja. */
export type EdgeSide = "top" | "right" | "bottom" | "left";

/** Espesor de canto (mm) en cada lado; 0 = sin canto. */
export interface EdgeBanding {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

/**
 * Pieza de entrada. Las medidas son medidas de CORTE (lo que corta la sierra),
 * no medidas terminadas: si la pieza lleva canto, la medida terminada es
 * `width - edges.left - edges.right` × `height - edges.top - edges.bottom`.
 */
export interface PartInput {
  /** Identificador lógico. Si falta se genera `P01`, `P02`, ... */
  id?: string;
  /** Código corto para etiquetas. Si falta se usa `id`. */
  code?: string;
  /** Nombre/función de la pieza (ej. "Costado interior der"). */
  label?: string;
  /** Ancho de corte (mm) en la orientación sin girar. */
  width: number;
  /** Alto de corte (mm) en la orientación sin girar. */
  height: number;
  /** Cantidad de piezas iguales (por defecto 1). */
  qty?: number;
  /** Requisito de veta (por defecto `none`). */
  grain?: GrainDirection;
  /** Cantos (mm) por lado; los lados omitidos quedan en 0. */
  edges?: Partial<EdgeBanding>;
  /** Material. Solo se corta en tableros del mismo material. */
  material?: string;
  /** Espesor (mm) requerido. */
  thickness?: number;
}

/** Pieza normalizada (todos los campos por defecto ya aplicados). */
export interface Part {
  id: string;
  code: string;
  label: string;
  width: number;
  height: number;
  qty: number;
  grain: GrainDirection;
  edges: EdgeBanding;
  material?: string;
  thickness?: number;
}

/** Tablero en stock. */
export interface SheetInput {
  id?: string;
  label?: string;
  width: number;
  height: number;
  thickness: number;
  /** Kerf (ancho de corte de la sierra) en mm; por defecto el global. */
  kerf?: number;
  /** Margen de recorte útil en cada borde (mm); por defecto el global. */
  trim?: number;
  /** Veta del tablero (por defecto `none`). */
  grain?: GrainDirection;
  /** Unidades disponibles de este tablero (por defecto 1). */
  qty?: number;
  material?: string;
}

/** Tablero normalizado. */
export interface SheetStock {
  id: string;
  label: string;
  width: number;
  height: number;
  thickness: number;
  kerf: number;
  trim: number;
  grain: GrainDirection;
  qty: number;
  material?: string;
}

/** Algoritmos de acomodo. */
export type AlgorithmKind = "guillotine" | "maxrects";

/** Algoritmo pedido por el usuario; `auto` prueba todos y devuelve el mejor. */
export type AlgorithmOption = AlgorithmKind | "auto";

/** Heurísticas de orden de las piezas. */
export type OrderingName = "area" | "lado-mayor" | "altura" | "ancho";

/** Pieza colocada dentro de una hoja. */
export interface Placement {
  partId: string;
  code: string;
  label: string;
  /** Esquina superior izquierda dentro de la hoja (mm). */
  x: number;
  y: number;
  /** Medidas reales ya orientadas dentro de la hoja (mm). */
  width: number;
  height: number;
  /** `true` si la pieza se giró 90°. */
  rotated: boolean;
  /** Requisito de veta de la pieza. */
  grain: GrainDirection;
  /** Dirección real de la veta dentro de la hoja. */
  grainInSheet: GrainDirection;
  /** Cantos de la pieza en su orientación original. */
  edges: EdgeBanding;
  material?: string;
  thickness?: number;
}

/** Hoja usada del stock, con sus piezas. */
export interface SheetLayout {
  /** `id` del tablero de stock. */
  sheetId: string;
  /** Nº de unidad de ese stock (1 = primera). */
  instance: number;
  /** Número de hoja dentro del pedido (1..N). */
  index: number;
  label: string;
  width: number;
  height: number;
  thickness: number;
  material?: string;
  grain: GrainDirection;
  kerf: number;
  trim: number;
  placements: Placement[];
  /** Área de piezas (mm²). */
  usedArea: number;
  /** Área del tablero (mm²). */
  sheetArea: number;
  /** Área perdida: tablero - piezas (mm²). */
  wasteArea: number;
  /** Aprovechamiento de esta hoja (%). */
  yieldPct: number;
}

/** Motivo por el que una pieza no se pudo colocar. */
export type UnplacedReason =
  | "sin-tablero-compatible"
  | "no-cabe-en-tablero"
  | "stock-insuficiente";

export interface UnplacedPart {
  partId: string;
  code: string;
  label: string;
  quantity: number;
  reason: UnplacedReason;
  detail: string;
}

/** Fila de la lista de corte (una por pieza distinta). */
export interface CutListRow {
  partId: string;
  code: string;
  label: string;
  quantity: number;
  placed: number;
  /** Medidas de corte (mm). */
  cutWidth: number;
  cutHeight: number;
  /** Medidas terminadas, descontando cantos (mm). */
  finishedWidth: number;
  finishedHeight: number;
  grain: GrainDirection;
  edges: EdgeBanding;
  edgeSummary: string;
  material?: string;
  thickness?: number;
  /** Números de hoja donde aparece la pieza. */
  sheets: number[];
}

export interface LayoutMetrics {
  /** Piezas distintas pedidas. */
  distinctParts: number;
  /** Instancias pedidas (suma de `qty`). */
  partInstances: number;
  placed: number;
  unplaced: number;
  sheetsUsed: number;
  /** Área total de los tableros usados (mm²). */
  sheetArea: number;
  usedArea: number;
  wasteArea: number;
  /** Aprovechamiento global (%). */
  yieldPct: number;
}

/** Resultado de un intento de acomodo (algoritmo × heurística). */
export interface PackingAttempt {
  algorithm: AlgorithmKind;
  ordering: OrderingName;
  sheetsUsed: number;
  sheetArea: number;
  usedArea: number;
  yieldPct: number;
  unplacedQuantity: number;
}

export type IssueSeverity = "error" | "aviso" | "por-revisar";

/** Hallazgo de validación (perfil de restricciones). */
export interface ProfileIssue {
  code: string;
  severity: IssueSeverity;
  message: string;
  partId?: string;
}

/**
 * Perfil de restricciones de una máquina/proveedor.
 *
 * Los datos de un perfil NO son reglas por defecto del motor: se aplican solo
 * cuando el usuario los pasa en `OptimizeRequest.profile`. Un perfil se marca
 * `por revisar` mientras sus valores no estén verificados contra una fuente
 * pública (ver `profiles.ts`).
 */
export interface ConstraintProfile {
  id: string;
  name: string;
  reviewStatus: "verificado" | "por revisar";
  /** Fuentes consultadas para los valores del perfil. */
  sources: string[];
  notes: string;
  /** Medida de corte mínima admisible (mm). */
  minCutWidth: number;
  minCutHeight: number;
  /** Mínimo de corte cuando la pieza lleva canto (mm). */
  minWithEdge?: number;
  /** Largo mínimo de una pieza mecanizada (mm). */
  minMachinedLength?: number;
  /** Medida máxima de pieza (mm). */
  maxPartWidth: number;
  maxPartHeight: number;
  /** Tableros que maneja el proveedor. */
  stock: { width: number; height: number; thickness: number }[];
  /** Ranuras permitidas (mm). */
  grooves?: number[];
  /** Diámetros de barrenos permitidos (mm). */
  drillDiameters?: { horizontal: number[]; vertical: number[] };
}

export interface OptimizeRequest {
  parts: PartInput[];
  sheets: SheetInput[];
  /** Kerf global (mm) para los tableros que no lo definan. Por defecto 0. */
  kerf?: number;
  /** Margen de recorte global (mm). Por defecto 0. */
  trim?: number;
  /** Permitir girar piezas 90° cuando la veta lo permita. Por defecto `true`. */
  allowRotation?: boolean;
  /** Algoritmo. Por defecto `auto`. */
  algorithm?: AlgorithmOption;
  /** Perfil opcional: solo valida, no cambia el acomodo. */
  profile?: ConstraintProfile;
}

export interface LayoutResult {
  algorithm: AlgorithmKind;
  ordering: OrderingName;
  /** Todos los intentos probados, ordenados de mejor a peor. */
  attempts: PackingAttempt[];
  sheets: SheetLayout[];
  unplaced: UnplacedPart[];
  cutList: CutListRow[];
  labels: PartLabel[];
  metrics: LayoutMetrics;
  issues: ProfileIssue[];
}

/** Etiqueta lista para imprimir/rotular una pieza colocada. */
export interface PartLabel {
  partId: string;
  code: string;
  /** Título: nombre/función de la pieza. */
  title: string;
  sizeText: string;
  edgeText: string;
  materialText: string;
  sheetText: string;
  rotated: boolean;
  /** Líneas listas para dibujar, de arriba a abajo. */
  lines: string[];
}
