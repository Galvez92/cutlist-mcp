/**
 * Exportación al formato JSON de Cortecloud.
 *
 * Estructura tomada de la muestra real saneada del repositorio
 * (`tests/fixtures/cortecloud/escritorio_D_simple.json`): cada pieza con los campos
 * `quantity`, `c`, `l`, `function`, `complement`, `c1`, `c2`, `l1`, `l2` y `material`.
 *
 * Correspondencia usada: `largo → c`, `ancho → l`, `cantos.largo1 → c1`,
 * `cantos.largo2 → c2`, `cantos.ancho1 → l1`, `cantos.ancho2 → l2`, `nombre → function`,
 * `grupo → complement`. **Por revisar** con una muestra real de Cortecloud.
 *
 * `machining` (barrenos y ranuras) **no** se genera: por revisar.
 */

import type { Pieza } from '../core/tipos.js';

export interface ParteCortecloud {
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
}

export function aPartesCortecloud(piezas: Pieza[]): ParteCortecloud[] {
  return piezas.map(p => ({
    quantity: p.cantidad,
    c: p.largo,
    l: p.ancho,
    function: p.nombre,
    complement: p.grupo ?? '',
    c1: p.cantos.largo1,
    c2: p.cantos.largo2,
    l1: p.cantos.ancho1,
    l2: p.cantos.ancho2,
    material: p.material ?? ''
  }));
}

export function exportarCortecloud(piezas: Pieza[]): string {
  return `${JSON.stringify({ parts: aPartesCortecloud(piezas) }, null, 2)}\n`;
}
