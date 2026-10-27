/**
 * Módulos paramétricos: medidas del módulo → lista de piezas con canto y veta.
 *
 * Geometría del proyecto (no es una norma de fabricante; los valores por defecto
 * están marcados en `docs/mcp-server.md` para revisión):
 * - Los laterales son las dos piezas verticales; la base y la tapa van entre ellos.
 * - La trasera es una pieza completa montada por detrás del cuerpo.
 * - `largo1` marca la orilla frontal (ver `Cantos` en `tipos.ts`).
 * - En las piezas verticales (laterales, puertas y frentes de cajón) el eje `largo` es el
 *   vertical, que es también el eje de la veta: en ellas `largo` puede ser menor que `ancho`.
 */

import {
  areaM2,
  type Canto,
  type Pieza,
  ESPESOR_POR_DEFECTO,
  SIN_CANTOS,
  redondear
} from './tipos';

export const TIPOS_MODULO = ['cajonera', 'closet', 'cocina', 'librero'] as const;
export type TipoModulo = (typeof TIPOS_MODULO)[number];

export interface ParametrosModulo {
  tipo: TipoModulo;
  /** Ancho exterior del módulo. */
  ancho: number;
  /** Alto exterior del módulo (en `cocina` incluye el zócalo). */
  alto: number;
  /** Profundidad exterior del módulo. */
  profundidad: number;
  /** Espesor del tablero del cuerpo. Por defecto 18 mm (perfil de MEMORIA). */
  espesor?: number;
  /** Texto del canto de las orillas frontales; `null` = sin canto. */
  cantoFrente?: Canto;
  /** Cajonera: número de frentes de cajón. Por defecto 3 (valor del proyecto, por revisar). */
  numeroCajones?: number;
  /** Clóset y librero: número de estantes. Por defecto 1 (clóset) y 4 (librero). */
  numeroEstantes?: number;
  /** Cocina: número de puertas. Por defecto 2 (valor del proyecto, por revisar). */
  numeroPuertas?: number;
  /** Cocina: alto del zócalo. Por defecto 100 mm (valor del proyecto, por revisar). */
  altoZocalo?: number;
  /** Holgura entre frentes y entre puertas. Por defecto 3 mm (valor del proyecto, por revisar). */
  holgura?: number;
  /** Nombre del módulo; se usa como `grupo` de cada pieza. */
  nombre?: string;
  material?: string;
}

const HOLGURA_POR_DEFECTO = 3;
const ALTO_ZOCALO_POR_DEFECTO = 100;

interface ContextoModulo {
  nombre: string;
  espFinal: number;
  holgura: number;
  cantoFrente: Canto;
  material?: string;
}

function pieza(
  ctx: ContextoModulo,
  sufijo: string,
  nombre: string,
  largo: number,
  ancho: number,
  opciones: { cantidad?: number; veta: boolean; cantos?: Partial<typeof SIN_CANTOS> } = { veta: false }
): Pieza {
  const resultado: Pieza = {
    id: `${ctx.nombre}-${sufijo}`,
    nombre,
    largo: redondear(largo, 1),
    ancho: redondear(ancho, 1),
    cantidad: opciones.cantidad ?? 1,
    veta: opciones.veta,
    cantos: { ...SIN_CANTOS, ...opciones.cantos }
  };
  resultado.grupo = ctx.nombre;
  if (ctx.material) resultado.material = ctx.material;
  return resultado;
}

