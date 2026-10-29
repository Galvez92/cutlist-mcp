import type { McpServer } from '@modelcontextprotocol/server';

import { optimizar } from '../core/adaptador.js';
import { optimizarCorteSchema } from '../esquemas.js';
import { ejecutar, normalizarPiezas, normalizarTableros, textoOptimizacion } from './comun.js';

export function registrarOptimizarCorte(servidor: McpServer): void {
  servidor.registerTool(
    'optimizar_corte',
    {
      title: 'Optimizar corte (nesting)',
      description:
        'Reparte las piezas sobre los tableros en stock y devuelve el layout por hoja (coordenadas en mm), ' +
        'el aprovechamiento y las piezas que no cupieron. Estrategias: `guillotina` (cortes que atraviesan la ' +
        'pieza, por defecto) y `no-guillotina` (MaxRects). Con `auto` (omitiendo `estrategia`) prueba ambas y ' +
        'elige el mejor resultado. Las piezas con veta se rotan sólo sobre tableros sin veta.',
      inputSchema: optimizarCorteSchema
    },
    async ({ piezas: entradasPiezas, tableros: entradasTableros, estrategia, kerf, permitirRotacion }) =>
      ejecutar(() => {
        const piezas = normalizarPiezas(entradasPiezas);
        const tableros = normalizarTableros(entradasTableros, piezas);
        const opciones = {
          ...(estrategia ? { estrategia } : {}),
          ...(kerf === undefined ? {} : { kerf }),
          ...(permitirRotacion === undefined ? {} : { permitirRotacion })
        };
        const resultado = optimizar(piezas, tableros, opciones);

        return {
          content: [{ type: 'text', text: textoOptimizacion(resultado) }],
          structuredContent: { ...resultado }
        };
      })
  );
}
