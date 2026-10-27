import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

import { optimizar } from '../src/core/optimizar';
import { normalizarPieza, normalizarTablero, type Pieza } from '../src/core/tipos';
import { buscarFormato, catalogoFormatos, IDS_FORMATOS, idsFormatos } from '../src/export';
import { exportarCortecloud } from '../src/export/cortecloud';
import { CABECERA_CSV, exportarCsv } from '../src/export/csv';
import { exportarDxf } from '../src/export/dxf';
import { exportarSvg } from '../src/export/svg';

const RUTA_FIXTURE = new URL('./fixtures/cortecloud/escritorio_D_simple.json', import.meta.url);

interface ParteReal {
  quantity: number;
  c: number;
  l: number;
  function: string;
  complement: string;
  c1: string | null;
  c2: string | null;
  l1: string | null;
  l2: string | null;
  material: string;
  machining?: unknown;
}

/** Lector CSV mínimo, sólo para comprobar el viaje de ida y vuelta. */
function parsearCsv(texto: string): string[][] {
  const filas: string[][] = [];
  let fila: string[] = [];
  let campo = '';
  let entreComillas = false;

  for (let i = 0; i < texto.length; i += 1) {
    const caracter = texto.charAt(i);
    if (entreComillas) {
      if (caracter === '"') {
        if (texto.charAt(i + 1) === '"') {
          campo += '"';
          i += 1;
        } else {
          entreComillas = false;
        }
      } else {
        campo += caracter;
      }
    } else if (caracter === '"') {
      entreComillas = true;
    } else if (caracter === ',') {
      fila.push(campo);
      campo = '';
    } else if (caracter === '\n') {
      fila.push(campo);
      filas.push(fila);
      fila = [];
      campo = '';
    } else {
      campo += caracter;
    }
  }

  return filas.filter(f => f.length > 1 || f[0] !== '');
}

function piezaDePrueba(parcial: Partial<Pieza> = {}): Pieza {
  return {
    ...normalizarPieza({ id: 'p1', nombre: 'Costado', largo: 1200, ancho: 600, cantidad: 2 }, 0),
    ...parcial
  };
}

function resultadoDePrueba() {
  return optimizar(
    [piezaDePrueba()],
    [normalizarTablero({ id: 't1', nombre: '2500x1830x18', largo: 2500, ancho: 1830, kerf: 3 }, 0)],
    { estrategia: 'no-guillotina' }
  );
}

describe('catálogo de formatos', () => {
  it('los identificadores declarados coinciden con los formatos disponibles', () => {
    assert.deepEqual(idsFormatos(), [...IDS_FORMATOS]);
  });

  it('cada formato declara estado y fuentes reales', () => {
    for (const formato of catalogoFormatos()) {
      assert.ok(['verificado', 'por revisar'].includes(formato.estado));
      assert.ok(formato.fuentes.length > 0, `${formato.id} debe citar sus fuentes`);
      assert.ok(formato.nota.length > 0);
    }
  });

  it('dxf queda marcado «por revisar» con las fuentes consultadas', () => {
    const dxf = catalogoFormatos().find(f => f.id === 'dxf');
    assert.ok(dxf);
    assert.equal(dxf.estado, 'por revisar');
    assert.ok(dxf.fuentes.some(f => f.includes('autodesk')));
    assert.ok(dxf.fuentes.some(f => f.includes('ezdxf')));
  });

  it('svg y dxf exigen layout; csv y cortecloud no', () => {
    assert.equal(buscarFormato('svg')?.requiereOptimizacion, true);
    assert.equal(buscarFormato('dxf')?.requiereOptimizacion, true);
    assert.equal(buscarFormato('csv')?.requiereOptimizacion, false);
    assert.equal(buscarFormato('Cortecloud')?.id, 'cortecloud');
  });

  it('un formato no soportado no existe en el catálogo', () => {
    assert.equal(buscarFormato('promob'), undefined);
  });

  it('exportar sin layout falla con un mensaje claro', () => {
    const svg = buscarFormato('svg');
    assert.throws(() => svg?.exportar({ piezas: [piezaDePrueba()] }), /necesita el layout/);
  });
});

