/**
 * Catálogo de formatos de exportación soportados por el servidor MCP.
 *
 * Cada formato declara su estado de verificación. Los que no se han podido
 * contrastar contra una herramienta o documento real van marcados `por revisar`
 * junto con la fuente consultada (regla 5 de AGENTS.md).
 */

import type { ResultadoOptimizacion } from '../core/adaptador.js';
import type { Pieza } from '../core/tipos.js';
import type { LayoutResult } from '../types.js';
import { exportarCortecloud } from './cortecloud.js';
import { exportarCsv } from './csv.js';
import { exportarDxf } from './dxf.js';
import { exportarEtiquetas } from './etiquetas.js';
import { exportarPdfBase64 } from './pdf.js';
import { exportarSvg } from './svg.js';

export type EstadoFormato = 'verificado' | 'por revisar';

/** Identificadores soportados, en el mismo orden que `FORMATOS`. */
export const IDS_FORMATOS = ['cortecloud', 'csv', 'svg', 'dxf', 'pdf', 'etiquetas'] as const;
export type IdFormato = (typeof IDS_FORMATOS)[number];

export interface ContextoExportacion {
  piezas: Pieza[];
  resultado?: ResultadoOptimizacion;
  /** Layout del motor; lo usan PDF, etiquetas, SVG y DXF. */
  layout?: LayoutResult;
}

export interface FormatoExport {
  id: IdFormato;
  nombre: string;
  extension: string;
  mime: string;
  estado: EstadoFormato;
  /** Fuentes consultadas para el formato (documentos reales, no inventados). */
  fuentes: string[];
  nota: string;
  /** `true` si el formato necesita el layout optimizado. */
  requiereOptimizacion: boolean;
  /** Cómo se codifica el contenido cuando es binario: hoy sólo `base64` (PDF). */
  codificacion?: 'base64';
  exportar: (ctx: ContextoExportacion) => string;
}

export const FORMATOS: FormatoExport[] = [
  {
    id: 'cortecloud',
    nombre: 'Cortecloud (JSON)',
    extension: 'json',
    mime: 'application/json',
    estado: 'verificado',
    fuentes: ['tests/fixtures/cortecloud/escritorio_D_simple.json (muestra real saneada del repositorio)'],
    nota:
      'Campos tomados del export real: quantity, c, l, function, complement, c1, c2, l1, l2, material. ' +
      'No genera `machining` (barrenos y ranuras): por revisar.',
    requiereOptimizacion: false,
    exportar: ({ piezas }) => exportarCortecloud(piezas)
  },
  {
    id: 'csv',
    nombre: 'CSV genérico',
    extension: 'csv',
    mime: 'text/csv',
    estado: 'verificado',
    fuentes: ['esquema propio del proyecto, documentado en docs/mcp-server.md'],
    nota: 'Cabecera fija, separador coma, comillas dobles cuando el campo lo necesita.',
    requiereOptimizacion: false,
    exportar: ({ piezas }) => exportarCsv(piezas)
  },
  {
    id: 'svg',
    nombre: 'SVG del layout',
    extension: 'svg',
    mime: 'image/svg+xml',
    estado: 'verificado',
    fuentes: ['W3C, SVG 2: https://www.w3.org/TR/SVG2/'],
    nota: 'Una hoja por bloque, apiladas en vertical, medidas en milímetros.',
    requiereOptimizacion: true,
    exportar: ({ resultado }) => exportarSvg(requerirResultado(resultado))
  },
  {
    id: 'dxf',
    nombre: 'DXF (ASCII, R12)',
    extension: 'dxf',
    mime: 'image/vnd.dxf',
    estado: 'por revisar',
    fuentes: [
      'Autodesk, DXF Reference (R12 / AC1009): https://damassets.autodesk.net/content/dam/autodesk/www/developer-network/platform-technologies/autocad-dxf-archive/acad_r12_dxf.pdf',
      'ezdxf, DXF File Structure: https://ezdxf.readthedocs.io/en/stable/dxfinternals/filestructure.html'
    ],
    nota:
      'Estructura mínima R12 (ENTITIES + EOF) con entidades LINE y TEXT. ' +
      'Por revisar: no se ha abierto la salida en un CAD real.',
    requiereOptimizacion: true,
    exportar: ({ resultado }) => exportarDxf(requerirResultado(resultado))
  },
  {
    id: 'pdf',
    nombre: 'PDF (lista de corte + plano)',
    extension: 'pdf',
    mime: 'application/pdf',
    estado: 'verificado',
    fuentes: [
      'ISO 32000-1 (PDF 1.4), estructura de objetos, tabla xref y flujo de contenido: https://opensource.adobe.com/dc-acrobat-sdk-docs/pdfstandards/PDF32000_2008.pdf',
      'Salida leída con pdf-lib en tests/pdf.test.ts'
    ],
    nota:
      'Una página de lista de corte y una por hoja, con los rótulos dentro de cada pieza. ' +
      'Es binario: se entrega en base64 (campo `contenidoBase64`).',
    requiereOptimizacion: true,
    codificacion: 'base64',
    exportar: ({ layout }) => exportarPdfBase64(requerirLayout(layout))
  },
  {
    id: 'etiquetas',
    nombre: 'Etiquetas de taller (CSV)',
    extension: 'csv',
    mime: 'text/csv',
    estado: 'verificado',
    fuentes: ['Esquema propio documentado en docs/mcp-server.md («Etiquetas de taller»)'],
    nota:
      'Una fila por pieza colocada: hoja, código, pieza, medidas terminadas, cantos, veta y si va girada. ' +
      'Sirve para rotular las piezas después del corte.',
    requiereOptimizacion: true,
    exportar: ({ layout, piezas }) => exportarEtiquetas(requerirLayout(layout), piezas)
  }
];

function requerirResultado(resultado: ResultadoOptimizacion | undefined): ResultadoOptimizacion {
  if (!resultado) {
    throw new Error('Este formato necesita el layout: llama antes a optimizar_corte.');
  }
  return resultado;
}

function requerirLayout(layout: LayoutResult | undefined): LayoutResult {
  if (!layout) {
    throw new Error('Este formato necesita el layout: llama antes a optimizar_corte.');
  }
  return layout;
}

export function buscarFormato(id: string): FormatoExport | undefined {
  const buscado = id.trim().toLowerCase();
  return FORMATOS.find(f => f.id === buscado);
}

export function idsFormatos(): IdFormato[] {
  return FORMATOS.map(f => f.id);
}

/** Descripción de los formatos soportados, para el catálogo del servidor MCP. */
export function catalogoFormatos(): {
  id: IdFormato;
  nombre: string;
  extension: string;
  mime: string;
  estado: EstadoFormato;
  fuentes: string[];
  nota: string;
  requiereOptimizacion: boolean;
  codificacion?: 'base64';
}[] {
  return FORMATOS.map(({ id, nombre, extension, mime, estado, fuentes, nota, requiereOptimizacion, codificacion }) => ({
    id,
    nombre,
    extension,
    mime,
    estado,
    fuentes,
    nota,
    requiereOptimizacion,
    ...(codificacion ? { codificacion } : {})
  }));
}
