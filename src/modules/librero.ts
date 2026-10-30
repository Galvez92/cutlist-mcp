/**
 * Librero (estantería de libros) paramétrico.
 *
 * Geometría (mm, medidas exteriores)
 * ----------------------------------
 * - ``ancho``, ``alto`` y ``fondo`` exteriores (costado a costado).
 * - Caja: 2 costados de ``alto x fondo`` (con canto frontal y canto en la arista
 * superior, porque la tapa va entre costados), tapa y base entre costados,
 * repisas entre costados y trasera de 3 mm encastrada en una ranura de los
 * cuatro lados (``trasera_ranura``; ``false`` la deja clavada al dorso). Espesor
 * de trasera según ARAUCO, serie Cómo Hacer 17.
 * - Repisas repartidas en el interior o en alturas explícitas; con
 * ``repisasMoviles`` los costados llevan barrenos Ø5 (criterio de ARAUCO #6).
 *
 * *Por revisar*: los valores por omisión de ``fondo`` (300 mm) y de la altura útil
 * entre repisas se tomaron de guías de taller ("un librero de 30 a 35 cm de
 * profundidad y la misma separación entre entrepaños": https://www.instagram.com/p/B7RItFOH3XF/),
 * no de un documento técnico; la luz máxima entre apoyos tampoco tiene fuente
 * verificada y por eso el perfil no la avisa salvo que se configure
 * (``PerfilRestricciones.luzMaxRepisaAviso``). Ajuste esas medidas antes de
 * fabricar.
 */

import { Accesorio, Modulo } from "./modulo.js";
import {
  CANTO_DEFAULT,
  MATERIAL_DEFAULT,
  MATERIAL_TRASERA_DEFAULT,
  RANURA_TRASERA_ANCHO_DEFAULT,
  RANURA_TRASERA_DISTANCIA_DEFAULT,
  RANURA_TRASERA_PROFUNDIDAD_DEFAULT,
  barrenosRepisa,
  encajeTrasera,
  exigirPositivo,
  posicionesRepisas,
} from "./common.js";
import { Cantos, Mecanizado, Pieza, ValueError } from "./parts.js";

export const CAMPOS: Record<string, string> = {
  ancho: "Ancho exterior, de costado a costado (mm)",
  alto: "Alto exterior total (mm)",
  fondo: "Profundidad del costado (mm) — por revisar",
  repisas: "Cantidad de repisas (si no se dan posiciones explícitas)",
  posiciones_repisas: "Alturas de repisa sobre el piso interior (mm)",
  repisas_moviles: "Perforar los costados para soportes de repisa (Ø5)",
  espesor: "Espesor del tablero del cuerpo (mm)",
  trasera_espesor: "Espesor de la trasera (mm); 0 = sin trasera",
  trasera_ranura: "Encastrar la trasera en una ranura de los cuatro lados; false = clavada al dorso",
  ranura_ancho: "Ancho de la ranura de la trasera (mm) — por revisar, el perfil exige una de sus medidas",
  ranura_profundidad: "Profundidad de la ranura de la trasera en la cara interior (mm)",
  ranura_distancia: "Distancia de la ranura desde el borde del dorso (mm)",
  material: "Texto del material del cuerpo (como en el despiece)",
  material_trasera: "Texto del material de la trasera",
  canto: "Texto del canto de las aristas vistas del cuerpo",
  nombre: "Nombre del módulo para el despiece",
};

export interface ParamsLibrero {
  ancho?: number;
  alto?: number;
  fondo?: number;
  repisas?: number;
  posicionesRepisas?: number[] | null;
  repisasMoviles?: boolean;
  espesor?: number;
  traseraEspesor?: number;
  traseraRanura?: boolean;
  ranuraAncho?: number;
  ranuraProfundidad?: number;
  ranuraDistancia?: number;
  material?: string;
  materialTrasera?: string;
  canto?: string;
  nombre?: string;
}

