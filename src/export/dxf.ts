/**
 * Exportación DXF ASCII (estructura mínima R12: sección ENTITIES y marcador EOF).
 *
 * Fuentes consultadas (2026-10-27):
 * - Autodesk, *DXF Reference* (R12, AC1009): https://damassets.autodesk.net/content/dam/autodesk/www/developer-network/platform-technologies/autocad-dxf-archive/acad_r12_dxf.pdf
 * - ezdxf, *DXF File Structure* (contenido mínimo R12): https://ezdxf.readthedocs.io/en/stable/dxfinternals/filestructure.html
 *
 * **Por revisar**: la salida no se ha abierto con un CAD real; se usa LINE (grupos 10/20/30 y 11/21/31)
 * y TEXT (10/20/30, 40, 1) en las capas TABLERO, PIEZA y ETIQUETA, sin tabla de capas.
 */

import type { ResultadoOptimizacion } from '../core/adaptador';
import { componerLienzo } from './disposicion';

const SEPARACION_HOJAS = 200;

function numero(valor: number): string {
  return String(Number(valor.toFixed(3)));
}

function par(codigo: number, valor: string | number): string[] {
  return [String(codigo), String(valor)];
}

function linea(x1: number, y1: number, x2: number, y2: number, capa: string): string[] {
  return [
    ...par(0, 'LINE'),
    ...par(8, capa),
    ...par(10, numero(x1)),
    ...par(20, numero(y1)),
    ...par(30, 0),
    ...par(11, numero(x2)),
    ...par(21, numero(y2)),
    ...par(31, 0)
  ];
}

function rectangulo(x: number, y: number, largo: number, ancho: number, capa: string): string[] {
  return [
    ...linea(x, y, x + largo, y, capa),
    ...linea(x + largo, y, x + largo, y + ancho, capa),
    ...linea(x + largo, y + ancho, x, y + ancho, capa),
    ...linea(x, y + ancho, x, y, capa)
  ];
}

function texto(x: number, y: number, alto: number, contenido: string, capa: string): string[] {
  return [
    ...par(0, 'TEXT'),
    ...par(8, capa),
    ...par(10, numero(x)),
    ...par(20, numero(y)),
    ...par(30, 0),
    ...par(40, numero(alto)),
    ...par(1, contenido)
  ];
}

export function exportarDxf(resultado: ResultadoOptimizacion): string {
  const lienzo = componerLienzo(resultado.hojas, SEPARACION_HOJAS);
  const entidades: string[] = [];

  for (const { hoja, x, y } of lienzo.ubicadas) {
    entidades.push(...rectangulo(x, y, hoja.largo, hoja.ancho, 'TABLERO'));
    entidades.push(
      ...texto(x, y - 60, 48, `Hoja ${hoja.indice} ${(hoja.aprovechamiento * 100).toFixed(1)}%`, 'ETIQUETA')
    );
    for (const colocacion of hoja.colocaciones) {
      entidades.push(
        ...rectangulo(x + colocacion.x, y + colocacion.y, colocacion.largo, colocacion.ancho, 'PIEZA')
      );
      if (colocacion.largo >= 120 && colocacion.ancho >= 120) {
        entidades.push(
          ...texto(
            x + colocacion.x + 12,
            y + colocacion.y + 60,
            Math.min(48, colocacion.ancho * 0.3),
            colocacion.etiqueta,
            'ETIQUETA'
          )
        );
      }
    }
  }

  const salida = [
    ...par(0, 'SECTION'),
    ...par(2, 'ENTITIES'),
    ...entidades,
    ...par(0, 'ENDSEC'),
    ...par(0, 'EOF')
  ];

  return `${salida.join('\n')}\n`;
}
