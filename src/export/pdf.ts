/**
 * Exportación PDF (lista de corte + una página por hoja) en base64.
 *
 * El contenido de una herramienta MCP viaja como texto, así que el PDF —que es
 * binario— se entrega codificado en base64; el cliente lo decodifica y lo guarda.
 * La estructura del archivo la resuelve `src/render/pdf.ts` (escritor propio).
 */

import { renderLayoutPdf } from '../render/pdf.js';
import type { LayoutResult } from '../types.js';

export function exportarPdfBase64(layout: LayoutResult): string {
  return Buffer.from(renderLayoutPdf(layout)).toString('base64');
}
