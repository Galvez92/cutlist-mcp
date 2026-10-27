/**
 * Optimizador de corte (nesting) sobre tableros rectangulares.
 *
 * Dos estrategias, ambas deterministas:
 * - `guillotina`: estantes horizontales. Cada corte atraviesa la pieza de lado a lado,
 *   como una sierra escuadradora; el kerf se descuenta entre piezas y entre estantes.
 * - `no-guillotina`: MaxRects (best short side fit) con lista de rectángulos libres.
 *   Aquí el kerf se maneja inflando cada pieza, y por eso también deja kerf en los
 *   bordes del tablero (simplificación documentada).
 *
 * Heurística de orden: área descendente y, en empate, primero las piezas con veta.
 * Se coloca en la primera hoja compatible con espacio (first fit) y, si no hay,
 * se abre una hoja nueva.
 */

import { areaM2, type Pieza, type Tablero, redondear } from './tipos';

export type Estrategia = 'guillotina' | 'no-guillotina';

export interface OpcionesOptimizacion {
  estrategia?: Estrategia;
  /** Kerf global en mm; si no se indica, se usa el del tablero. */
  kerf?: number;
  /** Si es `false`, ninguna pieza se rota (además de las que tienen veta). */
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

interface Rect {
  x: number;
  y: number;
  largo: number;
  ancho: number;
}

interface Estante {
  y: number;
  alto: number;
  cursor: number;
}

interface Sobre {
  tablero: Tablero;
  numero: number;
  colocaciones: Colocacion[];
  estantes: Estante[];
  libres: Rect[];
  areaUsada: number;
}

const EPS = 1e-6;

interface Unidad {
  etiqueta: string;
  pieza: Pieza;
}

export function optimizar(
  piezas: Pieza[],
  tableros: Tablero[],
  opciones: OpcionesOptimizacion = {}
): ResultadoOptimizacion {
  if (piezas.length === 0) throw new Error('Se requiere al menos una pieza.');
  if (tableros.length === 0) throw new Error('Se requiere al menos un tablero en stock.');

  const estrategia = opciones.estrategia ?? 'guillotina';
  const permitirRotacion = opciones.permitirRotacion ?? true;

  const unidades = expandirUnidades(piezas);
  const sobres: Sobre[] = [];
  const hojasPorTablero = new Map<string, number>();
  const sobrantesPorId = new Map<string, Pieza>();

  for (const unidad of unidades) {
    let colocado = false;

    for (const sobre of sobres) {
      if (!compatible(unidad.pieza, sobre.tablero)) continue;
      const colocacion = colocarEnHoja(sobre, unidad, estrategia, permitirRotacion, opciones.kerf);
      if (colocacion) {
        colocado = true;
        break;
      }
    }

    if (!colocado) {
      for (const tablero of tableros) {
        if (!compatible(unidad.pieza, tablero)) continue;
        const usadas = hojasPorTablero.get(tablero.id) ?? 0;
        if (usadas >= tablero.cantidad) continue;

        const sobre = crearSobre(tablero, usadas + 1);
        if (colocarEnHoja(sobre, unidad, estrategia, permitirRotacion, opciones.kerf)) {
          sobres.push(sobre);
          hojasPorTablero.set(tablero.id, usadas + 1);
          colocado = true;
          break;
        }
      }
    }

    if (!colocado) {
      const previo = sobrantesPorId.get(unidad.pieza.id);
      if (previo) {
        previo.cantidad += 1;
      } else {
        sobrantesPorId.set(unidad.pieza.id, { ...unidad.pieza, cantidad: 1 });
      }
    }
  }

  const hojas = sobres.map((sobre, i) => construirHoja(sobre, i + 1));
  const areaTableros = redondear(
    sobres.reduce((total, s) => total + areaM2(s.tablero.largo, s.tablero.ancho), 0),
    4
  );
  const areaColocada = redondear(
    sobres.reduce((total, s) => total + s.areaUsada, 0),
    4
  );

  return {
    resumen: {
      estrategia,
      kerf: opciones.kerf ?? tableros[0]?.kerf ?? 0,
      hojasUsadas: sobres.length,
      areaTablerosM2: areaTableros,
      areaColocadaM2: areaColocada,
      aprovechamiento: areaTableros > 0 ? redondear(areaColocada / areaTableros, 4) : 0,
      unidadesColocadas: sobres.reduce((total, s) => total + s.colocaciones.length, 0),
      unidadesSobrantes: [...sobrantesPorId.values()].reduce((total, p) => total + p.cantidad, 0)
    },
    hojas,
    consumo: [...hojasPorTablero.entries()].map(([tableroId, hojasUsadas]) => {
      const tablero = tableros.find(t => t.id === tableroId);
      return {
        tableroId,
        tableroNombre: tablero?.nombre ?? tableroId,
        hojas: hojasUsadas
      };
    }),
    sobrantes: [...sobrantesPorId.values()]
  };
}

function expandirUnidades(piezas: Pieza[]): Unidad[] {
  const unidades: Unidad[] = [];
  for (const pieza of piezas) {
    for (let n = 1; n <= pieza.cantidad; n += 1) {
      unidades.push({ etiqueta: `${pieza.id}-${n}`, pieza: { ...pieza, cantidad: 1 } });
    }
  }
  return unidades.sort((a, b) => {
    const areaA = a.pieza.largo * a.pieza.ancho;
    const areaB = b.pieza.largo * b.pieza.ancho;
    if (Math.abs(areaA - areaB) > EPS) return areaB - areaA;
    return Number(b.pieza.veta) - Number(a.pieza.veta);
  });
}

function compatible(pieza: Pieza, tablero: Tablero): boolean {
  if (!pieza.material || !tablero.material) return true;
  return pieza.material === tablero.material;
}

function kerfDe(tablero: Tablero, kerfGlobal: number | undefined): number {
  return kerfGlobal ?? tablero.kerf;
}

function crearSobre(tablero: Tablero, numero: number): Sobre {
  return {
    tablero,
    numero,
    colocaciones: [],
    estantes: [],
    libres: [{ x: 0, y: 0, largo: tablero.largo, ancho: tablero.ancho }],
    areaUsada: 0
  };
}

interface Orientacion {
  largo: number;
  ancho: number;
  rotada: boolean;
}

function orientacionesDe(pieza: Pieza, permitirRotacion: boolean): Orientacion[] {
  const base: Orientacion = { largo: pieza.largo, ancho: pieza.ancho, rotada: false };
  const puedeRotar = permitirRotacion && !pieza.veta && pieza.largo !== pieza.ancho;
  if (!puedeRotar) return [base];
  return [base, { largo: pieza.ancho, ancho: pieza.largo, rotada: true }];
}

function colocarEnHoja(
  sobre: Sobre,
  unidad: Unidad,
  estrategia: Estrategia,
  permitirRotacion: boolean,
  kerfGlobal: number | undefined
): Colocacion | null {
  const kerf = kerfDe(sobre.tablero, kerfGlobal);
  return estrategia === 'guillotina'
    ? colocarGuillotina(sobre, unidad, permitirRotacion, kerf)
    : colocarLibre(sobre, unidad, permitirRotacion, kerf);
}

function nuevaColocacion(unidad: Unidad, x: number, y: number, orientacion: Orientacion): Colocacion {
  const colocacion: Colocacion = {
    etiqueta: unidad.etiqueta,
    piezaId: unidad.pieza.id,
    nombre: unidad.pieza.nombre,
    x: redondear(x, 2),
    y: redondear(y, 2),
    largo: orientacion.largo,
    ancho: orientacion.ancho,
    rotada: orientacion.rotada
  };
  if (unidad.pieza.grupo) colocacion.grupo = unidad.pieza.grupo;
  return colocacion;
}

function registrar(sobre: Sobre, colocacion: Colocacion): void {
  sobre.colocaciones.push(colocacion);
  sobre.areaUsada += (colocacion.largo * colocacion.ancho) / 1_000_000;
}

function colocarGuillotina(
  sobre: Sobre,
  unidad: Unidad,
  permitirRotacion: boolean,
  kerf: number
): Colocacion | null {
  const { tablero } = sobre;
  const orientaciones = orientacionesDe(unidad.pieza, permitirRotacion);

  for (const orientacion of orientaciones) {
    for (const estante of sobre.estantes) {
      if (
        orientacion.ancho <= estante.alto + EPS &&
        estante.cursor + orientacion.largo <= tablero.largo + EPS
      ) {
        const colocacion = nuevaColocacion(unidad, estante.cursor, estante.y, orientacion);
        estante.cursor += orientacion.largo + kerf;
        registrar(sobre, colocacion);
        return colocacion;
      }
    }
  }

  for (const orientacion of orientaciones) {
    const ultimo = sobre.estantes.at(-1);
    const y = ultimo ? ultimo.y + ultimo.alto + kerf : 0;
    if (
      orientacion.ancho <= tablero.ancho - y + EPS &&
      orientacion.largo <= tablero.largo + EPS
    ) {
      sobre.estantes.push({ y, alto: orientacion.ancho, cursor: orientacion.largo + kerf });
      const colocacion = nuevaColocacion(unidad, 0, y, orientacion);
      registrar(sobre, colocacion);
      return colocacion;
    }
  }

  return null;
}

function colocarLibre(sobre: Sobre, unidad: Unidad, permitirRotacion: boolean, kerf: number): Colocacion | null {
  const orientaciones = orientacionesDe(unidad.pieza, permitirRotacion);
  let mejor: { libre: Rect; orientacion: Orientacion; sobraCorta: number; sobraLarga: number } | null = null;

  for (const libre of sobre.libres) {
    for (const orientacion of orientaciones) {
      const largo = orientacion.largo + kerf;
      const ancho = orientacion.ancho + kerf;
      if (largo <= libre.largo + EPS && ancho <= libre.ancho + EPS) {
        const sobraCorta = Math.min(libre.largo - largo, libre.ancho - ancho);
        const sobraLarga = Math.max(libre.largo - largo, libre.ancho - ancho);
        if (
          !mejor ||
          sobraCorta < mejor.sobraCorta - EPS ||
          (Math.abs(sobraCorta - mejor.sobraCorta) <= EPS && sobraLarga < mejor.sobraLarga - EPS)
        ) {
          mejor = { libre, orientacion, sobraCorta, sobraLarga };
        }
      }
    }
  }

  if (!mejor) return null;

  const colocacion = nuevaColocacion(unidad, mejor.libre.x, mejor.libre.y, mejor.orientacion);
  dividirLibres(sobre, {
    x: mejor.libre.x,
    y: mejor.libre.y,
    largo: mejor.orientacion.largo + kerf,
    ancho: mejor.orientacion.ancho + kerf
  });
  registrar(sobre, colocacion);
  return colocacion;
}

/** MaxRects: parte cada rectángulo libre que solapa con el espacio ocupado. */
function dividirLibres(sobre: Sobre, ocupado: Rect): void {
  const restantes: Rect[] = [];

  for (const libre of sobre.libres) {
    if (!solapan(libre, ocupado)) {
      restantes.push(libre);
      continue;
    }

    if (ocupado.y > libre.y + EPS) {
      restantes.push({ x: libre.x, y: libre.y, largo: libre.largo, ancho: ocupado.y - libre.y });
    }
    const bordeInferior = ocupado.y + ocupado.ancho;
    if (bordeInferior < libre.y + libre.ancho - EPS) {
      restantes.push({
        x: libre.x,
        y: bordeInferior,
        largo: libre.largo,
        ancho: libre.y + libre.ancho - bordeInferior
      });
    }
    if (ocupado.x > libre.x + EPS) {
      restantes.push({ x: libre.x, y: libre.y, largo: ocupado.x - libre.x, ancho: libre.ancho });
    }
    const bordeDerecho = ocupado.x + ocupado.largo;
    if (bordeDerecho < libre.x + libre.largo - EPS) {
      restantes.push({
        x: bordeDerecho,
        y: libre.y,
        largo: libre.x + libre.largo - bordeDerecho,
        ancho: libre.ancho
      });
    }
  }

  // Purga: un rectángulo libre contenido en otro no aporta nada.
  sobre.libres = restantes.filter(
    (rect, i) =>
      !restantes.some(
        (otro, j) =>
          i !== j &&
          rect.x >= otro.x - EPS &&
          rect.y >= otro.y - EPS &&
          rect.x + rect.largo <= otro.x + otro.largo + EPS &&
          rect.y + rect.ancho <= otro.y + otro.ancho + EPS
      )
  );
}

function solapan(a: Rect, b: Rect): boolean {
  return (
    a.x < b.x + b.largo - EPS &&
    a.x + a.largo > b.x + EPS &&
    a.y < b.y + b.ancho - EPS &&
    a.y + a.ancho > b.y + EPS
  );
}

function construirHoja(sobre: Sobre, indice: number): HojaOptimizada {
  const hoja: HojaOptimizada = {
    indice,
    numero: sobre.numero,
    tableroId: sobre.tablero.id,
    tableroNombre: sobre.tablero.nombre,
    largo: sobre.tablero.largo,
    ancho: sobre.tablero.ancho,
    espesor: sobre.tablero.espesor,
    colocaciones: sobre.colocaciones,
    areaUsadaM2: redondear(sobre.areaUsada, 4),
    aprovechamiento: redondear(sobre.areaUsada / ((sobre.tablero.largo * sobre.tablero.ancho) / 1_000_000), 4)
  };
  if (sobre.tablero.material) hoja.material = sobre.tablero.material;
  return hoja;
}
