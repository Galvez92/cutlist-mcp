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
 * - Blum, *CLIP top BLUMOTION: Number of hinges* (blog técnico): 2 bisagras para
 *   puertas de 4–6 kg y 3 para 6–12 kg, contando el peso de la puerta con sus
 *   tiradores; vale para puertas de hasta 600 mm de ancho (hasta 650 mm, una
 *   bisagra más). Aclara que el alto también pesa en la decisión: en puertas
 *   altas y angostas conviene una bisagra extra «aunque con 6 kg no sea
 *   estrictamente necesario».
 *   https://ea.blum.com/en/number-of-hinges/
 * - Blum, CLIP top BLUMOTION (ficha técnica): copa Ø35 mm, distancia de copa
 *   3–7 mm, espesor de puerta 15–24 mm.
 *   https://d2.blum.com/services/BEC003/cliptopbmn_fl_dok_bus_$sen-us_$aof_$v1.pdf
 * - Blum, guía rápida de bisagras: centro de copa a 20.5–25.5 mm del borde (según
 *   la distancia de barrenado de 3–8 mm), barrenos Ø8 mm y tabla de revelado
 *   mínimo (puerta de 18 mm con barrenado de 3 mm: 1.3 mm).
 *   https://downloads2.cabinetparts.com/54af8d4d-ea85-4fdd-a601-1a0a31dbcd92.pdf
 * - Promart, ficha del *Tirador de acero inoxidable Orient recto 96 mm pulido*
 *   (SKU 103910): «Peso Del Producto 0.09 kg», consultada el 2026-10-29. Es el
 *   peso de ese tirador concreto; otro modelo cambia el valor.
 *   https://www.promart.pe/tirador-recto-acero-inox-96mm/p
 * - Promart, fichas de los tiradores rectos de acero inoxidable de 128 mm
 *   (liviano, SKU 103911; pesado, SKU 103916): ambas publican «Peso Del
 *   Producto 0.09 kg», consultadas el 2026-10-29. Mismo valor que el de 96 mm,
 *   pese a que una es «pesado»: parece un peso redondeado, así que el tirador
 *   elegido hay que pesarlo.
 *   https://www.promart.pe/tirador-recto-acero-inoxidable-liviano-128mm/p
 *   https://www.promart.pe/tirador-recto-pesado-acero-inoxidable-128mm/p
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
 * Bisagras por peso de puerta (kg), con la tabla de Blum *CLIP top BLUMOTION*:
 * 2 bisagras de 4 a 6 kg y 3 de 6 a 12 kg.
 */
export const BISAGRAS_POR_PESO: readonly { pesoMaximoKg: number; bisagras: number }[] = [
  { pesoMaximoKg: 6.0, bisagras: 2 },
  { pesoMaximoKg: 12.0, bisagras: 3 },
];

/** Peso máximo de puerta que cubre la guía de Blum (kg). */
export const PESO_MAXIMO_GUIA_BISAGRAS = 12.0;

/**
 * Densidad del tablero (kg/m³) usada por las guías. Hettich publica su tabla de
 * bisagras por alto para tablero de 19 mm y 750 kg/m³; es el único valor de
 * densidad que traen las fuentes consultadas. Para otro tablero se pasa la
 * densidad del material.
 */
export const DENSIDAD_TABLERO = 750.0;

/**
 * Peso de referencia de un tirador (kg): tirador recto de acero inoxidable de
 * 96 mm, 0.09 kg según la ficha del producto (Promart, SKU 103910, verificada el
 * 2026-10-29). Blum pide contar la puerta **con sus tiradores** para elegir las
 * bisagras, así que este valor entra en el peso de la puerta cuando el módulo no
 * indica otro.
 * Es el peso de ese tirador concreto, no una regla de fabricante: el taller debe
 * pasar el peso del tirador elegido (y 0 si la puerta no lleva tirador).
 */
export const PESO_TIRADOR_REFERENCIA = 0.09;

/** Peso publicado de un tirador de referencia, con la ficha consultada. */
export interface PesoTiradorReferencia {
  /** Distancia de instalación entre tornillos (mm). */
  medidaMm: number;
  /** Modelo del catálogo. */
  modelo: string;
  /** SKU del producto en la ficha. */
  sku: string;
  /** Peso del producto según su ficha (kg). */
  pesoKg: number;
  /** Enlace a la ficha consultada. */
  fuente: string;
}

/**
 * Tabla de pesos de referencia de tiradores (kg), verificada contra las fichas
 * de producto el 2026-10-29. Las tres fichas de Promart publican el mismo peso
 * (0.09 kg), incluso el modelo «pesado» de 128 mm: parece un valor redondeado,
 * así que el taller debe pesar el tirador elegido y pasar ese valor en
 * ``peso_tirador``. El peso de 96 mm es el que usa ``PESO_TIRADOR_REFERENCIA``.
 */
