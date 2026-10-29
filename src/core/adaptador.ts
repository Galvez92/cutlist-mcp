/**
 * Adaptador entre el dominio del MCP (Pieza/Tablero con cantos de texto) y el
 * motor de optimizer-engine (PartInput/SheetInput con cantos numéricos).
 *
 * El motor es la única fuente de optimización: este módulo traduce la entrada
 * al formato del motor, llama a `optimize()` y traduce el resultado de vuelta
 * al formato que esperan las herramientas y los exportadores del MCP.
 */

import { optimize } from '../engine/optimize.js';
import type { AlgorithmOption, LayoutResult, PartInput, Placement, SheetInput, SheetLayout, UnplacedPart } from '../engine/types.js';
import { redondear, type Pieza, type Tablero } from './tipos.js';

// ── Tipos del resultado MCP (los que esperan herramientas y exportadores) ──

export type Estrategia = 'guillotina' | 'no-guillotina';

export interface OpcionesOptimizacion {
  estrategia?: Estrategia;
  /** Kerf global en mm; si no se indica, se usa el del tablero. */
  kerf?: number;
  /** Si es `false`, ninguna pieza se rota. */
  permitirRotacion?: boolean;
}

export interface Colocacion {
  etiqueta: string;
  piezaId: string;
  nombre: string;
  grupo?: string;
  x: number;
  y: number;
  largo: number;
  ancho: number;
  rotada: boolean;
}

export interface HojaOptimizada {
  /** Número de hoja en toda la corrida (1..n). */
  indice: number;
  /** Número de hoja dentro de ese tablero. */
  numero: number;
  tableroId: string;
  tableroNombre: string;
  largo: number;
  ancho: number;
  espesor: number;
  material?: string;
  colocaciones: Colocacion[];
  areaUsadaM2: number;
  aprovechamiento: number;
}

export interface ConsumoTablero {
  tableroId: string;
  tableroNombre: string;
  hojas: number;
}

export interface ResumenOptimizacion {
  estrategia: Estrategia;
  kerf: number;
  hojasUsadas: number;
  areaTablerosM2: number;
  areaColocadaM2: number;
  aprovechamiento: number;
  unidadesColocadas: number;
  unidadesSobrantes: number;
}

export interface ResultadoOptimizacion {
  resumen: ResumenOptimizacion;
  hojas: HojaOptimizada[];
  consumo: ConsumoTablero[];
  sobrantes: Pieza[];
}

// ── Conversión de entrada: dominio MCP → motor ──

function piezaAPart(pieza: Pieza): PartInput {
  const input: PartInput = {
    id: pieza.id,
    label: pieza.nombre,
    code: pieza.id,
    width: pieza.largo,
    height: pieza.ancho,
    qty: pieza.cantidad,
    grain: pieza.veta ? 'vertical' : 'none',
  };
  if (pieza.material) input.material = pieza.material;
  return input;
}

function tableroASheet(tablero: Tablero): SheetInput {
  const sheet: SheetInput = {
    id: tablero.id,
    label: tablero.nombre,
    width: tablero.largo,
    height: tablero.ancho,
    thickness: tablero.espesor,
    kerf: tablero.kerf,
    // El motor requiere qty entera; Infinity no es válido. Si el MCP no
    // declaró stock, damos un número alto suficiente para cualquier pedido.
    qty: Number.isFinite(tablero.cantidad) ? Math.max(1, Math.round(tablero.cantidad)) : 10_000,
  };
  if (tablero.material) sheet.material = tablero.material;
  return sheet;
}

function estrategiaAAlgoritmo(estrategia: Estrategia | undefined): AlgorithmOption {
  if (!estrategia) return 'auto';
  return estrategia === 'guillotina' ? 'guillotine' : 'maxrects';
}

// ── Conversión de salida: motor → dominio MCP ──

function algoritmoAEstrategia(algorithm: string): Estrategia {
  return algorithm === 'guillotine' ? 'guillotina' : 'no-guillotina';
}

function colocacionDeMotor(p: Placement, grupo?: string): Colocacion {
  const c: Colocacion = {
    etiqueta: p.code,
    piezaId: p.partId,
    nombre: p.label || p.code,
    x: p.x,
    y: p.y,
    largo: p.width,
    ancho: p.height,
    rotada: p.rotated,
  };
  if (grupo) c.grupo = grupo;
  return c;
}

