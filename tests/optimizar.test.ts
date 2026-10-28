import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { Colocacion, HojaOptimizada } from '../src/core/adaptador';
import { optimizar } from '../src/core/adaptador';
import { normalizarPieza, normalizarTablero, type PiezaEntrada, type TableroEntrada } from '../src/core/tipos';

const KERF = 3;
const EPS = 1e-6;

function piezas(datos: PiezaEntrada[]) {
  return datos.map((d, i) => normalizarPieza(d, i));
}

function tableros(datos: TableroEntrada[]) {
  return datos.map((t, i) => normalizarTablero(t, i));
}

/** Devuelve los problemas encontrados: solapes, piezas fuera del tablero o kerf insuficiente. */
function problemasDeHoja(hoja: HojaOptimizada, kerf: number): string[] {
  const problemas: string[] = [];
  const colocaciones = hoja.colocaciones;

  for (const c of colocaciones) {
    if (c.x < -EPS || c.y < -EPS) problemas.push(`${c.etiqueta} fuera del tablero (origen negativo)`);
    if (c.x + c.largo > hoja.largo + EPS) problemas.push(`${c.etiqueta} se sale por el largo`);
    if (c.y + c.ancho > hoja.ancho + EPS) problemas.push(`${c.etiqueta} se sale por el ancho`);
  }

  for (let i = 0; i < colocaciones.length; i += 1) {
    for (let j = i + 1; j < colocaciones.length; j += 1) {
      const a = colocaciones[i];
      const b = colocaciones[j];
      if (!a || !b) continue;
      const solapanX = Math.min(a.x + a.largo, b.x + b.largo) - Math.max(a.x, b.x) > EPS;
      const solapanY = Math.min(a.y + a.ancho, b.y + b.ancho) - Math.max(a.y, b.y) > EPS;
      if (solapanX && solapanY) {
        problemas.push(`${a.etiqueta} y ${b.etiqueta} se solapan`);
        continue;
      }
      const separacionX = Math.max(a.x, b.x) - Math.min(a.x + a.largo, b.x + b.largo);
      const separacionY = Math.max(a.y, b.y) - Math.min(a.y + a.ancho, b.y + b.ancho);
      if (solapanX && separacionY < kerf - EPS) {
        problemas.push(`${a.etiqueta} y ${b.etiqueta} sin kerf suficiente en Y (${separacionY})`);
      }
      if (solapanY && separacionX < kerf - EPS) {
        problemas.push(`${a.etiqueta} y ${b.etiqueta} sin kerf suficiente en X (${separacionX})`);
      }
    }
  }

  return problemas;
}

const tableroEstandar = tableros([{ id: 't1', nombre: '2500x1830x18', largo: 2500, ancho: 1830, espesor: 18, kerf: KERF }]);

