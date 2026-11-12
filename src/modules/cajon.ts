/**
 * Cajón individual paramétrico.
 *
 * A diferencia de la cajonera (torre de cajones dentro de un módulo), este
 * generador produce **un solo cajón** —la caja deslizante— con tres
 * características constructivas:
 *
 * - **Fondo en ranura**: el panel del fondo se inserta en una ranura (canal)
 *   fresada en la cara interior de los laterales y en el borde inferior interior
 *   del frente y la trasera, no atornillado por debajo.
 * - **Armado solo con minifix** (excentricas) a ~50 mm de las orillas: sin
 *   tornillos estructurales; los laterales se unen al frente y la trasera con
 *   minifix. Las excentricas (Ø15 mm, barreno vertical en la cara interior del
 *   lateral) se colocan a ``distanciaMinifix`` de las orillas superior e
 *   inferior; los pines van en el canto del frente/trasera.
 *   Diámetros según el herraje real (Häfele, *IXCONNECT Minifix 15 metal
 *   housings*): caja Ø15 mm con 13.5 mm de profundidad en tablero de 18 mm y
 *   barreno del pasador de **Ø7 u Ø8 mm** en el canto del panel, según el
 *   espárrago elegido. El perfil Cortecloud/Madijal solo admite Ø9.525 mm
 *   (3/8") en horizontal, medida que no es de minifix: se deja como parámetro
 *   (``diametro_pin``) y el perfil lo marca *por revisar* con el proveedor.
 * - **Correderas al centro**: la corredera se monta por debajo del cajón,
 *   centrada, sin necesitar juego lateral. El largo de la corredera se elige
 *   del catálogo estándar (400/450/500 mm, ARAUCO #17).
 *
 * Convención de cantos: ver `docs/modulos-parametricos.md`. En piezas
 * verticales (laterales, frente) la arista frontal del cajón se marca en
 * ``largo_a``.
 */

import { Accesorio, Modulo } from "./modulo.js";
import {
  CANTO_DEFAULT,
  MATERIAL_DEFAULT,
  MATERIAL_TRASERA_DEFAULT,
  elegirCorredera,
  exigirPositivo,
} from "./common.js";
import { Cantos, Mecanizado, Pieza, ValueError, barreno, ranura } from "./parts.js";
import type { Barreno } from "./parts.js";

export const CAMPOS: Record<string, string> = {
  ancho: "Ancho exterior de la caja del cajón (mm)",
  fondo: "Profundidad del cajón, largo del lateral (mm)",
  alto: "Alto del lateral del cajón (mm)",
  espesor: "Espesor del tablero del cuerpo (mm)",
  fondo_espesor: "Espesor del panel del fondo (mm); 0 = sin fondo",
  ranura_ancho: "Ancho de la ranura del fondo (mm) — debe estar en las permitidas del perfil",
  ranura_distancia: "Distancia de la ranura desde el borde inferior (mm)",
  ranura_profundidad: "Profundidad de la ranura en la cara interior (mm)",
  distancia_minifix: "Distancia de los minifix desde las orillas superior e inferior (mm)",
  diametro_pin: "Diámetro del barreno del pasador minifix en el canto (mm); el herraje real usa 7 u 8",
  material: "Texto del material del cuerpo (como en el despiece)",
  material_fondo: "Texto del material del fondo",
  canto: "Texto del canto de las aristas vistas",
  nombre: "Nombre del módulo para el despiece",
};

export interface ParamsCajon {
  ancho?: number;
  fondo?: number;
  alto?: number;
  espesor?: number;
  fondoEspesor?: number;
  ranuraAncho?: number;
  ranuraDistancia?: number;
  ranuraProfundidad?: number;
  distanciaMinifix?: number;
  diametroPin?: number;
  material?: string;
  materialFondo?: string;
  canto?: string;
  nombre?: string;
}

/**
 * Diámetro del barreno del pasador en el canto (mm): Ø7 mm, la medida menor que
 * publica Häfele para el Minifix 15 («bolt drill hole Ø7 or Ø8 mm»); Ø8 con el
 * espárrago correspondiente. No es 3/8" (9.525 mm): ese es el único horizontal
 * del perfil Cortecloud/Madijal, que no coincide con el herraje real.
 */
const DIAMETRO_PIN_DEFAULT = 7.0;

