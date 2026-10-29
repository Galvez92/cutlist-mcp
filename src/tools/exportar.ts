import type { McpServer } from '@modelcontextprotocol/server';

import type { ResultadoOptimizacion } from '../core/adaptador.js';
import { optimizar } from '../core/adaptador.js';
import { exportarSchema } from '../esquemas.js';
import { buscarFormato, catalogoFormatos, idsFormatos } from '../export/index.js';
import { ejecutar, normalizarPiezas, normalizarTableros } from './comun.js';

export function describirCatalogo(): string {
  return catalogoFormatos()
    .map(formato => {
      const marcas = [
        `- ${formato.id} (${formato.nombre}, .${formato.extension})`,
        `estado: ${formato.estado}`,
        formato.requiereOptimizacion ? 'necesita tableros para calcular el layout' : 'exporta la lista de piezas'
      ].join(' · ');
      return [marcas, `  ${formato.nota}`, `  Fuentes: ${formato.fuentes.join(' | ')}`].join('\n');
    })
    .join('\n');
}

export function registrarExportar(servidor: McpServer): void {
  servidor.registerTool(
    'exportar',
    {
      title: 'Exportar (formatos soportados)',
      description:
        'Exporta la lista de piezas (y el layout, cuando el formato lo necesita) al formato pedido. ' +
        'Si se omite `formato`, devuelve el catálogo de formatos soportados con su estado de verificación. ' +
        'Formatos con layout: svg y dxf (requieren tableros). El contenido se entrega como texto.',
      inputSchema: exportarSchema
    },
    async ({ formato, piezas: entradasPiezas, tableros: entradasTableros, estrategia, kerf, permitirRotacion }) =>
      ejecutar(() => {
        if (!formato) {
          return {
            content: [
              {
                type: 'text' as const,
                text: `Formatos soportados (los no verificados van marcados «por revisar»):\n${describirCatalogo()}`
              }
            ],
            structuredContent: { formatos: catalogoFormatos() }
          };
        }

        const definicion = buscarFormato(formato);
        if (!definicion) {
          throw new Error(`Formato no soportado: ${formato}. Disponibles: ${idsFormatos().join(', ')}.`);
        }
        if (!entradasPiezas || entradasPiezas.length === 0) {
          throw new Error('Faltan las piezas: pásalas en `piezas` o pide el catálogo sin `formato`.');
        }

        const piezas = normalizarPiezas(entradasPiezas);
        let resultado: ResultadoOptimizacion | undefined;

        if (definicion.requiereOptimizacion) {
          if (!entradasTableros || entradasTableros.length === 0) {
            throw new Error(`El formato ${definicion.id} necesita tableros en stock para calcular el layout.`);
          }
          resultado = optimizar(piezas, normalizarTableros(entradasTableros, piezas), {
            ...(estrategia ? { estrategia } : {}),
            ...(kerf === undefined ? {} : { kerf }),
            ...(permitirRotacion === undefined ? {} : { permitirRotacion })
          });
        }

        const contenido = definicion.exportar({ piezas, resultado });
        const encabezado = [
          `Formato ${definicion.id} (${definicion.nombre}, .${definicion.extension}) · estado: ${definicion.estado}`,
          `Nota: ${definicion.nota}`,
          `Fuentes: ${definicion.fuentes.join(' | ')}`
        ].join('\n');

        return {
          content: [{ type: 'text', text: `${encabezado}\n\n${contenido}` }],
          structuredContent: {
            formato: definicion.id,
            nombre: definicion.nombre,
            extension: definicion.extension,
            mime: definicion.mime,
            estado: definicion.estado,
            fuentes: definicion.fuentes,
            nota: definicion.nota,
            caracteres: contenido.length,
            lineas: contenido.split('\n').length,
            piezas: piezas.length
          }
        };
      })
  );
}
