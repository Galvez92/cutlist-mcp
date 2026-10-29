/**
 * Modelo de datos común para los formatos de importación/exportación.
 *
 * Convenciones (iguales que el modelo original en Python):
 * - Unidades: milímetros (mm), salvo que el formato indique lo contrario.
 * - Cantos: claves `c1`/`c2` (lados del largo) y `l1`/`l2` (lados del ancho), la
 *   misma convención que el JSON de Cortecloud. El valor es el TEXTO del canto
 *   (`null` = sin canto). Se conservan como texto porque los archivos los traen
 *   así (p.ej. "PVC 719L") y no se inventa un espesor en mm.
 * - Veta: `true` con veta, `false` sin veta, `null` desconocido. Es tri-estado y
 *   no se reduce a `GrainDirection` del motor sin perder la distinción
 *   `null`/`false` (necesaria para el ida y vuelta fiel).
 *
 * Los formatos usan los tipos del motor (`src/types.ts`, rama optimizer-engine)
 * donde encajan sin pérdida: el exportador de DXF consume el `LayoutResult` del
 * motor (hojas con piezas colocadas). La pieza de los formatos no se fuerza a
 * `PartInput` porque sus cantos son texto y su veta es tri-estado: reducirlos
 * inventaría datos.
 */

export const VERIFICADO = "verificado";
export const PARCIAL = "parcial";
export const POR_REVISAR = "por revisar";
export type EstadoVerificacion = typeof VERIFICADO | typeof PARCIAL | typeof POR_REVISAR;

/** Dato inválido dentro de una lista de piezas. */
export class DataError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DataError";
  }
}

/** Documentación pública consultada para un formato. */
export interface Source {
  url: string;
  descripcion: string;
}

/** Dato no verificado; se marca «por revisar» con su fuente. */
export interface Notice {
  mensaje: string;
  fuente: string | null;
  estado: EstadoVerificacion;
}

export function noticeText(aviso: Notice): string {
  const base = `${aviso.estado}: ${aviso.mensaje}`;
  return aviso.fuente ? `${base} (fuente: ${aviso.fuente})` : base;
}

export type Cantos = Partial<Record<"c1" | "c2" | "l1" | "l2", string>>;

/** Una pieza de tablero. */
export class Piece {
  readonly nombre: string;
  readonly largo: number;
  readonly ancho: number;
  cantidad: number;
  material: string | null;
  espesor: number | null;
  veta: boolean | null;
  cantos: Cantos;
  grupo: string | null;
  etiqueta: string | null;
  notas: string | null;
  extra: Record<string, unknown>;

  constructor(args: {
    nombre: string;
    largo: number;
    ancho: number;
    cantidad?: number | null;
    material?: string | null;
    espesor?: number | null;
    veta?: boolean | null;
    cantos?: Record<string, string | null>;
    grupo?: string | null;
    etiqueta?: string | null;
    notas?: string | null;
    extra?: Record<string, unknown>;
  }) {
    const nombre = (args.nombre ?? "").trim() || "sin nombre";
    const largo = Number(args.largo);
    const ancho = Number(args.ancho);
    if (!Number.isFinite(largo) || !Number.isFinite(ancho) || largo <= 0 || ancho <= 0) {
      throw new DataError(
        `pieza ${JSON.stringify(nombre)}: largo y ancho deben ser > 0 ` +
          `(largo=${largo}, ancho=${ancho})`,
      );
    }
    let cantidad = args.cantidad ?? 1;
    cantidad = Math.trunc(Number(cantidad));
    if (!Number.isFinite(cantidad) || cantidad < 1) {
      throw new DataError(`pieza ${JSON.stringify(nombre)}: cantidad debe ser >= 1`);
    }
    this.nombre = nombre;
    this.largo = largo;
    this.ancho = ancho;
    this.cantidad = cantidad;
    this.material = args.material ?? null;
    this.espesor = args.espesor ?? null;
    this.veta = args.veta ?? null;
    this.cantos = filterCantos(args.cantos);
    this.grupo = args.grupo ?? null;
    this.etiqueta = args.etiqueta ?? null;
    this.notas = args.notas ?? null;
    this.extra = { ...(args.extra ?? {}) };
  }

  get areaMm2(): number {
    return this.largo * this.ancho;
  }

  get areaTotalM2(): number {
    return (this.areaMm2 * this.cantidad) / 1_000_000;
  }
}

function filterCantos(cantos?: Record<string, string | null>): Cantos {
  const out: Cantos = {};
  if (!cantos) return out;
  for (const [key, value] of Object.entries(cantos)) {
    if (value) out[key as "c1" | "c2" | "l1" | "l2"] = value;
  }
  return out;
}

/** Conjunto de piezas leído de (o destinado a) algún formato. */
export class CutList {
  piezas: Piece[];
  origen: string | null;
  metadatos: Record<string, unknown>;
  avisos: Notice[];

  constructor(
    args: {
      piezas?: Piece[];
      origen?: string | null;
      metadatos?: Record<string, unknown>;
      avisos?: Notice[];
    } = {},
  ) {
    this.piezas = args.piezas ?? [];
    this.origen = args.origen ?? null;
    this.metadatos = args.metadatos ?? {};
    this.avisos = args.avisos ?? [];
  }

  agregar(pieza: Piece): Piece {
    this.piezas.push(pieza);
    return pieza;
  }

  avisar(mensaje: string, fuente: string | null = null): void {
    this.avisos.push({ mensaje, fuente, estado: POR_REVISAR });
  }

  porRevisar(): Notice[] {
    return this.avisos.filter((a) => a.estado === POR_REVISAR);
  }

  get totalPiezas(): number {
    return this.piezas.reduce((sum, p) => sum + p.cantidad, 0);
  }

  get areaTotalM2(): number {
    return this.piezas.reduce((sum, p) => sum + p.areaTotalM2, 0);
  }
}
