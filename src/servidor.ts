/** Fábrica del servidor MCP: registra las cuatro herramientas del proyecto. */

import { McpServer } from '@modelcontextprotocol/server';

import { registrarCrearModulo } from './tools/crearModulo.js';
import { registrarExportar } from './tools/exportar.js';
import { registrarListarPiezas } from './tools/listarPiezas.js';
import { registrarOptimizarCorte } from './tools/optimizarCorte.js';
import { registrarValidarDespiece } from './tools/validarDespiece.js';

export const NOMBRE_SERVIDOR = 'cutlist-mcp';
export const VERSION_SERVIDOR = '0.1.0';

export const NOMBRES_HERRAMIENTAS = ['crear_modulo', 'listar_piezas', 'optimizar_corte', 'exportar', 'validar_despiece'] as const;

/** Construye una instancia nueva (una por conexión o por request, según el transporte). */
export function crearServidor(): McpServer {
  const servidor = new McpServer({ name: NOMBRE_SERVIDOR, version: VERSION_SERVIDOR });

  registrarCrearModulo(servidor);
  registrarListarPiezas(servidor);
  registrarOptimizarCorte(servidor);
  registrarExportar(servidor);
  registrarValidarDespiece(servidor);

  return servidor;
}
