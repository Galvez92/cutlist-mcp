import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';

import { NOMBRES_HERRAMIENTAS } from '../src/servidor.js';

describe('servidor MCP por stdio', () => {
  it('se levanta como proceso hijo y responde una llamada', async () => {
    const transporte = new StdioClientTransport({
      command: 'npx',
      args: ['tsx', 'src/stdio.ts'],
      stderr: 'pipe'
    });
    const cliente = new Client({ name: 'pruebas-cutlist-stdio', version: '0.1.0' });

    try {
      await cliente.connect(transporte);

      const { tools } = await cliente.listTools();
      assert.deepEqual(
        tools.map(t => t.name).sort(),
        [...NOMBRES_HERRAMIENTAS].sort()
      );

      const respuesta = await cliente.callTool({
        name: 'crear_modulo',
        arguments: { tipo: 'librero', ancho: 900, alto: 1800, profundidad: 300 }
      });
      assert.ok(!respuesta.isError);
      const structured = respuesta.structuredContent as { piezas: unknown[] } | undefined;
      assert.equal(structured?.piezas.length, 5);
    } finally {
      await cliente.close();
    }
  });
});
