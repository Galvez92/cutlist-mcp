import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';

import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import { createMcpHandler } from '@modelcontextprotocol/server';

import { crearServidor, NOMBRES_HERRAMIENTAS } from '../src/servidor';

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

const TABLERO = { id: 't1', nombre: '2500x1830x18', largo: 2500, ancho: 1830, espesor: 18, kerf: 3 };
const PARAMETROS_COCINA = {
  tipo: 'cocina',
  ancho: 800,
  alto: 900,
  profundidad: 600,
  numeroPuertas: 2,
  cantoFrente: 'PVC 0.4 x 22 mm'
};

describe('servidor MCP por Streamable HTTP', () => {
  const handler = createMcpHandler(() => crearServidor());
  let cliente: Client;

  before(async () => {
    const transporte = new StreamableHTTPClientTransport(new URL('http://pruebas.local/mcp'), {
      fetch: (url, init) => handler.fetch(new Request(url, init))
    });
    cliente = new Client({ name: 'pruebas-cutlist', version: '0.1.0' }, { versionNegotiation: { mode: 'auto' } });
    await cliente.connect(transporte);
  });

  after(async () => {
    await cliente?.close();
    await handler.close();
  });

  it('expone las cuatro herramientas con su esquema de entrada', async () => {
    const { tools } = await cliente.listTools();
    assert.deepEqual(
      tools.map(t => t.name).sort(),
      [...NOMBRES_HERRAMIENTAS].sort()
    );

    const optimizar = tools.find(t => t.name === 'optimizar_corte');
    assert.ok(optimizar);
    const esquema = optimizar.inputSchema as { properties?: Record<string, unknown>; required?: string[] };
    assert.ok(esquema.properties && 'piezas' in esquema.properties && 'tableros' in esquema.properties);
    assert.deepEqual(esquema.required, ['piezas', 'tableros']);

    const exportar = tools.find(t => t.name === 'exportar');
    const esquemaExportar = exportar?.inputSchema as { properties?: Record<string, { enum?: string[] }> };
    assert.deepEqual(esquemaExportar.properties?.formato?.enum, ['cortecloud', 'csv', 'svg', 'dxf']);
  });

  it('crear_modulo devuelve las piezas y su resumen', async () => {
    const respuesta = await cliente.callTool({ name: 'crear_modulo', arguments: PARAMETROS_COCINA });
    assert.ok(!respuesta.isError, texto(respuesta));

    const datos = estructura(respuesta);
    assert.equal(datos.tipo, 'cocina');
    const piezas = datos.piezas as { id: string; cantidad: number }[];
    assert.equal(piezas.length, 6);
    const resumen = datos.resumen as { unidades: number; areaM2: number };
    assert.equal(resumen.unidades, 8);
    assert.ok(resumen.areaM2 > 0);
    assert.ok(texto(respuesta).includes('cocina-puerta'));
  });

  it('listar_piezas normaliza y resume', async () => {
    const modulo = await cliente.callTool({ name: 'crear_modulo', arguments: PARAMETROS_COCINA });
    const piezas = estructura(modulo).piezas;

    const respuesta = await cliente.callTool({ name: 'listar_piezas', arguments: { piezas } });
    assert.ok(!respuesta.isError, texto(respuesta));
    const resumen = estructura(respuesta).resumen as { lineas: number; unidades: number; porGrupo: { grupo: string }[] };
    assert.equal(resumen.lineas, 6);
    assert.equal(resumen.unidades, 8);
    assert.equal(resumen.porGrupo[0]?.grupo, 'cocina');
    assert.ok(texto(respuesta).includes('m²'));
  });

  it('optimizar_corte coloca el módulo completo en tableros de stock', async () => {
    const modulo = await cliente.callTool({ name: 'crear_modulo', arguments: PARAMETROS_COCINA });
    const piezas = estructura(modulo).piezas;

    const respuesta = await cliente.callTool({
      name: 'optimizar_corte',
      arguments: { piezas, tableros: [TABLERO], estrategia: 'no-guillotina' }
    });
    assert.ok(!respuesta.isError, texto(respuesta));

    const resumen = estructura(respuesta).resumen as { hojasUsadas: number; unidadesColocadas: number; unidadesSobrantes: number };
    assert.equal(resumen.unidadesColocadas, 8);
    assert.equal(resumen.unidadesSobrantes, 0);
    assert.equal(resumen.hojasUsadas, 1);

    const hojas = estructura(respuesta).hojas as { colocaciones: { largo: number; ancho: number }[] }[];
    const colocadas = hojas.flatMap(h => h.colocaciones);
    assert.equal(colocadas.length, 8);
    for (const colocacion of colocadas) {
      assert.ok(colocacion.largo > 0 && colocacion.ancho > 0);
    }
  });

  it('exportar sin formato devuelve el catálogo con estados de verificación', async () => {
    const respuesta = await cliente.callTool({ name: 'exportar', arguments: {} });
    assert.ok(!respuesta.isError, texto(respuesta));
    const formatos = estructura(respuesta).formatos as { id: string; estado: string; fuentes: string[] }[];
    assert.deepEqual(
      formatos.map(f => f.id),
      ['cortecloud', 'csv', 'svg', 'dxf']
    );
    assert.equal(formatos.find(f => f.id === 'dxf')?.estado, 'por revisar');
    assert.ok(formatos.every(f => f.fuentes.length > 0));
    assert.ok(texto(respuesta).includes('por revisar'));
  });

  it('exportar a CSV devuelve la cabecera documentada', async () => {
    const modulo = await cliente.callTool({ name: 'crear_modulo', arguments: PARAMETROS_COCINA });
    const piezas = estructura(modulo).piezas;

    const respuesta = await cliente.callTool({ name: 'exportar', arguments: { formato: 'csv', piezas } });
    assert.ok(!respuesta.isError, texto(respuesta));
    assert.equal(estructura(respuesta).estado, 'verificado');
    assert.ok(texto(respuesta).includes('id,nombre,largo_mm,ancho_mm,cantidad,veta'));
  });

  it('exportar un formato con layout sin tableros da un error legible', async () => {
    const modulo = await cliente.callTool({ name: 'crear_modulo', arguments: PARAMETROS_COCINA });
    const piezas = estructura(modulo).piezas;

    const respuesta = await cliente.callTool({ name: 'exportar', arguments: { formato: 'svg', piezas } });
    assert.equal(respuesta.isError, true);
    assert.ok(texto(respuesta).includes('tableros'));
  });

  it('rechaza medidas imposibles y datos inválidos antes de ejecutar', async () => {
    const imposible = await cliente.callTool({
      name: 'crear_modulo',
      arguments: { ...PARAMETROS_COCINA, ancho: 30 }
    });
    assert.equal(imposible.isError, true);
    assert.ok(texto(imposible).includes('El ancho debe ser mayor'));

    const negativo = await cliente.callTool({
      name: 'optimizar_corte',
      arguments: { piezas: [{ nombre: 'Mala', largo: -5, ancho: 100 }], tableros: [TABLERO] }
    });
    assert.equal(negativo.isError, true);

    const formatoDesconocido = await cliente.callTool({
      name: 'exportar',
      arguments: { formato: 'promob', piezas: [] }
    });
    assert.equal(formatoDesconocido.isError, true);
  });

  it('una herramienta inexistente falla a nivel de protocolo', async () => {
    await assert.rejects(() => cliente.callTool({ name: 'no_existe', arguments: {} }));
  });
});
