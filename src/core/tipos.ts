/**
 * Tipos del dominio de corte de tableros.
 * Todas las medidas están en milímetros (mm).
 */

/** Texto del canto (ej. `"PVC 719L Roble 0.4 x 22 mm"`) o `null` si la orilla va cruda. */
export type Canto = string | null;

/**
 * Cantos de una pieza, nombrados por la dimensión (`largo` / `ancho`) sobre la que corren,
 * igual que los campos `c1`, `c2`, `l1`, `l2` del export real de Cortecloud.
 *
 * Convención del proyecto: `largo1` es la orilla frontal. **Por revisar** con una muestra
 * real de Cortecloud si la correspondencia de orillas es esa.
 */
export interface Cantos {
  largo1: Canto;
  largo2: Canto;
  ancho1: Canto;
  ancho2: Canto;
}

export const SIN_CANTOS: Cantos = { largo1: null, largo2: null, ancho1: null, ancho2: null };

export interface Pieza {
  /** Identificador estable dentro de una corrida (ej. `cajonera-01`). */
  id: string;
  /** Nombre visible de la pieza (campo `function` de Cortecloud). */
  nombre: string;
  /** Avance en el eje de veta: campo `c` (largo) de Cortecloud. */
  largo: number;
  /** Dimensión transversal: campo `l` (ancho) de Cortecloud. */
  ancho: number;
  cantidad: number;
  /** `true` = la veta debe seguir el eje `largo`, la pieza no se puede rotar. */
  veta: boolean;
  cantos: Cantos;
  material?: string;
  /** Módulo o ambiente al que pertenece la pieza (campo `complement` de Cortecloud). */
  grupo?: string;
  /** `true` = la pieza lleva mecanizado (barrenos o ranuras). */
  mecanizado?: boolean;
}

export interface Tablero {
  id: string;
  nombre: string;
  /** Medida del tablero en el eje X. */
  largo: number;
  /** Medida del tablero en el eje Y. */
  ancho: number;
  espesor: number;
  /** Ancho de corte de la sierra en mm. */
  kerf: number;
  /** Hojas disponibles de este tablero. `Infinity` = sin límite declarado. */
  cantidad: number;
  material?: string;
}

/** Pieza tal como la entrega un agente: sólo las medidas son obligatorias. */
export interface PiezaEntrada {
  id?: string;
  nombre?: string;
  largo: number;
  ancho: number;
  cantidad?: number;
  veta?: boolean;
  cantos?: Partial<Cantos>;
  material?: string;
  grupo?: string;
  mecanizado?: boolean;
}

export interface TableroEntrada {
  id?: string;
  nombre?: string;
  largo: number;
  ancho: number;
  espesor?: number;
  kerf?: number;
  cantidad?: number;
  material?: string;
}

/**
 * Kerf por defecto del proyecto: 3 mm.
 * **Por revisar**: no está verificado contra el manual de una sierra real; conviene
 * pasar el kerf medido de la máquina en cada corrida.
 */
export const KERF_POR_DEFECTO = 3;

/** Espesor por defecto del proyecto, tomado del perfil de restricciones de MEMORIA (tablero 18 mm). */
export const ESPESOR_POR_DEFECTO = 18;

export function redondear(valor: number, decimales = 2): number {
  const factor = 10 ** decimales;
  return Math.round(valor * factor) / factor;
}

function cantosConValores(cantos: Partial<Cantos> | undefined): Cantos {
  return {
    largo1: cantos?.largo1 ?? null,
    largo2: cantos?.largo2 ?? null,
    ancho1: cantos?.ancho1 ?? null,
    ancho2: cantos?.ancho2 ?? null
  };
}

/** Completa una pieza de entrada con los valores por defecto del proyecto. */
export function normalizarPieza(entrada: PiezaEntrada, indice: number): Pieza {
  const pieza: Pieza = {
    id: entrada.id?.trim() || `pieza-${String(indice + 1).padStart(2, '0')}`,
    nombre: entrada.nombre?.trim() || `Pieza ${indice + 1}`,
    largo: redondear(entrada.largo, 1),
    ancho: redondear(entrada.ancho, 1),
    cantidad: entrada.cantidad ?? 1,
    veta: entrada.veta ?? false,
    cantos: cantosConValores(entrada.cantos)
  };
  if (entrada.material) pieza.material = entrada.material;
  if (entrada.grupo) pieza.grupo = entrada.grupo;
  if (entrada.mecanizado) pieza.mecanizado = entrada.mecanizado;
  return pieza;
}

/** Completa un tablero de entrada con los valores por defecto del proyecto. */
export function normalizarTablero(entrada: TableroEntrada, indice: number, piezas: Pieza[] = []): Tablero {
  const unicoMaterial = piezas.length > 0 && new Set(piezas.map(p => p.material ?? '')).size === 1 ? piezas[0]?.material : undefined;
  const largo = redondear(entrada.largo, 1);
  const ancho = redondear(entrada.ancho, 1);
  const tablero: Tablero = {
    id: entrada.id?.trim() || `tablero-${String(indice + 1).padStart(2, '0')}`,
    nombre: entrada.nombre?.trim() || `Tablero ${largo} x ${ancho}`,
    largo,
    ancho,
    espesor: entrada.espesor ?? ESPESOR_POR_DEFECTO,
    kerf: entrada.kerf ?? KERF_POR_DEFECTO,
    cantidad: entrada.cantidad ?? Infinity
  };
  const material = entrada.material ?? unicoMaterial;
  if (material) tablero.material = material;
  return tablero;
}

export function areaM2(largo: number, ancho: number, cantidad = 1): number {
  return redondear((largo * ancho * cantidad) / 1_000_000, 4);
}