export const DEFAULTS_LIBRERO = {
  ancho: 800.0,
  alto: 2000.0,
  fondo: 300.0,
  repisas: 4,
  posicionesRepisas: null as number[] | null,
  repisasMoviles: false,
  espesor: 18.0,
  traseraEspesor: 3.0,
  traseraRanura: true,
  ranuraAncho: RANURA_TRASERA_ANCHO_DEFAULT,
  ranuraProfundidad: RANURA_TRASERA_PROFUNDIDAD_DEFAULT,
  ranuraDistancia: RANURA_TRASERA_DISTANCIA_DEFAULT,
  material: MATERIAL_DEFAULT,
  materialTrasera: MATERIAL_TRASERA_DEFAULT,
  canto: CANTO_DEFAULT,
  nombre: "",
};

export function generar(params: ParamsLibrero = {}): Modulo {
  const p = { ...DEFAULTS_LIBRERO, ...params };
  exigirPositivo({ ancho: p.ancho, alto: p.alto, fondo: p.fondo, espesor: p.espesor });
  if (p.repisas < 0) {
    throw new ValueError("la cantidad de repisas no puede ser negativa");
  }
  if (p.traseraEspesor >= p.fondo) {
    throw new ValueError("la trasera no puede ocupar toda la profundidad");
  }

  const material = p.material;
  const canto = p.canto;
  const nombre = p.nombre || `Librero ${p.ancho.toFixed(0)}x${p.alto.toFixed(0)}x${p.fondo.toFixed(0)}`;
  const anchoInterior = p.ancho - 2 * p.espesor;
  if (anchoInterior <= 0) {
    throw new ValueError("el ancho exterior no deja interior entre costados");
  }

  const interiorDesde = p.espesor;
  const interiorHasta = p.alto - p.espesor;
  const alturasRepisas =
    p.posicionesRepisas !== null
      ? [...p.posicionesRepisas]
      : posicionesRepisas(p.repisas, interiorDesde, interiorHasta);
  for (const posicion of alturasRepisas) {
    if (!(interiorDesde < posicion && posicion < interiorHasta)) {
      throw new ValueError(
        `la repisa a ${posicion.toFixed(0)} mm queda fuera del interior del módulo`,
      );
    }
  }

  const comun = { espesor: p.espesor, material, modulo: nombre };
  const encaje =
    p.traseraEspesor > 0 && p.traseraRanura
      ? encajeTrasera({
          anchoInterior,
          altoInterior: p.alto - 2 * p.espesor,
          fondo: p.fondo,
          anchoRanura: p.ranuraAncho,
          profundidad: p.ranuraProfundidad,
          distancia: p.ranuraDistancia,
          espesorTrasera: p.traseraEspesor,
        })
      : null;
  const ranurasTrasera = encaje ? [encaje.ranura] : [];
  const mecanizadoHorizontal = new Mecanizado(ranurasTrasera);
  const sufijoRanura = encaje ? ", ranura para la trasera" : "";
  // Con la trasera encastrada, las repisas no llegan al dorso: terminan en la
  // cara frontal de la trasera (distancia de la ranura + su ancho).
  const largoRepisa = encaje ? p.fondo - (p.ranuraDistancia + p.ranuraAncho) : p.fondo;
  const barrenosCostado = p.repisasMoviles ? barrenosRepisa(alturasRepisas).barrenos : [];
  const mecanizadoCostado = new Mecanizado(ranurasTrasera, barrenosCostado);
  let funcionCostado = "Costado — canto frontal y canto en la arista superior" + sufijoRanura;
  if (encaje) {
    funcionCostado += ` a ${p.ranuraDistancia.toFixed(1)} mm del borde del dorso`;
  }
  if (barrenosCostado.length) {
    funcionCostado += " y barrenos Ø5 para repisas móviles";
  }

  const piezas: Pieza[] = [
    new Pieza({
      nombre: "Costado",
      largo: p.alto,
      ancho: p.fondo,
      cantidad: 2,
      rol: "costado",
      cantos: new Cantos(canto, undefined, canto),
      mecanizado: mecanizadoCostado,
      funcion: funcionCostado,
      ...comun,
    }),
    new Pieza({
      nombre: "Base",
      largo: p.fondo,
      ancho: anchoInterior,
      rol: "base",
      cantos: new Cantos(undefined, undefined, canto),
      mecanizado: mecanizadoHorizontal,
      funcion: "Base entre costados — canto en la arista frontal" + sufijoRanura,
      ...comun,
    }),
    new Pieza({
      nombre: "Tapa",
      largo: p.fondo,
      ancho: anchoInterior,
      rol: "tapa",
      cantos: new Cantos(undefined, undefined, canto),
      mecanizado: mecanizadoHorizontal,
      funcion: "Tapa entre costados — canto en la arista frontal" + sufijoRanura,
      ...comun,
    }),
  ];

  if (alturasRepisas.length) {
    piezas.push(
      new Pieza({
        nombre: "Repisa",
        largo: largoRepisa,
        ancho: anchoInterior,
        cantidad: alturasRepisas.length,
        rol: "repisa",
        cantos: new Cantos(undefined, undefined, canto),
        funcion:
          "Repisa entre costados — canto en la arista frontal" +
          (encaje ? ", recortada contra la trasera encastrada" : ""),
        ...comun,
      }),
    );
  }
  if (p.traseraEspesor > 0) {
    piezas.push(
      new Pieza({
        nombre: "Trasera",
        largo: encaje ? Math.max(encaje.largo, encaje.ancho) : p.alto,
        ancho: encaje ? Math.min(encaje.largo, encaje.ancho) : p.ancho,
        espesor: p.traseraEspesor,
        material: p.materialTrasera,
        rol: "trasera",
        veta: "indiferente",
        funcion: encaje
          ? "Trasera encastrada en la ranura de costados, base y tapa (rigidiza el librero)"
          : "Trasera clavada al dorso del módulo (rigidiza el librero)",
        modulo: nombre,
      }),
    );
  }

  const notas: string[] = [
    "Tapa y base entre costados: las aristas superiores de los costados quedan a la vista.",
  ];
  if (!alturasRepisas.length) {
    notas.push("Librero sin repisas.");
  } else if (p.posicionesRepisas === null) {
    notas.push("Repisas repartidas parejas en el interior del módulo.");
  } else {
    notas.push("Repisas en las alturas pedidas.");
  }
  if (alturasRepisas.length) {
    notas.push(
      "Alturas de repisa sobre el piso interior (mm): " +
        alturasRepisas.map((h) => (h - p.espesor).toFixed(0)).join(", "),
    );
  }
  if (p.traseraEspesor <= 0) {
    notas.push("Sin trasera: el librero necesita muro o rigidización adicional.");
  } else if (encaje) {
    notas.push(
      `Trasera encastrada ${encaje.largo.toFixed(0)} x ${encaje.ancho.toFixed(0)} mm en una ranura de ` +
        `${p.ranuraAncho.toFixed(1)} mm de ancho x ${p.ranuraProfundidad.toFixed(0)} mm de profundidad, ` +
        `a ${p.ranuraDistancia.toFixed(0)} mm del borde del dorso, con ${encaje.holgura.toFixed(1)} mm ` +
        `de holgura para el panel (manual de melamina; por revisar contra el fresol y el perfil de la máquina).`,
    );
  } else {
    notas.push("La trasera se clava/atornilla al dorso, sin ranura.");
  }
  if (encaje && alturasRepisas.length) {
    notas.push(
      `Repisas de ${largoRepisa.toFixed(0)} mm de fondo: terminan en la cara frontal de la trasera encastrada.`,
    );
  }

  const accesorios: Accesorio[] = [
    new Accesorio("Tornillo 4 x 50 mm", 1, "Armado de costados, base y tapa"),
  ];
  if (p.repisasMoviles && alturasRepisas.length) {
    accesorios.push(
      new Accesorio("Soporte de repisa Ø5", 4 * alturasRepisas.length, "Cuatro soportes por repisa"),
    );
  }

  return new Modulo(
    "librero",
    nombre,
    {
      ancho: p.ancho,
      alto: p.alto,
      fondo: p.fondo,
      repisas: alturasRepisas.length,
      ancho_interior: anchoInterior,
    },
    piezas,
    accesorios,
    notas,
  );
}