export const DEFAULTS_CAJON: Required<Omit<ParamsCajon, "nombre" | "materialFondo">> & {
  nombre: string;
  materialFondo: string;
} = {
  ancho: 600.0,
  fondo: 500.0,
  alto: 150.0,
  espesor: 18.0,
  fondoEspesor: 3.0,
  ranuraAncho: 6.7,
  ranuraDistancia: 15.0,
  ranuraProfundidad: 10.0,
  distanciaMinifix: 50.0,
  diametroPin: DIAMETRO_PIN_DEFAULT,
  material: MATERIAL_DEFAULT,
  materialFondo: MATERIAL_TRASERA_DEFAULT,
  canto: CANTO_DEFAULT,
  nombre: "",
};

/**
 * Profundidad del barreno de la excentrica minifix (mm): 13.5 mm para tablero
 * de 18 mm (Häfele *IXCONNECT Minifix 15*: 12.0/12.5/13.5/14.0 mm para 15/16/18/19
 * mm). Con otro espesor hay que ajustarla — *por revisar*.
 */
const PROFUNDIDAD_CAM_MINIFIX = 13.5;
/** Profundidad del barreno del pin minifix en el canto (mm). */
const PROFUNDIDAD_PIN_MINIFIX = 12.0;
/** Diámetro del barreno vertical de la excentrica minifix. */
const DIAMETRO_CAM = 15.0;

