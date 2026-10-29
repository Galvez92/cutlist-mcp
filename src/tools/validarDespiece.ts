/** Herramienta MCP `validar_despiece`: valida piezas contra el perfil Cortecloud/Madijal. */

import type { McpServer } from '@modelcontextprotocol/server';

import { CORTECLOUD_MADIJAL_PROFILE, normalizeParts, validateParts } from '../engine/index.js';
import type { PartInput, ProfileIssue } from '../engine/index.js';
import { validarDespieceSchema } from '../esquemas.js';
import { ejecutar, normalizarPiezas } from './comun.js';

export function registrarValidarDespiece(servidor: McpServer): void {
  servidor.registerTool(
    'validar_despiece',
    {
      title: 'Validar despiece contra perfil de restricciones',
      description:
        'Valida una lista de piezas contra el perfil Cortecloud/Madijal (por revisar): ' +
        'mínimo de corte 65 mm, pieza máxima 2480 × 1810 mm y espesor con stock. ' +
        'Devuelve los hallazgos con su severidad (error, aviso, por-revisar). ' +
        'No modifica las piezas ni calcula el corte.',
      inputSchema: validarDespieceSchema
    },
    async ({ piezas: entradasPiezas }) =>
      ejecutar(() => {
        const piezas = normalizarPiezas(entradasPiezas);

        const partsInput: PartInput[] = piezas.map(p => ({
          id: p.id,
          code: p.id,
          label: p.nombre,
          width: p.largo,
          height: p.ancho,
          qty: p.cantidad,
          grain: p.veta ? 'vertical' : 'none',
        }));

        const parts = normalizeParts(partsInput);
        const hallazgos: ProfileIssue[] = validateParts(parts, CORTECLOUD_MADIJAL_PROFILE);

        const errores = hallazgos.filter(h => h.severity === 'error');
        const avisos = hallazgos.filter(h => h.severity === 'aviso');
        const porRevisar = hallazgos.filter(h => h.severity === 'por-revisar');

        const lineas = [
          `Perfil: ${CORTECLOUD_MADIJAL_PROFILE.name} (${CORTECLOUD_MADIJAL_PROFILE.reviewStatus})`,
          `${hallazgos.length} hallazgo(s): ${errores.length} error(es), ${avisos.length} aviso(s), ${porRevisar.length} por revisar`,
        ];
        for (const h of hallazgos) {
          lineas.push(`- [${h.severity}] ${h.message}`);
        }

        return {
          content: [{ type: 'text', text: lineas.join('\n') }],
          structuredContent: {
            perfil: CORTECLOUD_MADIJAL_PROFILE.id,
            estado: CORTECLOUD_MADIJAL_PROFILE.reviewStatus,
            fuentes: CORTECLOUD_MADIJAL_PROFILE.sources,
            hallazgos,
            valido: errores.length === 0,
          }
        };
      })
  );
}
