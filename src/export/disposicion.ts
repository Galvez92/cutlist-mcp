/**
 * Disposición vertical de las hojas optimizadas, compartida por el export SVG y DXF.
 * Las coordenadas son milímetros en el mismo sistema que el optimizador (X a la derecha, Y hacia abajo).
 */

import type { HojaOptimizada } from '../core/adaptador.js';

export interface HojaUbicada {
  hoja: HojaOptimizada;
  x: number;
  y: number;
}

export interface Lienzo {
  ubicadas: HojaUbicada[];
  largo: number;
  alto: number;
}

export function componerLienzo(hojas: HojaOptimizada[], separacion = 200): Lienzo {
  const largo = Math.max(0, ...hojas.map(h => h.largo));
  let cursor = 0;
  const ubicadas = hojas.map(hoja => {
    const ubicada: HojaUbicada = { hoja, x: (largo - hoja.largo) / 2, y: cursor };
    cursor += hoja.ancho + separacion;
    return ubicada;
  });
  return { ubicadas, largo, alto: Math.max(0, cursor - separacion) };
}