export function generar(params: ParamsCajon = {}): Modulo {
  const p = { ...DEFAULTS_CAJON, ...params };
  exigirPositivo({
    ancho: p.ancho,
    fondo: p.fondo,
    alto: p.alto,
    espesor: p.espesor,
  });
  if (p.distanciaMinifix <= 0) {
    throw new ValueError("distancia_minifix debe ser mayor que cero");
  }
  if (p.diametroPin <= 0) {
    throw new ValueError("diametro_pin debe ser mayor que cero");
  }
  if (2 * p.distanciaMinifix >= p.alto) {
    throw new ValueError(
      `los minifix a ${p.distanciaMinifix.toFixed(0)} mm de cada orilla no caben en ` +
        `el alto del cajón (${p.alto.toFixed(0)} mm)`,
    );
  }

  const nombre =
    p.nombre || `Cajón ${p.ancho.toFixed(0)}x${p.fondo.toFixed(0)}x${p.alto.toFixed(0)}`;
  const anchoInterior = p.ancho - 2 * p.espesor;
  const fondoInterior = p.fondo - 2 * p.espesor;
  if (anchoInterior <= 0) {
    throw new ValueError("el ancho exterior no deja interior entre laterales");
  }

  // --- Ranura del fondo --------------------------------------------------
  const conFondo = p.fondoEspesor > 0;
  if (conFondo) {
    if (p.ranuraDistancia + p.ranuraAncho > p.alto) {
      throw new ValueError("la ranura del fondo no cabe en el alto del cajón");
    }
  }

  const ranuraFondo = conFondo
    ? ranura({
        cara: "i",
        profundidad: p.ranuraProfundidad,
        ancho: p.ranuraAncho,
        distancia: p.ranuraDistancia,
      })
    : null;

  // --- Minifix: excentricas en el lateral, pines en frente/trasera --------
  const yArriba = p.alto - p.distanciaMinifix;
  const yAbajo = p.distanciaMinifix;
  const xFrontal = p.espesor / 2;
  const xTrasero = p.fondo - p.espesor / 2;

  const camsLateral: Barreno[] = [
    barreno({ cara: "i", x: xFrontal, y: yAbajo, profundidad: PROFUNDIDAD_CAM_MINIFIX, diametro: DIAMETRO_CAM, horizontal: false }),
    barreno({ cara: "i", x: xFrontal, y: yArriba, profundidad: PROFUNDIDAD_CAM_MINIFIX, diametro: DIAMETRO_CAM, horizontal: false }),
    barreno({ cara: "i", x: xTrasero, y: yAbajo, profundidad: PROFUNDIDAD_CAM_MINIFIX, diametro: DIAMETRO_CAM, horizontal: false }),
    barreno({ cara: "i", x: xTrasero, y: yArriba, profundidad: PROFUNDIDAD_CAM_MINIFIX, diametro: DIAMETRO_CAM, horizontal: false }),
  ];

  const pinesFrenteTrasera: Barreno[] = [
    barreno({ cara: "i", x: 0, y: yAbajo, profundidad: PROFUNDIDAD_PIN_MINIFIX, diametro: p.diametroPin, horizontal: true }),
    barreno({ cara: "i", x: 0, y: yArriba, profundidad: PROFUNDIDAD_PIN_MINIFIX, diametro: p.diametroPin, horizontal: true }),
    barreno({ cara: "i", x: anchoInterior, y: yAbajo, profundidad: PROFUNDIDAD_PIN_MINIFIX, diametro: p.diametroPin, horizontal: true }),
    barreno({ cara: "i", x: anchoInterior, y: yArriba, profundidad: PROFUNDIDAD_PIN_MINIFIX, diametro: p.diametroPin, horizontal: true }),
  ];

  const mecanizadoLateral = new Mecanizado(
    ranuraFondo ? [ranuraFondo] : [],
    camsLateral,
  );
  const mecanizadoFrenteTrasera = new Mecanizado(
    ranuraFondo ? [ranuraFondo] : [],
    pinesFrenteTrasera,
  );

  // --- Piezas ------------------------------------------------------------
  const comun = { espesor: p.espesor, material: p.material, modulo: nombre };
  const piezas: Pieza[] = [
    new Pieza({
      nombre: "Lateral",
      largo: p.fondo,
      ancho: p.alto,
      cantidad: 2,
      rol: "lateral",
      cantos: new Cantos(p.canto),
      mecanizado: mecanizadoLateral,
      funcion: "Lateral del cajón — canto en la arista superior, ranura para el fondo, " +
        "excentricas minifix Ø15 a " + p.distanciaMinifix.toFixed(0) + " mm de cada orilla",
      ...comun,
    }),
    new Pieza({
      nombre: "Frente",
      largo: anchoInterior,
      ancho: p.alto,
      rol: "frente",
      cantos: new Cantos(p.canto),
      mecanizado: mecanizadoFrenteTrasera,
      funcion:
        "Frente del cajón entre laterales — canto en la arista superior, " +
        `ranura para el fondo, pines minifix Ø${p.diametroPin} mm en los cantos`,
      ...comun,
    }),
    new Pieza({
      nombre: "Trasera",
      largo: anchoInterior,
      ancho: p.alto,
      rol: "trasera",
      mecanizado: mecanizadoFrenteTrasera,
      funcion:
        "Trasera del cajón entre laterales — sin canto, ranura para el fondo, " +
        `pines minifix Ø${p.diametroPin} mm en los cantos`,
      ...comun,
    }),
  ];

  if (conFondo) {
    const fondoLargo = fondoInterior + 2 * p.ranuraProfundidad;
    const fondoAncho = anchoInterior + 2 * p.ranuraProfundidad;
    piezas.push(
      new Pieza({
        nombre: "Fondo",
        largo: Math.max(fondoLargo, fondoAncho),
        ancho: Math.min(fondoLargo, fondoAncho),
        espesor: p.fondoEspesor,
        material: p.materialFondo,
        rol: "fondo",
        veta: "indiferente",
        funcion: "Fondo del cajón en ranura — panel delgado insertado en los canales de " +
          "laterales, frente y trasera",
        modulo: nombre,
      }),
    );
  }

  // --- Correderas al centro ----------------------------------------------
  const { largo: largoCorredera, esEstandar } = elegirCorredera(p.fondo);

  const notas: string[] = [
    "Fondo en ranura: el panel se inserta en canales fresados en laterales, frente y trasera.",
    `Armado solo con minifix: excentricas Ø15 mm a ${p.distanciaMinifix.toFixed(0)} mm de cada orilla ` +
      `(4 por lateral, barreno de ${PROFUNDIDAD_CAM_MINIFIX.toFixed(1)} mm de profundidad en tablero de 18 mm); ` +
      `pines Ø${p.diametroPin} mm en los cantos del frente y la trasera.`,
    "Herraje Häfele Minifix 15: el barreno del pasador es de Ø7 u Ø8 mm; el perfil Cortecloud/Madijal " +
      "solo admite Ø9.525 mm (3/8\") en horizontal, así que esa medida queda por revisar con el proveedor.",
    "Correderas al centro: la corredera se monta por debajo del cajón, centrada, sin juego lateral.",
  ];
  if (!esEstandar) {
    notas.push(
      `El cajón queda de ${largoCorredera.toFixed(0)} mm de fondo: no calza ninguna corredera ` +
        "de 400/450/500 mm (ARAUCO #17); por revisar el catálogo del herraje.",
    );
  }

  const accesorios = [
    new Accesorio(
      "Corredera al centro",
      1,
      `Un par, largo ${largoCorredera.toFixed(0)} mm`,
    ),
    new Accesorio(
      "Minifix",
      8,
      "4 por lateral (2 frente + 2 trasera): excentrica Ø15 + pin",
    ),
    new Accesorio("Tirador o manija", 1),
  ];

  return new Modulo(
    "cajon",
    nombre,
    {
      ancho: p.ancho,
      fondo: p.fondo,
      alto: p.alto,
      ancho_interior: anchoInterior,
      fondo_interior: fondoInterior,
      largo_corredera: largoCorredera,
    },
    piezas,
    accesorios,
    notas,
  );
}
