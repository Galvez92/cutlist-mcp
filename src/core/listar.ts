/** Resumen y validación de una lista de piezas. */

import { areaM2, type Pieza, redondear } from './tipos.js';

export interface ResumenPiezas {
  lineas: number;
  unidades: number;
  areaM2: number;
  unidadesConVeta: number;
  unidadesMecanizadas: number;
  materiales: string[];
  porGrupo: { grupo: string; lineas: number; unidades: number; areaM2: number }[];
}

export function resumirPiezas(piezas: Pieza[]): ResumenPiezas {
  const grupos = new Map<string, { lineas: number; unidades: number; areaM2: number }>();
  let unidades = 0;
  let area = 0;
  let conVeta = 0;
  let mecanizadas = 0;

  for (const p of piezas) {
    unidades += p.cantidad;
    area += areaM2(p.largo, p.ancho, p.cantidad);
    if (p.veta) conVeta += p.cantidad;
    if (p.mecanizado) mecanizadas += p.cantidad;

    const clave = p.grupo ?? '(sin grupo)';
    const acumulado = grupos.get(clave) ?? { lineas: 0, unidades: 0, areaM2: 0 };
    acumulado.lineas += 1;
    acumulado.unidades += p.cantidad;
    acumulado.areaM2 = redondear(acumulado.areaM2 + areaM2(p.largo, p.ancho, p.cantidad), 4);
    grupos.set(clave, acumulado);
  }

  const materiales = [...new Set(piezas.map(p => p.material).filter((m): m is string => Boolean(m)))].sort();

  return {
    lineas: piezas.length,
    unidades,
    areaM2: redondear(area, 4),
    unidadesConVeta: conVeta,
    unidadesMecanizadas: mecanizadas,
    materiales,
    porGrupo: [...grupos.entries()].map(([grupo, datos]) => ({ grupo, ...datos }))
  };
}

/** Una línea de texto por pieza, para devolver al agente. */
export function formatearPiezas(piezas: Pieza[]): string {
  return piezas
    .map(p => {
      const cantos = [p.cantos.largo1, p.cantos.largo2, p.cantos.ancho1, p.cantos.ancho2]
        .filter((c): c is string => Boolean(c))
        .length;
      return [
        `- ${p.id}: ${p.nombre} — ${p.largo} x ${p.ancho} mm x${p.cantidad}`,
        p.veta ? 'veta' : 'sin veta',
        p.material ?? 'sin material',
        `${cantos} canto(s)`,
        p.grupo ? `grupo ${p.grupo}` : ''
      ]
        .filter(Boolean)
        .join(' · ');
    })
    .join('\n');
}