function hojaDeMotor(sheet: SheetLayout, grupos: Map<string, string>, contador: Map<string, number>): HojaOptimizada {
  const colocaciones: Colocacion[] = sheet.placements.map(p => {
    const n = (contador.get(p.partId) ?? 0) + 1;
    contador.set(p.partId, n);
    const c = colocacionDeMotor(p, grupos.get(p.partId));
    c.etiqueta = `${p.code}-${n}`;
    return c;
  });
  const hoja: HojaOptimizada = {
    indice: sheet.index,
    numero: sheet.instance,
    tableroId: sheet.sheetId,
    tableroNombre: sheet.label,
    largo: sheet.width,
    ancho: sheet.height,
    espesor: sheet.thickness,
    colocaciones,
    areaUsadaM2: redondear(sheet.usedArea / 1_000_000, 4),
    aprovechamiento: redondear(sheet.yieldPct / 100, 4),
  };
  if (sheet.material) hoja.material = sheet.material;
  return hoja;
}

function sobranteDeMotor(entry: UnplacedPart, lookup: Map<string, Pieza>): Pieza {
  const original = lookup.get(entry.partId);
  return {
    id: entry.partId,
    nombre: original?.nombre ?? entry.label ?? entry.code,
    largo: original?.largo ?? 0,
    ancho: original?.ancho ?? 0,
    cantidad: entry.quantity,
    veta: original?.veta ?? false,
    cantos: original?.cantos ?? { largo1: null, largo2: null, ancho1: null, ancho2: null },
    ...(original?.material ? { material: original.material } : {}),
    ...(original?.grupo ? { grupo: original.grupo } : {}),
  };
}

function calcularConsumo(hojas: HojaOptimizada[], tableros: Tablero[]): ConsumoTablero[] {
  const conteo = new Map<string, number>();
  for (const hoja of hojas) {
    conteo.set(hoja.tableroId, (conteo.get(hoja.tableroId) ?? 0) + 1);
  }
  return [...conteo.entries()].map(([tableroId, hojas]) => {
    const tablero = tableros.find(t => t.id === tableroId);
    return { tableroId, tableroNombre: tablero?.nombre ?? tableroId, hojas };
  });
}

// ── Función principal: llama al motor y traduce el resultado ──

export function optimizar(
  piezas: Pieza[],
  tableros: Tablero[],
  opciones: OpcionesOptimizacion = {}
): ResultadoOptimizacion {
  if (piezas.length === 0) throw new Error('Se requiere al menos una pieza.');
  if (tableros.length === 0) throw new Error('Se requiere al menos un tablero en stock.');

  const result: LayoutResult = optimize({
    parts: piezas.map(piezaAPart),
    sheets: tableros.map(tableroASheet),
    ...(opciones.kerf !== undefined ? { kerf: opciones.kerf } : {}),
    ...(opciones.permitirRotacion !== undefined ? { allowRotation: opciones.permitirRotacion } : {}),
    algorithm: estrategiaAAlgoritmo(opciones.estrategia),
  });

  // Lookup de piezas originales para grupos y sobrantes.
  const lookup = new Map(piezas.map(p => [p.id, p]));
  const grupos = new Map<string, string>();
  for (const p of piezas) {
    if (p.grupo) grupos.set(p.id, p.grupo);
  }

  const contador = new Map<string, number>();
  const hojas = result.sheets.map(s => hojaDeMotor(s, grupos, contador));
  const sobrantes = result.unplaced.map(u => sobranteDeMotor(u, lookup));
  const kerf = opciones.kerf ?? tableros[0]?.kerf ?? 0;

  return {
    resumen: {
      estrategia: algoritmoAEstrategia(result.algorithm),
      kerf,
      hojasUsadas: result.metrics.sheetsUsed,
      areaTablerosM2: redondear(result.metrics.sheetArea / 1_000_000, 4),
      areaColocadaM2: redondear(result.metrics.usedArea / 1_000_000, 4),
      aprovechamiento: redondear(result.metrics.yieldPct / 100, 4),
      unidadesColocadas: result.metrics.placed,
      unidadesSobrantes: result.metrics.unplaced,
    },
    hojas,
    consumo: calcularConsumo(hojas, tableros),
    sobrantes,
  };
}
