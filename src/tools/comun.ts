/** Utilidades compartidas por las herramientas MCP. */

import type { ResultadoOptimizacion } from '../core/adaptador';
import { type Pieza, type PiezaEntrada, type Tablero, type TableroEntrada, normalizarPieza, normalizarTablero, redondear } from '../core/tipos';

export type ResultadoHerramienta = {
  content: { type: 'text'; text: string }[];
  structuredContent?: Record<string, unknown>;
  isError?: boolean;
};

/** Ejecuta el cuerpo de una herramienta y convierte los errores en un resultado legible por el modelo. */
export async function ejecutar(
  accion: () => Promise<ResultadoHerramienta> | ResultadoHerramienta
): Promise<ResultadoHerramienta> {
  try {
    return await accion();
  } catch (error) {
    const mensaje = error instanceof Error ? error.message : String(error);
    return { content: [{ type: 'text', text: `Error: ${mensaje}` }], isError: true };
  }
}

export function normalizarPiezas(entradas: PiezaEntrada[]): Pieza[] {
  const piezas = entradas.map((entrada, i) => normalizarPieza(entrada, i));
  const repetidas = piezas.map(p => p.id).filter((id, i, ids) => ids.indexOf(id) !== i);
  if (repetidas.length > 0) {
    throw new Error(`Identificadores de pieza repetidos: ${[...new Set(repetidas)].join(', ')}`);
  }
  return piezas;
}

export function normalizarTableros(entradas: TableroEntrada[], piezas: Pieza[]): Tablero[] {
  const tableros = entradas.map((entrada, i) => normalizarTablero(entrada, i, piezas));
  const repetidos = tableros.map(t => t.id).filter((id, i, ids) => ids.indexOf(id) !== i);
  if (repetidos.length > 0) {
    throw new Error(`Identificadores de tablero repetidos: ${[...new Set(repetidos)].join(', ')}`);
  }
  return tableros;
}

/** Texto del resultado de una optimización, pensado para que lo lea un agente. */
export function textoOptimizacion(resultado: ResultadoOptimizacion): string {
  const { resumen } = resultado;
  const lineas = [
    `Estrategia ${resumen.estrategia} · kerf ${redondear(resumen.kerf, 2)} mm`,
    `Hojas usadas: ${resumen.hojasUsadas} · aprovechamiento ${(resumen.aprovechamiento * 100).toFixed(1)}% ` +
      `(${resumen.areaColocadaM2} de ${resumen.areaTablerosM2} m²)`,
    `Piezas colocadas: ${resumen.unidadesColocadas} · sin colocar: ${resumen.unidadesSobrantes}`
  ];

  for (const hoja of resultado.hojas) {
    lineas.push(
      `- Hoja ${hoja.indice} (${hoja.tableroNombre}) ${hoja.largo}x${hoja.ancho} mm: ` +
        `${hoja.colocaciones.length} piezas, ${(hoja.aprovechamiento * 100).toFixed(1)}%`
    );
  }

  for (const consumo of resultado.consumo) {
    lineas.push(`- Tablero ${consumo.tableroNombre}: ${consumo.hojas} hoja(s)`);
  }

  if (resultado.sobrantes.length > 0) {
    lineas.push(
      `Sin colocar: ${resultado.sobrantes
        .map(p => `${p.nombre} ${p.largo}x${p.ancho} x${p.cantidad}`)
        .join('; ')}`
    );
  }

  return lineas.join('\n');
}