describe('exportar CSV', () => {
  it('escribe la cabecera documentada y una fila por pieza', () => {
    const texto = exportarCsv([piezaDePrueba(), piezaDePrueba({ id: 'p2', nombre: 'Base', cantidad: 1 })]);
    const filas = parsearCsv(texto);
    assert.deepEqual(filas[0], [...CABECERA_CSV]);
    assert.equal(filas.length, 3);
    assert.equal(filas[1]?.[0], 'p1');
    assert.equal(filas[1]?.[2], '1200');
    assert.equal(filas[1]?.[4], '2');
    assert.equal(filas[1]?.[5], 'no');
  });

  it('escapa comas y comillas en los campos de texto', () => {
    const texto = exportarCsv([
      piezaDePrueba({ nombre: 'Costado "A", 600', cantos: { largo1: 'PVC 0.4 x 22 mm', largo2: null, ancho1: null, ancho2: null } })
    ]);
    assert.ok(texto.includes('"Costado ""A"", 600"'));
    const filas = parsearCsv(texto);
    assert.equal(filas[1]?.[1], 'Costado "A", 600');
    assert.equal(filas[1]?.[6], 'PVC 0.4 x 22 mm');
    assert.equal(filas[1]?.length, CABECERA_CSV.length);
  });

  it('viaje de ida y vuelta: los valores leídos son los escritos', () => {
    const original = piezaDePrueba({
      nombre: 'Cubierta izquierda',
      largo: 1173.5,
      ancho: 600,
      cantidad: 1,
      material: 'Roble Americano 2 C 18 mm 719L ARAUCO (2500x1830)',
      grupo: 'D03 Escritorio Atelier Simple 1700x600x750',
      cantos: { largo1: 'PVC 719L 0.4 x 22 mm', largo2: null, ancho1: null, ancho2: null }
    });
    const fila = parsearCsv(exportarCsv([original]))[1];
    assert.ok(fila);
    assert.deepEqual(fila, [
      'p1',
      'Cubierta izquierda',
      '1173.5',
      '600',
      '1',
      'no',
      'PVC 719L 0.4 x 22 mm',
      '',
      '',
      '',
      'Roble Americano 2 C 18 mm 719L ARAUCO (2500x1830)',
      'D03 Escritorio Atelier Simple 1700x600x750'
    ]);
  });
});

describe('exportar Cortecloud', () => {
  const fixture = JSON.parse(readFileSync(RUTA_FIXTURE, 'utf8')) as { parts: ParteReal[] };

  it('la muestra real trae los diez campos que exportamos', () => {
    const claves = new Set(fixture.parts.flatMap(p => Object.keys(p)));
    for (const clave of ['quantity', 'c', 'l', 'function', 'complement', 'c1', 'c2', 'l1', 'l2', 'material']) {
      assert.ok(claves.has(clave), `la muestra real no trae ${clave}`);
    }
  });

  it('viaje de ida y vuelta con la primera pieza de la muestra real', () => {
    const parte = fixture.parts[0];
    assert.ok(parte);
    const pieza = normalizarPieza(
      {
        id: 'real-01',
        nombre: parte.function,
        largo: parte.c,
        ancho: parte.l,
        cantidad: parte.quantity,
        cantos: { largo1: parte.c1, largo2: parte.c2, ancho1: parte.l1, ancho2: parte.l2 },
        material: parte.material,
        grupo: parte.complement
      },
      0
    );

    const salida = JSON.parse(exportarCortecloud([pieza])) as { parts: ParteReal[] };
    const exportada = salida.parts[0];
    assert.ok(exportada);
    assert.deepEqual(Object.keys(exportada).sort(), [
      'c',
      'c1',
      'c2',
      'complement',
      'function',
      'l',
      'l1',
      'l2',
      'material',
      'quantity'
    ]);
    assert.equal(exportada.quantity, parte.quantity);
    assert.equal(exportada.c, parte.c);
    assert.equal(exportada.l, parte.l);
    assert.equal(exportada.function, parte.function);
    assert.equal(exportada.complement, parte.complement);
    assert.equal(exportada.c1, parte.c1);
    assert.equal(exportada.c2, parte.c2);
    assert.equal(exportada.l1, parte.l1);
    assert.equal(exportada.l2, parte.l2);
    assert.equal(exportada.material, parte.material);
  });

  it('no inventa el mecanizado: no emite `machining`', () => {
    const salida = JSON.parse(exportarCortecloud([piezaDePrueba()])) as { parts: Record<string, unknown>[] };
    assert.ok(salida.parts[0]);
    assert.ok(!('machining' in salida.parts[0]));
  });

  it('el JSON es legible y siempre trae la clave parts', () => {
    const texto = exportarCortecloud([piezaDePrueba()]);
    assert.ok(texto.trim().startsWith('{'));
    assert.ok(JSON.parse(texto).parts.length === 1);
  });
});

