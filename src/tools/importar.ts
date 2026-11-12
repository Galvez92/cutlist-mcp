import type { McpServer } from '@modelcontextprotocol/server';

import type { PiezaEntrada } from '../core/tipos.js';
import { formatearPiezas, resumirPiezas } from '../core/listar.js';
import { descriptor, importar as importarTexto } from '../formats/index.js';
import type { Piece } from '../formats/index.js';
import { importarSchema } from '../esquemas.js';
import { ejecutar, normalizarPiezas } from './comun.js';

/**
 * Cantos del formato (`c1`/`c2`/`l1`/`l2`, sistema de coordenadas de Cortecloud)
 * → cantos que entiende `optimizar_corte` (`largo1`/`largo2`/`ancho1`/`ancho2`).
 *
 * El reparto es 1:1 por nombre (`c1` → `largo1`, `l1` → `ancho1`): el lado
 * **físico** de cada orilla sigue marcado «por revisar», igual que en
 * `src/modules/cortecloud.ts`.
 */
const CANTOS_DEL_MOTOR = { c1: 'largo1', c2: 'largo2', l1: 'ancho1', l2: 'ancho2' } as const;

function cantosDelMotor(cantos: Piece['cantos']): PiezaEntrada['cantos'] {
  const salida: Record<string, string> = {};
  for (const [lado, texto] of Object.entries(cantos)) {
    const clave = CANTOS_DEL_MOTOR[lado as keyof typeof CANTOS_DEL_MOTOR];
    if (clave && texto) salida[clave] = texto;
  }
  return Object.keys(salida).length > 0 ? salida : undefined;
}

/** Pieza del formato → pieza de entrada de las demás herramientas. */
export function entradaDesdePieza(pieza: Piece): PiezaEntrada {
  const entrada: PiezaEntrada = {
    largo: pieza.largo,
    ancho: pieza.ancho,
    cantidad: pieza.cantidad
  };
  if (pieza.nombre) entrada.nombre = pieza.nombre;
  if (pieza.veta !== null) entrada.veta = pieza.veta;
  if (pieza.material) entrada.material = pieza.material;
  if (pieza.grupo) entrada.grupo = pieza.grupo;
  const cantos = cantosDelMotor(pieza.cantos);
  if (cantos) entrada.cantos = cantos;
  return entrada;
}

export function registrarImportar(servidor: McpServer): void {
  servidor.registerTool(
    'importar',
    {
      title: 'Importar piezas de un formato',
      description:
        'Lee un despiece ya armado (por ejemplo el JSON `{"parts":[…]}` de Cortecloud) y devuelve las piezas ' +
        'listas para `optimizar_corte`, `listar_piezas` o `validar_despiece`, con sus cantos y material. ' +
        'Úsala cuando el despiece venga de otra app y no de `crear_modulo`.',
      inputSchema: importarSchema
    },
    async ({ formato, contenido }) =>
      ejecutar(() => {
        const lista = importarTexto(contenido, formato);
        const piezas = normalizarPiezas(lista.piezas.map(entradaDesdePieza));
        const resumen = resumirPiezas(piezas);
        const info = descriptor(formato);

        const avisos = [...info.avisos(), ...lista.porRevisar()].filter(
          (aviso, i, todos) => todos.findIndex(otro => otro.mensaje === aviso.mensaje) === i
        );

        const texto = [
          `Importado desde ${info.clave} · ${info.nombre} · estado: ${info.estado}`,
          `${resumen.lineas} líneas · ${resumen.unidades} unidades · ${resumen.areaM2} m²`,
          resumen.materiales.length > 0
            ? `Materiales: ${resumen.materiales.join(', ')}`
            : 'Materiales: sin declarar',
          '',
          formatearPiezas(piezas),
          '',
          avisos.length > 0 ? `Por revisar (${avisos.length}):` : 'Por revisar: sin avisos',
          ...avisos.map(aviso => `- ${aviso.mensaje}${aviso.fuente ? ` (${aviso.fuente})` : ''}`),
          '',
          'Las piezas quedan listas para `optimizar_corte` o `validar_despiece`.'
        ].join('\n');

        return {
          content: [{ type: 'text', text: texto }],
          structuredContent: {
            formato: info.clave,
            nombre: info.nombre,
            estado: info.estado,
            piezas,
            resumen,
            avisos
          }
        };
      })
  );
}
