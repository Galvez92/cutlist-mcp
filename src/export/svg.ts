/**
 * Exportación SVG del layout optimizado: una hoja por bloque, apiladas en vertical.
 * El SVG es un formato público (W3C, https://www.w3.org/TR/SVG2/), verificado por
 * estructura y por parseo XML en las pruebas.
 */

import type { ResultadoOptimizacion } from '../core/adaptador.js';
import { componerLienzo } from './disposicion.js';

const ETIQUETA_MINIMA = 120;

function tamanoTexto(largo: number, ancho: number, texto: string): number {
  const porAlto = ancho * 0.45;
  const porLargo = (largo / Math.max(texto.length, 1)) * 1.3;
  return Math.max(24, Math.min(60, porAlto, porLargo));
}

export function exportarSvg(resultado: ResultadoOptimizacion): string {
  const lienzo = componerLienzo(resultado.hojas);
  const margen = 40;
  const ancho = lienzo.largo + margen * 2;
  const alto = lienzo.alto + margen * 2;

  const bloques = lienzo.ubicadas
    .map(({ hoja, x, y }) => {
      const tx = margen + x;
      const ty = margen + y;
      const piezas = hoja.colocaciones
        .map(colocacion => {
          const px = tx + colocacion.x;
          const py = ty + colocacion.y;
          const rect = `<rect x="${px}" y="${py}" width="${colocacion.largo}" height="${colocacion.ancho}" fill="#e8f0fb" stroke="#1f3d63" stroke-width="4" />`;
          if (colocacion.largo < ETIQUETA_MINIMA || colocacion.ancho < ETIQUETA_MINIMA) {
            return rect;
          }
          const tamano = tamanoTexto(colocacion.largo, colocacion.ancho, colocacion.etiqueta);
          const texto = `<text x="${px + 12}" y="${py + tamano + 12}" font-family="monospace" font-size="${tamano}" fill="#1f3d63">${escapar(colocacion.etiqueta)}</text>`;
          return rect + texto;
        })
        .join('\n    ');

      return `  <g id="hoja-${hoja.indice}" data-tablero="${escapar(hoja.tableroNombre)}">
    <rect x="${tx}" y="${ty}" width="${hoja.largo}" height="${hoja.ancho}" fill="#ffffff" stroke="#111111" stroke-width="8" />
    <text x="${tx}" y="${ty - 12}" font-family="monospace" font-size="48" fill="#111111">Hoja ${hoja.indice} · ${escapar(hoja.tableroNombre)} · ${(hoja.aprovechamiento * 100).toFixed(1)}%</text>
    ${piezas}
  </g>`;
    })
    .join('\n');

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${ancho}mm" height="${alto}mm" viewBox="0 0 ${ancho} ${alto}">`,
    '  <desc>Layout de corte generado por cutlist-mcp</desc>',
    bloques,
    '</svg>',
    ''
  ].join('\n');
}

export function escapar(texto: string): string {
  return texto
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}
