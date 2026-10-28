/**
 * Perfiles de restricciones opcionales de máquina/proveedor.
 *
 * Un perfil es un conjunto de límites **de un proveedor o taller concreto**, no
 * una regla del motor. Se aplica solo si se pide: `validar(piezas, perfil)`.
 *
 * Perfil `cortecloud_madijal`: transcrito de `docs/memoria/MEMORIA.md`
 * («Perfil de restricciones de ejemplo (opcional): Cortecloud/Madijal»), que a
 * su vez describe restricciones observadas en uso real. Es el único perfil
 * cargado; los valores son del enunciado de la MEMORIA, no de un manual público,
 * así que cualquier ajuste posterior debe volver a esa ficha.
 *
 * Puente al motor: `toConstraintProfile()` expone el perfil con el tipo
 * `ConstraintProfile` del motor (`src/types.ts`), para validar piezas ya
 * normalizadas con `validateParts` del motor.
 */

import type { ConstraintProfile } from "../types.js";
import { igual } from "./parts.js";
import type { Pieza } from "./parts.js";

/** 3/8" = 9.525 mm: la MEMORIA enuncia los barrenos horizontales en pulgadas. */
export const PULGADA_3_8 = 9.525;

export interface PerfilInit {
  nombre: string;
  fuente: string;
  /** Pieza mínima medida de corte (mm), excluyendo el canto. */
  piezaMinCorte: number;
  /** Medida recomendada por sobre el mínimo (mm). */
  piezaMinRecomendada: number;
  /** Medida terminada mínima con canto en ambos lados (mm). */
  piezaMinTerminada: number;
  /** Espesor de referencia del canto usado en `piezaMinTerminada` (mm). */
  cantoEspesor: number;
  /** Largo mínimo de una pieza mecanizada (mm). */
  piezaMecanizadaMinLargo: number;
  piezaMaxLargo: number;
  piezaMaxAncho: number;
  tableroLargo: number;
  tableroAncho: number;
  tableroEspesor: number;
  /** Anchos de ranura (canal) que la máquina puede ejecutar (mm). */
  ranurasPermitidas: readonly number[];
  /** Diámetros de barreno en el canto (mm). */
  barrenosHorizontales: readonly number[];
  /** Diámetros de barreno en la cara (mm). */
  barrenosVerticales: readonly number[];
  /** Luz máxima entre apoyos de una repisa antes de avisar (mm); ``null`` = sin aviso. */
  luzMaxRepisaAviso?: number | null;
}

/** Límites de corte, mecanizado y tablero de un proveedor concreto. */
export class PerfilRestricciones {
  readonly nombre: string;
  readonly fuente: string;
  readonly piezaMinCorte: number;
  readonly piezaMinRecomendada: number;
  readonly piezaMinTerminada: number;
  readonly cantoEspesor: number;
  readonly piezaMecanizadaMinLargo: number;
  readonly piezaMaxLargo: number;
  readonly piezaMaxAncho: number;
  readonly tableroLargo: number;
  readonly tableroAncho: number;
  readonly tableroEspesor: number;
  readonly ranurasPermitidas: readonly number[];
  readonly barrenosHorizontales: readonly number[];
  readonly barrenosVerticales: readonly number[];
  readonly luzMaxRepisaAviso: number | null;

  constructor(init: PerfilInit) {
    this.nombre = init.nombre;
    this.fuente = init.fuente;
    this.piezaMinCorte = init.piezaMinCorte;
    this.piezaMinRecomendada = init.piezaMinRecomendada;
    this.piezaMinTerminada = init.piezaMinTerminada;
    this.cantoEspesor = init.cantoEspesor;
    this.piezaMecanizadaMinLargo = init.piezaMecanizadaMinLargo;
    this.piezaMaxLargo = init.piezaMaxLargo;
    this.piezaMaxAncho = init.piezaMaxAncho;
    this.tableroLargo = init.tableroLargo;
    this.tableroAncho = init.tableroAncho;
    this.tableroEspesor = init.tableroEspesor;
    this.ranurasPermitidas = init.ranurasPermitidas;
    this.barrenosHorizontales = init.barrenosHorizontales;
    this.barrenosVerticales = init.barrenosVerticales;
    this.luzMaxRepisaAviso = init.luzMaxRepisaAviso ?? null;
  }

  /** Copia con algunos campos cambiados (equivalente a `dataclasses.replace`). */
  con(cambios: Partial<PerfilInit>): PerfilRestricciones {
    return new PerfilRestricciones({ ...this, ...cambios });
  }

