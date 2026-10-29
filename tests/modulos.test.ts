import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { resumirPiezas } from '../src/core/listar.js';
import { generarModulo } from '../src/core/modulos.js';
import type { Pieza } from '../src/core/tipos.js';

const CANTO = 'PVC 719L Roble Americano 0.4 x 22 mm REHAU';

function buscar(piezas: Pieza[], id: string): Pieza {
  const encontrada = piezas.find(p => p.id === id);
  assert.ok(encontrada, `no se generó la pieza ${id}`);
  return encontrada;
}

describe('crear_modulo · cajonera', () => {
  const piezas = generarModulo({
    tipo: 'cajonera',
    ancho: 600,
    alto: 750,
    profundidad: 550,
    numeroCajones: 3,
    cantoFrente: CANTO,
    nombre: 'cajonera'
  });

  it('genera laterales, base, tapa, trasera y frentes de cajón', () => {
    assert.deepEqual(
      piezas.map(p => p.id),
      ['cajonera-lat', 'cajonera-base', 'cajonera-tapa', 'cajonera-tras', 'cajonera-frente']
    );
  });

  it('los laterales van con veta vertical y canto frontal', () => {
    const lateral = buscar(piezas, 'cajonera-lat');
    assert.equal(lateral.largo, 750);
    assert.equal(lateral.ancho, 550);
    assert.equal(lateral.cantidad, 2);
    assert.equal(lateral.veta, true);
    assert.equal(lateral.cantos.largo1, CANTO);
    assert.equal(lateral.cantos.ancho1, null);
  });

  it('la base y la tapa descuentan los dos laterales', () => {
    const base = buscar(piezas, 'cajonera-base');
    assert.equal(base.largo, 600 - 2 * 18);
    assert.equal(base.ancho, 550);
    assert.equal(base.veta, false);
    assert.equal(buscar(piezas, 'cajonera-tapa').largo, 564);
  });

  it('la trasera cubre el módulo completo y va sin canto', () => {
    const trasera = buscar(piezas, 'cajonera-tras');
    assert.equal(trasera.largo, 600);
    assert.equal(trasera.ancho, 750);
    assert.deepEqual(trasera.cantos, { largo1: null, largo2: null, ancho1: null, ancho2: null });
  });

  it('reparte la altura interior entre los cajones, con holgura y canto en las cuatro orillas', () => {
    const frente = buscar(piezas, 'cajonera-frente');
    assert.equal(frente.cantidad, 3);
    assert.equal(frente.ancho, 600);
    assert.equal(frente.largo, (750 - 2 * 18) / 3 - 3);
    assert.equal(frente.veta, true);
    assert.deepEqual(frente.cantos, { largo1: CANTO, largo2: CANTO, ancho1: CANTO, ancho2: CANTO });
  });

  it('todas las piezas quedan dentro del grupo del módulo', () => {
    assert.ok(piezas.every(p => p.grupo === 'cajonera'));
    const resumen = resumirPiezas(piezas);
    assert.equal(resumen.lineas, 5);
    assert.equal(resumen.unidades, 8);
    assert.equal(resumen.areaM2, 2.3184);
    assert.equal(resumen.unidadesConVeta, 5);
  });
});

describe('crear_modulo · clóset, librero y cocina', () => {
  it('el clóset lleva un estante por defecto y los que se pidan', () => {
    const base = { tipo: 'closet' as const, ancho: 1200, alto: 2000, profundidad: 600 };
    assert.equal(buscar(generarModulo(base), 'closet-estante').cantidad, 1);
    assert.equal(buscar(generarModulo({ ...base, numeroEstantes: 5 }), 'closet-estante').cantidad, 5);
    assert.equal(buscar(generarModulo(base), 'closet-estante').largo, 1200 - 36);
  });

  it('el librero lleva cuatro estantes por defecto', () => {
    const piezas = generarModulo({ tipo: 'librero', ancho: 900, alto: 1800, profundidad: 300 });
    assert.equal(buscar(piezas, 'librero-estante').cantidad, 4);
    assert.equal(buscar(piezas, 'librero-lat').largo, 1800);
  });

  it('en la cocina el alto incluye el zócalo y las puertas reparten el ancho', () => {
    const piezas = generarModulo({ tipo: 'cocina', ancho: 800, alto: 900, profundidad: 600, numeroPuertas: 2 });
    assert.equal(buscar(piezas, 'cocina-lat').largo, 800);
    const zocalo = buscar(piezas, 'cocina-zocalo');
    assert.equal(zocalo.largo, 800);
    assert.equal(zocalo.ancho, 100);
    const puerta = buscar(piezas, 'cocina-puerta');
    assert.equal(puerta.cantidad, 2);
    assert.equal(puerta.ancho, 398.5);
    assert.equal(puerta.largo, 797);
  });

  it('sin cantoFrente ninguna orilla queda marcada', () => {
    const piezas = generarModulo({ tipo: 'librero', ancho: 900, alto: 1800, profundidad: 300 });
    assert.ok(piezas.every(p => Object.values(p.cantos).every(c => c === null)));
    assert.ok(piezas.every(p => p.material === undefined));
  });

  it('propaga el material pedido a todas las piezas', () => {
    const piezas = generarModulo({
      tipo: 'librero',
      ancho: 900,
      alto: 1800,
      profundidad: 300,
      material: 'Roble Americano 2 C 18 mm 719L ARAUCO (2500x1830)'
    });
    assert.ok(piezas.every(p => p.material === 'Roble Americano 2 C 18 mm 719L ARAUCO (2500x1830)'));
  });
});

describe('crear_modulo · medidas imposibles', () => {
  it('rechaza un ancho menor que dos espesores', () => {
    assert.throws(
      () => generarModulo({ tipo: 'librero', ancho: 30, alto: 1800, profundidad: 300 }),
      /El ancho debe ser mayor que dos veces el espesor/
    );
  });

  it('rechaza más cajones de los que caben en el alto', () => {
    assert.throws(
      () => generarModulo({ tipo: 'cajonera', ancho: 600, alto: 50, profundidad: 550, numeroCajones: 10 }),
      /no admite ese número de cajones/
    );
  });

  it('rechaza más puertas de las que caben en el ancho', () => {
    assert.throws(
      () => generarModulo({ tipo: 'cocina', ancho: 200, alto: 900, profundidad: 600, numeroPuertas: 100 }),
      /no admite ese número de puertas/
    );
  });
});
