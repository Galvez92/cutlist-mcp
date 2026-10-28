/**
 * Catálogo de formatos de exportación soportados por el servidor MCP.
 *
 * Cada formato declara su estado de verificación. Los que no se han podido
 * contrastar contra una herramienta o documento real van marcados `por revisar`
 * junto con la fuente consultada (regla 5 de AGENTS.md).
 */

import type { ResultadoOptimizacion } from '../core/adaptador';
import type { Pieza } from '../core/tipos';
import { exportarCortecloud } from './cortecloud';
import { exportarCsv } from './csv';
import { exportarDxf } from './dxf';
import { exportarSvg } from './svg';

export type EstadoFormato = 'verificado' | 'por revisar';

/** Identificadores soportados, en el mismo orden que `FORMATOS`. */
export const IDS_FORMATOS = ['cortecloud', 'csv', 'svg', 'dxf'] as const;
export type IdFormato = (typeof IDS_FORMATOS)[number];

export interface ContextoExportacion {
  piezas: Pieza[];
  resultado?: ResultadoOptimizacion;
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
  }
];

function requerirResultado(resultado: ResultadoOptimizacion | undefined): ResultadoOptimizacion {
  if (!resultado) {
    throw new Error('Este formato necesita el layout: llama antes a optimizar_corte.');
  }
  return resultado;
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
}[] {
  return FORMATOS.map(({ id, nombre, extension, mime, estado, fuentes, nota, requiereOptimizacion }) => ({
    id,
    nombre,
    extension,
    mime,
    estado,
    fuentes,
    nota,
    requiereOptimizacion
  }));
}