describe('optimizar_corte · guillotina', () => {
  it('coloca las cuatro piezas en una hoja sin solapes y respetando el kerf', () => {
    const resultado = optimizar(piezas([{ id: 'p1', nombre: 'Costado', largo: 1200, ancho: 600, cantidad: 4 }]), tableroEstandar);

    assert.equal(resultado.hojas.length, 1);
    const hoja = resultado.hojas[0];
    assert.ok(hoja);
    assert.equal(hoja.colocaciones.length, 4);
    assert.deepEqual(problemasDeHoja(hoja, KERF), []);
    assert.equal(resultado.resumen.unidadesSobrantes, 0);
    assert.equal(resultado.resumen.areaColocadaM2, 2.88);
    assert.equal(resultado.resumen.aprovechamiento, 0.6295);
  });

  it('cuenta las hojas usadas por tablero', () => {
    const resultado = optimizar(
      piezas([{ id: 'p1', nombre: 'Estante', largo: 1200, ancho: 600, cantidad: 8 }]),
      tableros([{ id: 't1', nombre: 'Grande', largo: 2500, ancho: 1830, kerf: KERF }])
    );
    assert.deepEqual(resultado.consumo, [{ tableroId: 't1', tableroNombre: 'Grande', hojas: 2 }]);
    assert.equal(resultado.resumen.hojasUsadas, 2);
  });

  it('deja como sobrante una pieza con veta que no cabe en ningún tablero (ni girada)', () => {
    const resultado = optimizar(
      piezas([{ id: 'p1', nombre: 'Costado con veta', largo: 3000, ancho: 400, veta: true }]),
      tableros([{ id: 't1', largo: 1000, ancho: 2000, kerf: KERF }])
    );
    assert.equal(resultado.hojas.length, 0);
    assert.equal(resultado.resumen.unidadesSobrantes, 1);
    assert.equal(resultado.sobrantes[0]?.nombre, 'Costado con veta');
  });

  it('rota la pieza equivalente cuando no tiene veta', () => {
    const resultado = optimizar(
      piezas([{ id: 'p1', nombre: 'Costado libre', largo: 1500, ancho: 400, veta: false }]),
      tableros([{ id: 't1', largo: 1000, ancho: 2000, kerf: KERF }])
    );
    const colocacion = resultado.hojas[0]?.colocaciones[0];
    assert.ok(colocacion);
    assert.equal(colocacion.rotada, true);
    assert.equal(colocacion.largo, 400);
    assert.equal(colocacion.ancho, 1500);
    assert.deepEqual(problemasDeHoja(resultado.hojas[0]!, KERF), []);
  });

  it('respeta el stock disponible y reporta lo que no cupo', () => {
    const resultado = optimizar(
      piezas([{ id: 'p1', nombre: 'Tapa', largo: 2000, ancho: 1500, cantidad: 2 }]),
      tableros([{ id: 't1', largo: 2500, ancho: 1830, kerf: KERF, cantidad: 1 }])
    );
    assert.equal(resultado.hojas.length, 1);
    assert.equal(resultado.resumen.unidadesColocadas, 1);
    assert.equal(resultado.resumen.unidadesSobrantes, 1);
    assert.equal(resultado.sobrantes[0]?.cantidad, 1);
  });

  it('no mezcla materiales distintos', () => {
    const resultado = optimizar(
      piezas([{ id: 'p1', nombre: 'Frente', largo: 600, ancho: 400, material: 'Roble', cantidad: 2 }]),
      tableros([{ id: 't1', largo: 2500, ancho: 1830, kerf: KERF, material: 'Moscato' }])
    );
    assert.equal(resultado.hojas.length, 0);
    assert.equal(resultado.resumen.unidadesSobrantes, 2);
  });

  it('rechaza listas vacías', () => {
    assert.throws(() => optimizar([], tableroEstandar), /al menos una pieza/);
    assert.throws(
      () => optimizar(piezas([{ largo: 100, ancho: 100 }]), []),
      /al menos un tablero/
    );
  });
});

describe('optimizar_corte · no-guillotina (MaxRects)', () => {
  it('coloca todas las piezas sin solapes y con kerf suficiente', () => {
    const resultado = optimizar(
      piezas([
        { id: 'p1', nombre: 'Cubierta', largo: 1173.5, ancho: 600, cantidad: 2 },
        { id: 'p2', nombre: 'Costado', largo: 732, ancho: 564, cantidad: 4 },
        { id: 'p3', nombre: 'Pata', largo: 732, ancho: 600, cantidad: 4 }
      ]),
      tableros([{ id: 't1', nombre: '2500x1830x18', largo: 2500, ancho: 1830, kerf: KERF }]),
      { estrategia: 'no-guillotina' }
    );

    assert.equal(resultado.resumen.estrategia, 'no-guillotina');
    assert.equal(resultado.resumen.unidadesColocadas, 10);
    assert.equal(resultado.resumen.unidadesSobrantes, 0);
    for (const hoja of resultado.hojas) {
      assert.deepEqual(problemasDeHoja(hoja, KERF), []);
    }
    const proporcion = resultado.resumen.areaColocadaM2 / resultado.resumen.areaTablerosM2;
    assert.ok(Math.abs(proporcion - resultado.resumen.aprovechamiento) < 1e-3);
  });

  it('no coloca una pieza más grande que el tablero', () => {
    const resultado = optimizar(
      piezas([{ id: 'p1', nombre: 'Enorme', largo: 3000, ancho: 2000, veta: true }]),
      tableros([{ id: 't1', largo: 2500, ancho: 1830, kerf: KERF }]),
      { estrategia: 'no-guillotina' }
    );
    assert.equal(resultado.hojas.length, 0);
    assert.equal(resultado.resumen.unidadesSobrantes, 1);
  });

  it('con permitirRotacion en false ninguna pieza se rota', () => {
    const resultado = optimizar(
      piezas([{ id: 'p1', nombre: 'Costado libre', largo: 1500, ancho: 400 }]),
      tableros([{ id: 't1', largo: 1000, ancho: 2000, kerf: KERF }]),
      { estrategia: 'no-guillotina', permitirRotacion: false }
    );
    assert.equal(resultado.hojas.length, 0);
    assert.equal(resultado.resumen.unidadesSobrantes, 1);
  });

  it('el kerf global sustituye al del tablero', () => {
    const resultado = optimizar(
      piezas([{ id: 'p1', nombre: 'Listón', largo: 250, ancho: 1830, cantidad: 4 }]),
      tableros([{ id: 't1', largo: 1000, ancho: 1830, kerf: 3 }]),
      { estrategia: 'no-guillotina', kerf: 0 }
    );
    assert.equal(resultado.resumen.kerf, 0);
    assert.equal(resultado.resumen.unidadesColocadas, 4);
  });
});