  /** Perfil como tipo `ConstraintProfile` del motor de optimización. */
  toConstraintProfile(): ConstraintProfile {
    return {
      id: this.nombre,
      name: this.nombre,
      reviewStatus: "por revisar",
      sources: [this.fuente],
      notes:
        "Restricciones observadas en uso real (ver docs/memoria/MEMORIA.md). " +
        "El canto y la luz de repisa no los valida el motor; los valida esta capa.",
      minCutWidth: this.piezaMinCorte,
      minCutHeight: this.piezaMinCorte,
      minMachinedLength: this.piezaMecanizadaMinLargo,
      maxPartWidth: this.piezaMaxLargo,
      maxPartHeight: this.piezaMaxAncho,
      stock: [
        {
          width: this.tableroLargo,
          height: this.tableroAncho,
          thickness: this.tableroEspesor,
        },
      ],
      grooves: [...this.ranurasPermitidas],
      drillDiameters: {
        horizontal: [...this.barrenosHorizontales],
        vertical: [...this.barrenosVerticales],
      },
    };
  }
}

export const PERFIL_CORTECLOUD_MADIJAL = new PerfilRestricciones({
  nombre: "cortecloud_madijal",
  fuente: "docs/memoria/MEMORIA.md (perfil de restricciones de ejemplo)",
  piezaMinCorte: 65.0,
  piezaMinRecomendada: 70.0,
  piezaMinTerminada: 66.0,
  cantoEspesor: 0.4,
  piezaMecanizadaMinLargo: 250.0,
  piezaMaxLargo: 2480.0,
  piezaMaxAncho: 1810.0,
  tableroLargo: 2500.0,
  tableroAncho: 1830.0,
  tableroEspesor: 18.0,
  ranurasPermitidas: [5.7, 6.2, 6.7, 7.0, 9.7, 12.7, 15.7, 18.7, 25.7],
  barrenosHorizontales: [PULGADA_3_8],
  barrenosVerticales: [3.0, 5.0, 8.0, 10.0, 15.0, 20.0, 35.0],
  luzMaxRepisaAviso: null,
});

export const PERFILES: Record<string, PerfilRestricciones> = {
  [PERFIL_CORTECLOUD_MADIJAL.nombre]: PERFIL_CORTECLOUD_MADIJAL,
};

export const NIVEL_ERROR = "error";
export const NIVEL_AVISO = "aviso";

/** Resultado de aplicar una regla del perfil a una pieza. */
export class Hallazgo {
  constructor(
    readonly pieza: string,
    readonly nivel: string,
    readonly regla: string,
    readonly mensaje: string,
  ) {}

  toDict(): Record<string, string> {
    return {
      pieza: this.pieza,
      nivel: this.nivel,
      regla: this.regla,
      mensaje: this.mensaje,
    };
  }
}

function error(pieza: Pieza, regla: string, mensaje: string): Hallazgo {
  return new Hallazgo(pieza.nombre, NIVEL_ERROR, regla, mensaje);
}

function aviso(pieza: Pieza, regla: string, mensaje: string): Hallazgo {
  return new Hallazgo(pieza.nombre, NIVEL_AVISO, regla, mensaje);
}

function cabe(largo: number, ancho: number, limiteLargo: number, limiteAncho: number): boolean {
  return (
    (largo <= limiteLargo && ancho <= limiteAncho) ||
    (ancho <= limiteLargo && largo <= limiteAncho)
  );
}

