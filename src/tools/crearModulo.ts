import type { McpServer } from '@modelcontextprotocol/server';

import { formatearPiezas, resumirPiezas } from '../core/listar';
import { generarModulo } from '../core/modulos';
import { parametrosModuloSchema } from '../esquemas';
import { ejecutar } from './comun';

export function registrarCrearModulo(servidor: McpServer): void {
  servidor.registerTool(
    'crear_modulo',
    {
      title: 'Crear módulo paramétrico',
      description:
        'Genera la lista de piezas de un módulo de mueble (cajonera, closet, cocina, librero) a partir de sus ' +
        'medidas en milímetros. Devuelve cada pieza con cantidad, veta y cantos, lista para optimizar_corte. ' +
        'Los laterales y las traseras llevan veta vertical; las orillas frontales llevan el canto de `cantoFrente`.',
      inputSchema: parametrosModuloSchema
    },
    async parametros =>
      ejecutar(() => {
        const piezas = generarModulo(parametros);
        const resumen = resumirPiezas(piezas);
        const texto = [
          `Módulo ${parametros.tipo} «${parametros.nombre ?? parametros.tipo}»: ${resumen.lineas} líneas, ` +
            `${resumen.unidades} unidades, ${resumen.areaM2} m²`,
          formatearPiezas(piezas),
          '',
          'Siguiente paso: optimizar_corte con esta lista y los tableros en stock.'
        ].join('\n');

        return {
          content: [{ type: 'text', text: texto }],
          structuredContent: {
            tipo: parametros.tipo,
            nombre: parametros.nombre ?? parametros.tipo,
            piezas,
            resumen
          }
        };
      })
  );
}