describe('optimizar_corte · veta (grain)', () => {
  it('rota una pieza con veta sobre un tablero sin veta (comportamiento del motor nuevo)', () => {
    const resultado = optimizar(
      piezas([{ id: 'p1', nombre: 'Costado con veta', largo: 1500, ancho: 400, veta: true }]),
      tableros([{ id: 't1', largo: 1000, ancho: 2000, kerf: KERF }])
    );
    const colocacion = resultado.hojas[0]?.colocaciones[0];
    assert.ok(colocacion, 'la pieza debería estar colocada');
    assert.equal(colocacion.rotada, true);
    assert.equal(colocacion.largo, 400);
    assert.equal(colocacion.ancho, 1500);
    assert.deepEqual(problemasDeHoja(resultado.hojas[0]!, KERF), []);
  });

  it('no rota una pieza con veta cuando permitirRotacion es false', () => {
    const resultado = optimizar(
      piezas([{ id: 'p1', nombre: 'Costado con veta', largo: 1500, ancho: 400, veta: true }]),
      tableros([{ id: 't1', largo: 1000, ancho: 2000, kerf: KERF }]),
      { permitirRotacion: false }
    );
    assert.equal(resultado.hojas.length, 0);
    assert.equal(resultado.resumen.unidadesSobrantes, 1);
  });
});

describe('optimizar_corte · invariantes del layout', () => {
  it('las colocaciones conservan las medidas de la pieza (rotada o no)', () => {
    const entrada = piezas([{ id: 'p1', nombre: 'Pieza', largo: 700, ancho: 300, cantidad: 3 }]);
    const resultado = optimizar(entrada, tableroEstandar);
    const colocaciones: Colocacion[] = resultado.hojas.flatMap(h => h.colocaciones);
    assert.equal(colocaciones.length, 3);
    for (const c of colocaciones) {
      const medidas = c.rotada ? [c.ancho, c.largo] : [c.largo, c.ancho];
      assert.deepEqual(medidas, [700, 300]);
      assert.ok(c.etiqueta.startsWith('p1-'));
    }
  });

  it('el área usada por hoja coincide con la suma de sus piezas', () => {
    const resultado = optimizar(
      piezas([{ id: 'p1', nombre: 'Pieza', largo: 700, ancho: 300, cantidad: 3 }]),
      tableroEstandar
    );
    for (const hoja of resultado.hojas) {
      const suma = hoja.colocaciones.reduce((total, c) => total + (c.largo * c.ancho) / 1_000_000, 0);
      assert.ok(Math.abs(suma - hoja.areaUsadaM2) < 1e-3);
      assert.ok(hoja.aprovechamiento > 0 && hoja.aprovechamiento <= 1);
    }
  });
});
