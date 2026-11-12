import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { ANFITRIONES_LOCALES, anfitrionesPermitidos, nombresDeLista, origenesPermitidos } from '../src/red.js';

describe('listas de anfitriones y orígenes del servidor HTTP', () => {
  it('parte una lista separada por comas y descarta vacíos', () => {
    assert.deepEqual(nombresDeLista('cortecloud.example.com, otra.example.com ,, '), [
      'cortecloud.example.com',
      'otra.example.com'
    ]);
    assert.deepEqual(nombresDeLista(undefined), []);
    assert.deepEqual(nombresDeLista(''), []);
  });

  it('sin variables de entorno solo se aceptan los nombres locales', () => {
    assert.deepEqual(anfitrionesPermitidos({}), ANFITRIONES_LOCALES);
    assert.deepEqual(origenesPermitidos({}), ANFITRIONES_LOCALES);
  });

  it('MCP_ANFITRIONES y MCP_ORIGENES añaden los nombres de la otra app', () => {
    assert.deepEqual(anfitrionesPermitidos({ MCP_ANFITRIONES: 'cutlist.example.com' }), [
      ...ANFITRIONES_LOCALES,
      'cutlist.example.com'
    ]);
    assert.deepEqual(origenesPermitidos({ MCP_ORIGENES: 'app.example.com,cortecloud.example.com' }), [
      ...ANFITRIONES_LOCALES,
      'app.example.com',
      'cortecloud.example.com'
    ]);
  });

  it('los nombres locales siguen ahí cuando se añaden otros', () => {
    const lista = anfitrionesPermitidos({ MCP_ANFITRIONES: 'cutlist.example.com' });
    for (const local of ANFITRIONES_LOCALES) assert.ok(lista.includes(local), local);
  });
});
