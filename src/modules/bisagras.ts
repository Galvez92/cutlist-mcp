/**
 * Reglas de bisagras para puertas batientes, verificadas con catálogos de herraje
 * (2026-10-29). Valores de referencia, no reglas del motor: no hay acuerdos con
 * ningún fabricante. Las usan el clóset y la cocina.
 *
 * Fuentes
 * -------
 * - Hettich, *Sensys* (catálogo técnico), p. 14 «Number of hinges per door»:
 *   2 / 3 / 4 / 5 bisagras por puerta hasta 900 / 1600 / 2000 / 2400 mm de alto,
 *   para puertas de hasta 600 mm de ancho (guía para tablero de 19 mm y
 *   750 kg/m³). En media cubrición, el revelado total entre las dos puertas debe
 *   ser al menos dos veces el revelado mínimo de la puerta.
 *   https://web.hettich.com/fileadmin/media/Sensys_Catalogue_11309_en.pdf
 * - Blum, CLIP top BLUMOTION (ficha técnica): copa Ø35 mm, distancia de copa
 *   3–7 mm, espesor de puerta 15–24 mm.
 *   https://d2.blum.com/services/BEC003/cliptopbmn_fl_dok_bus_$sen-us_$aof_$v1.pdf
 * - Blum, guía rápida de bisagras: centro de copa a 20.5–25.5 mm del borde (según
 *   la distancia de barrenado de 3–8 mm), barrenos Ø8 mm y tabla de revelado
 *   mínimo (puerta de 18 mm con barrenado de 3 mm: 1.3 mm).
 *   https://downloads2.cabinetparts.com/54af8d4d-ea85-4fdd-a601-1a0a31dbcd92.pdf
 * - Blum, *Number of hinges*: 2 bisagras para 4–6 kg y 3 para 6–12 kg, válido
 *   para puertas de hasta 600 mm de ancho; hasta 650 mm, una bisagra más.
 *   https://ea.blum.com/en/number-of-hinges/
 */

export const BISAGRAS_POR_ALTO: readonly { altoMaximo: number; bisagras: number }[] = [
  { altoMaximo: 900.0, bisagras: 2 },
  { altoMaximo: 1600.0, bisagras: 3 },
  { altoMaximo: 2000.0, bisagras: 4 },
  { altoMaximo: 2400.0, bisagras: 5 },
];

/** Alto máximo de puerta que cubre la guía de bisagras (mm). */
export const ALTO_MAXIMO_BISAGRAS = 2400.0;

/** Ancho máximo de puerta que cubre la guía de bisagras (mm). */
export const ANCHO_MAXIMO_GUIA_BISAGRAS = 600.0;

/**
 * Revelado mínimo de una puerta de 18 mm con la copa a 3 mm del borde (mm).
 * Blum CLIP top: 1.3 mm; Hettich *Sensys*: 0.6–0.8 mm según la tabla del
 * catálogo. Se toma el mayor.
 */
export const REVELADO_MINIMO_PUERTA_18 = 1.3;

/** Juego mínimo entre dos puertas: dos veces el revelado mínimo (mm). */
export const JUEGO_MINIMO_ENTRE_PUERTAS = 2 * REVELADO_MINIMO_PUERTA_18;

/**
 * Bisagras por puerta según su alto, con la guía de Hettich Sensys.
 * Sobre 2400 mm la guía no cubre el caso: se devuelve la cantidad del último
 * tramo y el módulo avisa en las notas.
 */
export function bisagrasPorPuerta(altoPuerta: number): number {
  for (const tramo of BISAGRAS_POR_ALTO) {
    if (altoPuerta <= tramo.altoMaximo) return tramo.bisagras;
  }
  return BISAGRAS_POR_ALTO[BISAGRAS_POR_ALTO.length - 1].bisagras;
}
