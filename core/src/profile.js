/**
 * Perfiles de restricciones.
 *
 * POR REVISAR: los valores del perfil Cortecloud/Madijal son observaciones de uso
 * real registradas en `docs/memoria/MEMORIA.md`, no reglas del motor ni
 * documentación oficial del proveedor. No son valores por defecto del optimizador:
 * solo se aplican si el usuario elige el perfil.
 *
 * Fuente: docs/memoria/MEMORIA.md (sección "Perfil de restricciones de ejemplo").
 */

export const DEFAULT_KERF = 4; // valor de partida editable; ajustar al disco de la máquina

export const PROFILES = Object.freeze({
  none: null,
  'cortecloud-madijal': {
    id: 'cortecloud-madijal',
    label: 'Cortecloud / Madijal (observado)',
    verified: false,
    source: 'docs/memoria/MEMORIA.md#perfil-de-restricciones-de-ejemplo-opcional-cortecloudmadijal',
    note: 'Restricciones observadas en uso real; no son reglas del motor ni documentación oficial.',
    minCut: 65, // pieza mínima de corte
    minMachinedLength: 250, // pieza mecanizada
    maxPiece: { width: 2480, height: 1810 },
    sheet: { width: 2500, height: 1830, thickness: 18 },
  },
});

export function getProfile(id) {
  if (id == null || id === 'none' || id === '') return null;
  const profile = PROFILES[id];
  if (!profile) throw new Error(`perfil desconocido: ${id}`);
  return profile;
}
