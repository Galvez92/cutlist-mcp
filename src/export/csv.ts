/**
 * Exportación CSV genérica (esquema propio del proyecto, documentado en `docs/mcp-server.md`).
 * Separador coma, una línea por pieza, cabecera fija, comillas dobles cuando el campo lo necesita.
 */

import type { Pieza } from '../core/tipos';

export const CABECERA_CSV = [
  'id',
  'nombre',
  'largo_mm',
  'ancho_mm',
  'cantidad',
  'veta',
  'canto_largo1',
  'canto_largo2',
  'canto_ancho1',
  'canto_ancho2',
  'material',
  'grupo'
] as const;

function celda(valor: string | number | boolean | null): string {
  if (valor === null) return '';
  const texto = String(valor);
  if (/[",\n\r]/.test(texto)) return `"${texto.replaceAll('"', '""')}"`;
  return texto;
}

export function exportarCsv(piezas: Pieza[]): string {
  const filas = piezas.map(p =>
    [
      p.id,
      p.nombre,
      p.largo,
      p.ancho,
      p.cantidad,
      p.veta ? 'si' : 'no',
      p.cantos.largo1,
      p.cantos.largo2,
      p.cantos.ancho1,
      p.cantos.ancho2,
      p.material ?? '',
      p.grupo ?? ''
    ]
      .map(celda)
      .join(',')
  );
  return `${[CABECERA_CSV.join(','), ...filas].join('\n')}\n`;
}