/** Genera la lista de piezas de un módulo paramétrico. */
export function generarModulo(parametros: ParametrosModulo): Pieza[] {
  const espFinal = parametros.espesor ?? ESPESOR_POR_DEFECTO;
  const holgura = parametros.holgura ?? HOLGURA_POR_DEFECTO;
  const cantoFrente = parametros.cantoFrente ?? null;
  const nombre = parametros.nombre?.trim() || parametros.tipo;

  const ctx: ContextoModulo = { nombre, espFinal, holgura, cantoFrente };
  if (parametros.material) ctx.material = parametros.material;

  const ancho = parametros.ancho;
  const profundidad = parametros.profundidad;
  const alto =
    parametros.tipo === 'cocina'
      ? parametros.alto - (parametros.altoZocalo ?? ALTO_ZOCALO_POR_DEFECTO)
      : parametros.alto;

  validarMedidas(parametros, alto, espFinal, holgura);

  const anchoInterior = redondear(ancho - 2 * espFinal, 1);
  const piezas: Pieza[] = [
    pieza(ctx, 'lat', 'Lateral', alto, profundidad, { cantidad: 2, veta: true, cantos: { largo1: cantoFrente } }),
    pieza(ctx, 'base', 'Base', anchoInterior, profundidad, { veta: false, cantos: { largo1: cantoFrente } }),
    pieza(ctx, 'tapa', 'Tapa', anchoInterior, profundidad, { veta: false, cantos: { largo1: cantoFrente } }),
    pieza(ctx, 'tras', 'Trasera', ancho, alto, { veta: false })
  ];

  switch (parametros.tipo) {
    case 'cajonera': {
      const numero = parametros.numeroCajones ?? 3;
      const altoFrente = redondear((alto - 2 * espFinal) / numero - holgura, 1);
      piezas.push(
        pieza(ctx, 'frente', 'Frente de cajón', altoFrente, ancho, {
          cantidad: numero,
          veta: true,
          cantos: { largo1: cantoFrente, largo2: cantoFrente, ancho1: cantoFrente, ancho2: cantoFrente }
        })
      );
      break;
    }
    case 'closet':
    case 'librero': {
      const numero =
        parametros.numeroEstantes ?? (parametros.tipo === 'closet' ? 1 : 4);
      piezas.push(
        pieza(ctx, 'estante', 'Estante', anchoInterior, profundidad, {
          cantidad: numero,
          veta: false,
          cantos: { largo1: cantoFrente }
        })
      );
      break;
    }
    case 'cocina': {
      const altoZocalo = parametros.altoZocalo ?? ALTO_ZOCALO_POR_DEFECTO;
      const numero = parametros.numeroPuertas ?? 2;
      const anchoPuerta = redondear((ancho - (numero - 1) * holgura) / numero, 1);
      const altoPuerta = redondear(alto - holgura, 1);
      piezas.push(
        pieza(ctx, 'zocalo', 'Zócalo', parametros.ancho, altoZocalo, { veta: false }),
        pieza(ctx, 'puerta', 'Puerta', altoPuerta, anchoPuerta, {
          cantidad: numero,
          veta: true,
          cantos: { largo1: cantoFrente, largo2: cantoFrente, ancho1: cantoFrente, ancho2: cantoFrente }
        })
      );
      break;
    }
  }

  return piezas;
}

function validarMedidas(parametros: ParametrosModulo, alto: number, espFinal: number, holgura: number): void {
  if (parametros.ancho - 2 * espFinal <= 0) {
    throw new Error('El ancho debe ser mayor que dos veces el espesor del tablero.');
  }
  if (alto - 2 * espFinal <= 0) {
    throw new Error('El alto debe ser mayor que dos veces el espesor del tablero.');
  }
  if (parametros.profundidad <= 0) {
    throw new Error('La profundidad debe ser mayor que cero.');
  }
  if (parametros.tipo === 'cajonera') {
    const numero = parametros.numeroCajones ?? 3;
    const altoFrente = (alto - 2 * espFinal) / numero - holgura;
    if (altoFrente <= 0) {
      throw new Error('El alto del módulo no admite ese número de cajones con la holgura pedida.');
    }
  }
  if (parametros.tipo === 'cocina') {
    const numeroPuertas = parametros.numeroPuertas ?? 2;
    if ((parametros.ancho - (numeroPuertas - 1) * holgura) / numeroPuertas <= 0) {
      throw new Error('El ancho del módulo no admite ese número de puertas con la holgura pedida.');
    }
  }
}

export function areaPiezasM2(piezas: Pieza[]): number {
  return redondear(
    piezas.reduce((total, p) => total + areaM2(p.largo, p.ancho, p.cantidad), 0),
    4
  );
}