describe('exportar SVG', () => {
  it('dibuja un rectángulo por hoja y por pieza, con etiquetas', () => {
    const resultado = resultadoDePrueba();
    const svg = exportarSvg(resultado);
    const colocaciones = resultado.hojas.flatMap(h => h.colocaciones);
    assert.ok(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"'));
    assert.ok(svg.trimEnd().endsWith('</svg>'));
    assert.equal(svg.match(/<rect /g)?.length, resultado.hojas.length + colocaciones.length);
    assert.equal(svg.match(/<g id="hoja-/g)?.length, resultado.hojas.length);
    for (const colocacion of colocaciones) {
      assert.ok(svg.includes(colocacion.etiqueta), `falta la etiqueta ${colocacion.etiqueta}`);
    }
  });

  it('escapa el texto que viene de los datos', () => {
    const pieza = piezaDePrueba({ id: 'p<1>&', nombre: 'Costado <exterior>' });
    const resultado = optimizar(
      [pieza],
      [normalizarTablero({ id: 't1', nombre: 'Tablero "A" & B', largo: 2500, ancho: 1830, kerf: 3 }, 0)]
    );
    const svg = exportarSvg(resultado);
    assert.ok(!svg.includes('<exterior>'));
    assert.ok(svg.includes('Tablero &quot;A&quot; &amp; B'));
    assert.ok(svg.includes('p&lt;1&gt;&amp;-1'));
  });
});

describe('exportar DXF', () => {
  function pares(contenido: string): [string, string][] {
    const lineas = contenido.split('\n').filter(l => l !== '');
    assert.equal(lineas.length % 2, 0, 'el DXF debe tener pares código/valor');
    const resultado: [string, string][] = [];
    for (let i = 0; i < lineas.length; i += 2) {
      resultado.push([lineas[i] ?? '', lineas[i + 1] ?? '']);
    }
    return resultado;
  }

  it('arma la estructura mínima R12 y una LINE por lado', () => {
    const resultado = resultadoDePrueba();
    const contenido = exportarDxf(resultado);
    const lista = pares(contenido);

    assert.deepEqual(lista[0], ['0', 'SECTION']);
    assert.deepEqual(lista[1], ['2', 'ENTITIES']);
    assert.deepEqual(lista.at(-2), ['0', 'ENDSEC']);
    assert.deepEqual(lista.at(-1), ['0', 'EOF']);

    const rectangulos = resultado.hojas.length + resultado.hojas.flatMap(h => h.colocaciones).length;
    assert.equal(lista.filter(p => p[0] === '0' && p[1] === 'LINE').length, rectangulos * 4);
    assert.equal(lista.filter(p => p[0] === '0' && p[1] === 'TEXT').length > 0, true);
  });

  it('cada LINE trae los grupos de sus dos extremos', () => {
    const lista = pares(exportarDxf(resultadoDePrueba()));
    const inicio = lista.findIndex(p => p[0] === '0' && p[1] === 'LINE');
    assert.ok(inicio >= 0);
    const entidad = lista.slice(inicio, inicio + 17).map(p => p[0]);
    assert.deepEqual(entidad, ['0', '8', '10', '20', '30', '11', '21', '31', '0', '8', '10', '20', '30', '11', '21', '31', '0']);
  });

  it('no usa notación exponencial y cierra con salto de línea', () => {
    const contenido = exportarDxf(resultadoDePrueba());
    assert.ok(contenido.endsWith('\n'));
    assert.ok(!/e[+-]?\d/i.test(contenido.replace(/TEXT|ENDSEC|SECTION|ENTITIES|LINE/g, '')));
  });
});
