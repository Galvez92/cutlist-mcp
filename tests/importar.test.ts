import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, before, describe, it } from 'node:test';

import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import { createMcpHandler } from '@modelcontextprotocol/server';

import { crearServidor } from '../src/servidor.js';

type Respuesta = Awaited<ReturnType<Client['callTool']>>;

function estructura(respuesta: Respuesta): Record<string, unknown> {
  assert.ok(respuesta.structuredContent, 'el resultado trae structuredContent');
  return respuesta.structuredContent as Record<string, unknown>;
}

function texto(respuesta: Respuesta): string {
  return respuesta.content
    .filter((bloque): bloque is { type: 'text'; text: string } => bloque.type === 'text')
    .map(bloque => bloque.text)
    .join('\n');
}

const CONTENIDO = readFileSync(new URL('./fixtures/cortecloud/escritorio_D_simple.json', import.meta.url), 'utf8');
const BRUTO = JSON.parse(CONTENIDO) as { parts: Array<Record<string, unknown>> };
const PRIMERA = BRUTO.parts[0];
const UNIDADES = BRUTO.parts.reduce((suma, parte) => suma + Number(parte.quantity), 0);

const TABLERO = { id: 't1', nombre: '2500x1830x18', largo: 2500, ancho: 1830, espesor: 18, kerf: 3, cantidad: 3 };

describe('herramienta importar (despiece de otra app)', () => {
  const handler = createMcpHandler(() => crearServidor());
  let cliente: Client;

  before(async () => {
    const transporte = new StreamableHTTPClientTransport(new URL('http://pruebas.local/mcp'), {
      fetch: (url, init) => handler.fetch(new Request(url, init))
    });
    cliente = new Client({ name: 'pruebas-cutover', version: '0.1.0' }, { versionNegotiation: { mode: 'auto' } });
    await cliente.connect(transporte);
  });

  after(async () => {
    await cliente?.close();
    await handler.close();
  });

  it('lee el JSON real de Cortecloud y mapea cantos y material', async () => {
    const respuesta = await cliente.callTool({
      name: 'importar',
      arguments: { formato: 'cortecloud', contenido: CONTENIDO }
    });

    const datos = estructura(respuesta);
    const piezas = datos.piezas as Array<Record<string, unknown>>;
    assert.equal(piezas.length, BRUTO.parts.length);
    assert.equal((datos.resumen as { unidades: number }).unidades, UNIDADES);
    assert.equal(datos.formato, 'cortecloud');

    // Cantos: c1 → largo1, l1 → ancho1; los lados sin canto quedan en null.
    const primera = piezas[0];
    const cantos = primera.cantos as Record<string, string | null>;
    assert.equal(primera.largo, PRIMERA.c);
    assert.equal(primera.ancho, PRIMERA.l);
    assert.equal(primera.nombre, PRIMERA.function);
    assert.equal(primera.material, PRIMERA.material);
    assert.equal(cantos.largo1, PRIMERA.c1);
    assert.equal(cantos.ancho1, PRIMERA.l1);
    assert.equal(cantos.largo2, null);
    assert.equal(cantos.ancho2, null);

    // Los avisos «por revisar» del formato viajan con el resultado.
    assert.ok((datos.avisos as unknown[]).length > 0);
    assert.match(texto(respuesta), /Las piezas quedan listas para `optimizar_corte`/);
  });

  it('las piezas importadas se optimizan sin retocarlas', async () => {
    const importado = estructura(
      await cliente.callTool({ name: 'importar', arguments: { formato: 'cortecloud', contenido: CONTENIDO } })
    );

    const optimizado = await cliente.callTool({
      name: 'optimizar_corte',
      arguments: { piezas: importado.piezas, tableros: [TABLERO] }
    });

    const resumen = estructura(optimizado).resumen as { unidadesColocadas: number; unidadesSobrantes: number };
    assert.equal(resumen.unidadesColocadas, UNIDADES);
    assert.equal(resumen.unidadesSobrantes, 0);
  });

  it('un formato que no existe devuelve un error legible', async () => {
    // El esquema solo acepta formatos con importador: el cliente recibe un resultado con `isError`.
    const respuesta = await cliente.callTool({
      name: 'importar',
      arguments: { formato: 'no-existe', contenido: CONTENIDO }
    });
    assert.equal(respuesta.isError, true);
    assert.match(texto(respuesta), /formato/i);
  });
});
