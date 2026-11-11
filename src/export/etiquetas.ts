/**
 * Etiquetas de taller (CSV) para rotular las piezas ya colocadas.
 *
 * Formato propio, documentado en `docs/formatos/etiquetas.md`: una fila por
 * pieza colocada con la hoja, el código, las medidas terminadas, los cantos, la
 * veta y si va girada. Medidas, veta y rótulo salen de `labelForPlacement()`, el
 * mismo que dibuja el SVG y el PDF; los cantos salen del texto de la pieza
 * (`cantos.largo1` …), que es como los declara el MCP y los módulos.
 */

import type { Pieza } from '../core/tipos.js';
import { labelForPlacement } from '../labels.js';
import type { LayoutResult } from '../types.js';

export const CABECERA_ETIQUETAS = ['hoja', 'codigo', 'pieza', 'medidas', 'cantos', 'veta', 'girada'] as const;

const NOMBRE_LADO: Record<keyof Pieza['cantos'], string> = {
  largo1: 'largo 1',
  largo2: 'largo 2',
  ancho1: 'ancho 1',
  ancho2: 'ancho 2'
};

function celda(valor: string | number): string {
  const texto = String(valor);
  return /[",\n\r]/.test(texto) ? `"${texto.replaceAll('"', '""')}"` : texto;
}

/** Texto de cantos de la pieza, del tipo «largo 1: PVC 0.4 x 22 mm». */
function cantosDePieza(pieza: Pieza | undefined): string {
  if (!pieza) return '';
  return (Object.entries(pieza.cantos) as [keyof Pieza['cantos'], string | null][])
    .filter(([, canto]) => Boolean(canto))
    .map(([lado, canto]) => `${NOMBRE_LADO[lado]}: ${canto}`)
    .join(' · ');
}

export function exportarEtiquetas(layout: LayoutResult, piezas: Pieza[] = []): string {
  const porId = new Map(piezas.map(pieza => [pieza.id, pieza]));
  const copias = new Map<string, number>();
  const filas: string[] = [];
  for (const sheet of layout.sheets) {
    for (const placement of sheet.placements) {
      const etiqueta = labelForPlacement(placement, sheet);
      const veta = etiqueta.lines.find(linea => linea.startsWith('Veta')) ?? '';
      const cantos = cantosDePieza(porId.get(placement.partId)) || etiqueta.edgeText;
      // Como en `optimizar_corte`, cada copia lleva su número: costado-1, costado-2…
      const n = (copias.get(placement.partId) ?? 0) + 1;
      copias.set(placement.partId, n);
      const codigo = `${placement.code}-${n}`;
      filas.push(
        [sheet.index, codigo, etiqueta.title, etiqueta.sizeText, cantos, veta, placement.rotated ? 'si' : 'no']
          .map(celda)
          .join(',')
      );
    }
  }
  return `${[CABECERA_ETIQUETAS.join(','), ...filas].join('\n')}\n`;
}
