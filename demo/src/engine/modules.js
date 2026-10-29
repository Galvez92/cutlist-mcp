/**
 * Adaptador de los módulos paramétricos (rama parametric-modules) para la demo.
 *
 * El motor expone `MODULOS` (registro) y `generarModulo` (generadores de
 * cajonera, clóset, cocina y librero). Aquí se bridgea la `Pieza` paramétrica al
 * formato de pieza del demo usando `Pieza.toPartInput()` (width = ancho,
 * height = largo, veta → grain, cantos → edges). El reparto de aristas a lados
 * absolutos del motor está por revisar (docs/modulos-parametricos.md).
 */

import { MODULOS, generarModulo } from '@engine';

/** Tipos de módulo disponibles (para el selector de la UI). */
export function moduleTypes() {
  return Object.values(MODULOS).map((m) => ({
    tipo: m.tipo,
    titulo: m.titulo,
    descripcion: m.descripcion,
  }));
}

/** Parámetros con tipo y valor por omisión de un módulo (para la UI). */
export function moduleFields(tipo) {
  const reg = MODULOS[tipo];
  return reg ? reg.camposUi() : [];
}

/** Tablero de stock recomendado para un módulo (perfil Cortecloud/Madijal). */
export const MODULE_SHEET = Object.freeze({
  name: 'Melamina 18 mm',
  width: 2500,
  height: 1830,
  thickness: 18,
});

/** Convierte las piezas resumidas de un módulo al formato de pieza del demo. */
export function moduleToParts(modulo) {
  return modulo.resumen().map((pieza) => {
    const pi = pieza.toPartInput();
    return {
      id: pi.id,
      label: pi.label || pi.id,
      width: pi.width,
      height: pi.height,
      qty: pi.qty,
      grain: pi.grain,
      edges: pi.edges,
      material: pi.material || '',
    };
  });
}

/**
 * Genera un módulo a partir de valores sueltos (clave pública snake_case) y lo
 * devuelve listo para la demo: piezas, tablero recomendado y aviso resumen.
 */
export function buildModule(tipo, valores = {}) {
  const modulo = generarModulo(tipo, valores);
  const tot = modulo.totales();
  const hallazgos = modulo.validar();
  const parts = moduleToParts(modulo);
  const titulo = MODULOS[tipo]?.titulo ?? modulo.tipo;
  const notice = [
    `${titulo}: ${tot.unidades} piezas en ${tot.lineas} líneas (${tot.area_m2.toFixed(2)} m² de tablero).`,
    hallazgos.length
      ? `Perfil Cortecloud/Madijal: ${hallazgos.length} hallazgo(s) — ver los avisos del layout.`
      : 'Perfil Cortecloud/Madijal: sin hallazgos.',
    'Reparto de cantos a lados del motor por revisar (docs/modulos-parametricos.md).',
  ].join(' ');
  return { parts, notice, sheet: { ...MODULE_SHEET }, modulo };
}
