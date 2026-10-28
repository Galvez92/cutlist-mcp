/**
 * Piezas, repartos y mecanizados que comparten los generadores de módulos.
 *
 * Valores de referencia usados aquí y su origen
 * ---------------------------------------------
 * - ``ALTO_TRAVESAÑO`` 100 mm: travesaños del despiece real de Cortecloud en
 * `tests/fixtures/cortecloud/escritorio_D_simple.json` («Travesaño trasero», 100
 * mm de ancho).
 * - ``LARGOS_CORREDERA`` 400/450/500 mm: ARAUCO, *Cómo Diseñar y Construir
 * Correctamente una Cocina* (serie Cómo Hacer 17), que menciona correderas
 * tradicionales de 40, 50 y 60 cm.
 * - ``DISTANCIA_BARRENO_BORDE`` 40–50 mm, ``PASO_BARRENOS_REPISA`` 30 mm y el
 * criterio de «una posición y dos o tres hacia arriba y hacia abajo»: ARAUCO,
 * *Cómo Instalar Repisas* (serie Cómo Hacer 6).
 * - ``JUEGO_DEFAULT``, ``juegoCorredera``, ``margenAltoCajon`` y la profundidad
 * del barreno de repisa son valores de taller: **por revisar** contra el
 * herraje real antes de fabricar (ver `docs/modulos-parametricos.md`).
 */

import { Cantos, Mecanizado, Pieza, ValueError } from "./parts.js";
import type { Barreno } from "./parts.js";

export const MATERIAL_DEFAULT = "Melamina 18 mm";
export const CANTO_DEFAULT = "PVC 0.4 mm";
export const MATERIAL_TRASERA_DEFAULT = "MDF 3 mm";

export const JUEGO_DEFAULT = 3.0;
export const ALTO_TRAVESAÑO_DEFAULT = 100.0;
export const LARGOS_CORREDERA: readonly number[] = [400.0, 450.0, 500.0];
export const DISTANCIA_BARRENO_BORDE = 50.0;
export const PASO_BARRENOS_REPISA = 30.0;
export const BARRENOS_POR_POSICION = 5;
export const DIAMETRO_BARRENO_REPISA = 5.0;
export const PROFUNDIDAD_BARRENO_REPISA = 12.0;

/**
 * Reparte ``total`` en ``cantidad`` tramos iguales con ``cantidad - 1`` juegos.
 * Reparto de puertas cubrientes a lo ancho y de frentes de cajón a lo alto.
 */
export function repartir(total: number, cantidad: number, juego: number): number[] {
  if (cantidad <= 0) {
    throw new ValueError("la cantidad de tramos debe ser mayor que cero");
  }
  const tramo = (total - (cantidad - 1) * juego) / cantidad;
  return Array.from({ length: cantidad }, () => tramo);
}

/**
 * Posiciones de ``cantidad`` repisas repartidas entre ``desde`` y ``hasta``.
 * Devuelve las alturas de cada repisa (mm, relativas al mismo origen).
 */
export function posicionesRepisas(cantidad: number, desde: number, hasta: number): number[] {
  if (cantidad <= 0) return [];
  if (hasta <= desde) {
    throw new ValueError("el interior del módulo no tiene altura útil");
  }
  const paso = (hasta - desde) / (cantidad + 1);
  return Array.from({ length: cantidad }, (_, i) => desde + paso * (i + 1));
}

/**
 * Largo de corredera a usar: el mayor estándar que quepa.
 * Devuelve ``{ largo, esEstandar }``. Si ninguno de los largos conocidos cabe,
 * usa ``disponible`` y avisa (el catálogo del herraje es *por revisar*).
 */
export function elegirCorredera(
  disponible: number,
  largos: readonly number[] = LARGOS_CORREDERA,
): { largo: number; esEstandar: boolean } {
  const candidatos = largos.filter((largo) => largo <= disponible);
  if (candidatos.length) {
    return { largo: Math.max(...candidatos), esEstandar: true };
  }
  return { largo: Math.max(disponible, 0.0), esEstandar: false };
}

/** Completa los valores de frente: vacío = igual al cuerpo. */
export function frentes(
  material: string,
  materialFrente: string,
  canto: string,
  cantoFrente: string,
): [string, string, string, string] {
  return [material, materialFrente || material, canto, cantoFrente || canto];
}

/** Caja de cajón de 5 líneas, según el despiece real del fixture Cortecloud. */
export function cajon(
  nombre: string,
  anchoExterior: number,
  largo: number,
  alto: number,
  espesor: number,
  material: string,
  canto: string,
  modulo = "",
): Pieza[] {
  const anchoEntreLaterales = anchoExterior - 2 * espesor;
  if (anchoEntreLaterales <= 0) {
    throw new ValueError("el cajón no tiene ancho útil entre laterales");
  }
  if (alto <= 0 || largo <= 0) {
    throw new ValueError("el cajón necesita largo y alto mayores que cero");
  }

  const comun = { espesor, material, veta: "largo" as const, modulo, rol: "cajon" };
  return [
    new Pieza({
      nombre: `Lateral ${nombre}`,
      largo,
      ancho: alto,
      cantidad: 2,
      cantos: new Cantos(canto),
      funcion: "Lateral de cajón: canto en la arista superior",
      ...comun,
    }),
    new Pieza({
      nombre: `Frente interior ${nombre}`,
      largo: anchoEntreLaterales,
      ancho: alto,
      funcion: "Frente interior de cajón, entre laterales (bajo el frente cubriente)",
      ...comun,
    }),
    new Pieza({
      nombre: `Trasera ${nombre}`,
      largo: anchoEntreLaterales,
      ancho: alto,
      funcion: "Trasera de cajón, entre laterales",
      ...comun,
    }),
    new Pieza({
      nombre: `Piso ${nombre}`,
      largo,
      ancho: anchoExterior,
      funcion: "Piso de cajón, clavado/atornillado bajo la caja",
      ...comun,
    }),
  ];
}

/**
 * Barrenos Ø5 para soportes de repisa móvil (ARAUCO #6).
 * Por cada posición de repisa: la posición y ``porPosicion // 2`` arriba y
 * abajo, separadas ``paso`` mm, a ``distanciaBorde`` mm del borde frontal.
 */
export function barrenosRepisa(
  posiciones: readonly number[],
  distanciaBorde: number = DISTANCIA_BARRENO_BORDE,
  paso: number = PASO_BARRENOS_REPISA,
  porPosicion: number = BARRENOS_POR_POSICION,
  profundidad: number = PROFUNDIDAD_BARRENO_REPISA,
): Mecanizado {
  const barrenos: Barreno[] = [];
  const medio = Math.floor(porPosicion / 2);
  for (const posicion of posiciones) {
    for (let salto = -medio; salto <= medio; salto++) {
      const y = posicion + salto * paso;
      if (y <= 0) continue;
      barrenos.push({
        cara: "i",
        x: distanciaBorde,
        y,
        profundidad,
        diametro: DIAMETRO_BARRENO_REPISA,
        horizontal: false,
      });
    }
  }
  return new Mecanizado([], barrenos);
}

/** Falla temprano con un mensaje claro si una medida no es positiva. */
export function exigirPositivo(valores: Record<string, number>): void {
  for (const [nombre, valor] of Object.entries(valores)) {
    if (valor <= 0) {
      throw new ValueError(`${nombre} debe ser mayor que cero (recibido ${valor})`);
    }
  }
}