export const PESOS_TIRADOR_REFERENCIA: readonly PesoTiradorReferencia[] = [
  {
    medidaMm: 96.0,
    modelo: "Orient recto 96 mm pulido",
    sku: "103910",
    pesoKg: 0.09,
    fuente: "https://www.promart.pe/tirador-recto-acero-inox-96mm/p",
  },
  {
    medidaMm: 128.0,
    modelo: "Orient recto liviano 128 mm",
    sku: "103911",
    pesoKg: 0.09,
    fuente: "https://www.promart.pe/tirador-recto-acero-inoxidable-liviano-128mm/p",
  },
  {
    medidaMm: 128.0,
    modelo: "Orient recto pesado 128 mm pulido",
    sku: "103916",
    pesoKg: 0.09,
    fuente: "https://www.promart.pe/tirador-recto-pesado-acero-inoxidable-128mm/p",
  },
];

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

/**
 * Peso del tablero de la puerta en kg: área × espesor × densidad. No incluye
 * tiradores ni otros adicionales; para la guía de bisagras se usa
 * ``pesoPuertaConTiradorKg()``.
 */
export function pesoPuertaKg(
  ancho: number,
  alto: number,
  espesor: number,
  densidad: number = DENSIDAD_TABLERO,
): number {
  return (ancho / 1000.0) * (alto / 1000.0) * (espesor / 1000.0) * densidad;
}

/**
 * Peso de la puerta en kg tal como lo pide Blum: el tablero más sus tiradores.
 */
export function pesoPuertaConTiradorKg(
  ancho: number,
  alto: number,
  espesor: number,
  pesoTiradorKg: number = PESO_TIRADOR_REFERENCIA,
  densidad: number = DENSIDAD_TABLERO,
): number {
  return pesoPuertaKg(ancho, alto, espesor, densidad) + pesoTiradorKg;
}

/**
 * Bisagras por puerta según su peso, con la tabla de Blum.
 * Sobre 12 kg la guía no cubre el caso: se devuelve la cantidad del último
 * tramo y el módulo avisa en las notas.
 */
export function bisagrasPorPeso(pesoKg: number): number {
  for (const tramo of BISAGRAS_POR_PESO) {
    if (pesoKg <= tramo.pesoMaximoKg) return tramo.bisagras;
  }
  return BISAGRAS_POR_PESO[BISAGRAS_POR_PESO.length - 1].bisagras;
}

export interface OpcionesBisagras {
  /** Densidad del tablero de la puerta (kg/m³); por omisión 750. */
  densidad?: number;
  /**
   * Peso de un tirador de la puerta (kg). Por omisión
   * ``PESO_TIRADOR_REFERENCIA``; 0 calcula la puerta sin tirador.
   */
  pesoTiradorKg?: number;
}

export interface BisagrasPuerta {
  /** Cantidad que se pide: la mayor de las dos guías. */
  bisagras: number;
  /** Cantidad según el alto de la puerta (Hettich). */
  porAlto: number;
  /** Cantidad según el peso de la puerta (Blum). */
  porPeso: number;
  /** Peso de la puerta con sus tiradores (kg): lo que compara la guía. */
  pesoKg: number;
  /** Peso del tablero de la puerta solo (kg). */
  pesoTableroKg: number;
  /** Peso sumado de los tiradores de la puerta (kg). */
  pesoTiradorKg: number;
}

/**
 * Bisagras por puerta combinando las dos guías: la de alto (Hettich) y la de
 * peso (Blum). Se toma la mayor, porque cada guía es un mínimo independiente y
 * Blum pide contar el alto además del peso. El peso incluye los tiradores.
 */
export function bisagrasPuerta(
  ancho: number,
  alto: number,
  espesor: number,
  opciones: OpcionesBisagras = {},
): BisagrasPuerta {
  const densidad = opciones.densidad ?? DENSIDAD_TABLERO;
  const pesoTiradorKg = opciones.pesoTiradorKg ?? PESO_TIRADOR_REFERENCIA;
  const pesoTableroKg = pesoPuertaKg(ancho, alto, espesor, densidad);
  const pesoKg = pesoTableroKg + pesoTiradorKg;
  const porAlto = bisagrasPorPuerta(alto);
  const porPeso = bisagrasPorPeso(pesoKg);
  return {
    bisagras: Math.max(porAlto, porPeso),
    porAlto,
    porPeso,
    pesoKg,
    pesoTableroKg,
    pesoTiradorKg,
  };
}

/**
 * Avisos de la guía de bisagras que dependen del peso de la puerta, para que el
 * módulo los agregue a sus notas.
 */
export function notasPesoBisagras(resultado: BisagrasPuerta): string[] {
  const notas: string[] = [];
  const peso = `${resultado.pesoKg.toFixed(1)} kg (tablero ${resultado.pesoTableroKg.toFixed(1)} kg + tirador ${resultado.pesoTiradorKg.toFixed(2)} kg)`;
  if (resultado.porPeso > resultado.porAlto) {
    notas.push(
      `Puerta de ${peso}: la guía de Blum pide ${resultado.porPeso} bisagras (2 hasta 6 kg, 3 hasta 12 kg), más que las ${resultado.porAlto} del alto.`,
    );
  }
  if (resultado.pesoKg > PESO_MAXIMO_GUIA_BISAGRAS) {
    notas.push(
      `Puerta de ${peso}: la guía de bisagras por peso llega a ${PESO_MAXIMO_GUIA_BISAGRAS.toFixed(0)} kg; revisar la cantidad con el fabricante.`,
    );
  }
  return notas;
}
