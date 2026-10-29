/**
 * Entrada stdio del servidor MCP: es la que usan los clientes de escritorio
 * (Claude Desktop, Claude Code, VS Code, Cursor) lanzando el proceso.
 *
 * Importante: stdout es el canal del protocolo, así que todo se registra en stderr.
 */

import { serveStdio } from '@modelcontextprotocol/server/stdio';

import { crearServidor } from './servidor.js';

void serveStdio(() => crearServidor(), {
  onerror: error => console.error('cutlist-mcp: error en stdio:', error.message)
});

console.error('cutlist-mcp: servidor MCP escuchando por stdio');