/** Aplica todas las reglas del perfil a una pieza. */
export function validarPieza(pieza: Pieza, perfil: PerfilRestricciones): Hallazgo[] {
  const hallazgos: Hallazgo[] = [];

  if (pieza.largo <= 0 || pieza.ancho <= 0) {
    hallazgos.push(
      error(pieza, "dimension_invalida", "largo y ancho deben ser mayores que cero"),
    );
    return hallazgos;
  }

  const corteMenor = Math.min(pieza.largo, pieza.ancho);
  if (corteMenor < perfil.piezaMinCorte) {
    hallazgos.push(
      error(
        pieza,
        "pieza_minima",
        `medida de corte ${corteMenor.toFixed(1)} mm bajo el mínimo ` +
          `${perfil.piezaMinCorte.toFixed(0)} mm del perfil ${perfil.nombre}`,
      ),
    );
  } else if (corteMenor < perfil.piezaMinRecomendada) {
    hallazgos.push(
      aviso(
        pieza,
        "pieza_minima_recomendada",
        `medida de corte ${corteMenor.toFixed(1)} mm sobre el mínimo pero bajo el ` +
          `recomendado ${perfil.piezaMinRecomendada.toFixed(0)} mm`,
      ),
    );
  }

  // La medida terminada mínima solo tiene sentido en piezas con canto.
  const { largo: largoTerminado, ancho: anchoTerminado } = pieza.medidasTerminadas();
  const terminadaMenor = Math.min(largoTerminado, anchoTerminado);
  if (!pieza.cantos.vacio() && terminadaMenor < perfil.piezaMinTerminada) {
    hallazgos.push(
      aviso(
        pieza,
        "pieza_terminada_ajustada",
        `medida terminada ${terminadaMenor.toFixed(1)} mm (canto ` +
          `${pieza.cantoEspesor} mm) bajo la terminada mínima ` +
          `${perfil.piezaMinTerminada.toFixed(0)} mm`,
      ),
    );
  }

  if (!cabe(pieza.largo, pieza.ancho, perfil.piezaMaxLargo, perfil.piezaMaxAncho)) {
    hallazgos.push(
      error(
        pieza,
        "pieza_maxima",
        `${pieza.largo.toFixed(1)} x ${pieza.ancho.toFixed(1)} mm excede la pieza máxima ` +
          `${perfil.piezaMaxLargo.toFixed(0)} x ${perfil.piezaMaxAncho.toFixed(0)} mm`,
      ),
    );
  } else if (!cabe(pieza.largo, pieza.ancho, perfil.tableroLargo, perfil.tableroAncho)) {
    hallazgos.push(
      aviso(
        pieza,
        "no_cabe_en_tablero",
        `${pieza.largo.toFixed(1)} x ${pieza.ancho.toFixed(1)} mm no cabe en el tablero ` +
          `${perfil.tableroLargo.toFixed(0)} x ${perfil.tableroAncho.toFixed(0)} mm`,
      ),
    );
  }

  if (!pieza.mecanizado.vacio()) {
    if (pieza.largo < perfil.piezaMecanizadaMinLargo) {
      hallazgos.push(
        error(
          pieza,
          "pieza_mecanizada_corta",
          `pieza mecanizada de largo ${pieza.largo.toFixed(1)} mm bajo el mínimo ` +
            `${perfil.piezaMecanizadaMinLargo.toFixed(0)} mm`,
        ),
      );
    }
    for (const ranura of pieza.mecanizado.ranuras) {
      if (!perfil.ranurasPermitidas.some((r) => igual(r, ranura.ancho))) {
        hallazgos.push(
          error(
            pieza,
            "ranura_no_permitida",
            `ranura de ${ranura.ancho} mm fuera de las permitidas ` +
              `[${perfil.ranurasPermitidas.join(", ")}]`,
          ),
        );
      }
    }
    for (const barreno of pieza.mecanizado.barrenos) {
      const permitidos = barreno.horizontal
        ? perfil.barrenosHorizontales
        : perfil.barrenosVerticales;
      if (!permitidos.some((d) => igual(d, barreno.diametro))) {
        const tipo = barreno.horizontal ? "horizontal" : "vertical";
        hallazgos.push(
          error(
            pieza,
            "barreno_no_permitido",
            `barreno ${tipo} de Ø${barreno.diametro} mm fuera de los permitidos ` +
              `[${permitidos.join(", ")}]`,
          ),
        );
      }
    }
  }

  if (perfil.luzMaxRepisaAviso !== null && pieza.rol === "repisa") {
    if (pieza.ancho > perfil.luzMaxRepisaAviso) {
      hallazgos.push(
        aviso(
          pieza,
          "luz_repisa",
          `repisa de ${pieza.ancho.toFixed(1)} mm de luz supera el aviso de ` +
            `${perfil.luzMaxRepisaAviso.toFixed(0)} mm`,
        ),
      );
    }
  }

  return hallazgos;
}

/** Aplica el perfil a una lista de piezas (una línea por hallazgo). */
export function validar(
  piezas: Iterable<Pieza>,
  perfil: PerfilRestricciones = PERFIL_CORTECLOUD_MADIJAL,
): Hallazgo[] {
  const hallazgos: Hallazgo[] = [];
  for (const pieza of piezas) {
    hallazgos.push(...validarPieza(pieza, perfil));
  }
  return hallazgos;
}

export function errores(hallazgos: Iterable<Hallazgo>): Hallazgo[] {
  return [...hallazgos].filter((h) => h.nivel === NIVEL_ERROR);
}

export function avisos(hallazgos: Iterable<Hallazgo>): Hallazgo[] {
  return [...hallazgos].filter((h) => h.nivel === NIVEL_AVISO);
}

export interface ResumenHallazgos {
  errores: number;
  avisos: number;
  detalle: Record<string, string>[];
}

export function resumenHallazgos(hallazgos: Iterable<Hallazgo>): ResumenHallazgos {
  const lista = [...hallazgos];
  return {
    errores: errores(lista).length,
    avisos: avisos(lista).length,
    detalle: lista.map((h) => h.toDict()),
  };
}
