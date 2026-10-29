import type { McpServer } from '@modelcontextprotocol/server';

import { formatearPiezas, resumirPiezas } from '../core/listar.js';
import { listaPiezasSchema } from '../esquemas.js';
import { ejecutar, normalizarPiezas } from './comun.js';

export function registrarListarPiezas(servidor: McpServer): void {
  servidor.registerTool(
    'listar_piezas',
    {
      title: 'Listar y revisar piezas',
      description:
        'Normaliza una lista de piezas (nombres, identificadores y cantos por defecto), valida que no haya ' +
        'identificadores repetidos y devuelve el detalle con unidades y metros cuadrados por grupo y material. ' +
        'Úsala para revisar lo que devolvió crear_modulo antes de optimizar.',
      inputSchema: listaPiezasSchema
    },
    async ({ piezas: entradas }) =>
      ejecutar(() => {
        const piezas = normalizarPiezas(entradas);
        const resumen = resumirPiezas(piezas);
        const grupos = resumen.porGrupo
          .map(g => `- ${g.grupo}: ${g.lineas} líneas, ${g.unidades} unidades, ${g.areaM2} m²`)
          .join('\n');
        const texto = [
          `${resumen.lineas} líneas · ${resumen.unidades} unidades · ${resumen.areaM2} m²`,
          `Veta obligatoria: ${resumen.unidadesConVeta} unidades · mecanizadas: ${resumen.unidadesMecanizadas} unidades`,
          resumen.materiales.length > 0 ? `Materiales: ${resumen.materiales.join(', ')}` : 'Materiales: sin declarar',
          '',
          formatearPiezas(piezas),
          '',
          'Por grupo:',
          grupos
        ].join('\n');

        return {
          content: [{ type: 'text', text: texto }],
          structuredContent: { piezas, resumen }
        };
      })
  );
}
