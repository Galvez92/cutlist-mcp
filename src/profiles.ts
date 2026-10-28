/**
 * Perfiles de restricciones de máquina/proveedor.
 *
 * Los datos de un perfil NO son reglas por defecto del motor: se aplican solo
 * cuando el usuario los pasa en `OptimizeRequest.profile`. Un perfil se marca
 * `por revisar` mientras sus valores no estén verificados contra una fuente
 * pública.
 *
 * `validarConPerfil` comprueba las piezas de una `CutList` contra un perfil y
 * devuelve `ProfileIssue[]` (no lanza). Así se puede usar tras importar (p.ej.
 * Cortecloud) y antes de exportar.
 */

import type { ConstraintProfile, ProfileIssue } from "./types.js";
import type { CutList } from "./formats/model.js";
import type { Piece } from "./formats/model.js";

/**
 * Perfil Cortecloud / Madijal.
 *
 * Restricciones observadas en uso real (sin fuente pública documentada): se
 * marca `por revisar`. Valores confirmados contra el fixture real
 * `tests/fixtures/cortecloud/escritorio_D_simple.json`, donde el canto aparece
 * como «PVC … 0.4 x 22 mm REHAU ®».
 *
 * - Hoja (pieza) máxima: 2480 × 1810 mm.
 * - Mínimo de corte: 65 mm.
 * - Mínimo con canto: 70 mm (recomendado; con 0.4 mm de canto en ambos lados la
 *   terminada queda en ~69 mm).
 * - Canto PVC 0.4 mm de espesor × 22 mm de ancho.
 * - Pieza mecanizada: largo ≥ 250 mm.
 * - Tablero 2500 × 1830 × 18 mm.
 * - Ranuras: 5.7 / 6.2 / 6.7 / 7 / 9.7 / 12.7 / 15.7 / 18.7 / 25.7 mm.
 * - Barrenos horizontales Ø 3 / 8; verticales Ø 3 / 5 / 8 / 10 / 15 / 20 / 35.
 */
export const CORTECLOUD_MADIJAL: ConstraintProfile = {
  id: "CORTECLOUD_MADIJAL",
  name: "Cortecloud / Madijal",
  reviewStatus: "por revisar",
  sources: [
    "tests/fixtures/cortecloud/escritorio_D_simple.json " +
      "(canto «0.4 x 22 mm» confirmado en piezas reales)",
  ],
  notes:
    "Restricciones observadas en uso real (sin fuente pública). " +
    "Canto PVC 0.4 mm espesor × 22 mm ancho. " +
    "Pieza con canto: mínimo recomendado 70 mm.",
  minCutWidth: 65,
  minCutHeight: 65,
  minWithEdge: 70,
  minMachinedLength: 250,
  maxPartWidth: 2480,
  maxPartHeight: 1810,
  stock: [{ width: 2500, height: 1830, thickness: 18 }],
  grooves: [5.7, 6.2, 6.7, 7, 9.7, 12.7, 15.7, 18.7, 25.7],
  drillDiameters: { horizontal: [3, 8], vertical: [3, 5, 8, 10, 15, 20, 35] },
};

export const PERFILES: Record<string, ConstraintProfile> = {
  [CORTECLOUD_MADIJAL.id]: CORTECLOUD_MADIJAL,
};

export function perfil(id: string): ConstraintProfile {
  const p = PERFILES[id];
  if (!p) {
    throw new Error(
      `perfil desconocido: ${JSON.stringify(id)}. Disponibles: ${Object.keys(PERFILES)}`,
    );
  }
  return p;
}

function tieneCantos(pieza: Piece): boolean {
  return Object.keys(pieza.cantos).length > 0;
}

function tieneMecanizado(pieza: Piece): boolean {
  return pieza.extra.machining !== undefined && pieza.extra.machining !== null;
}

/**
 * Valida las piezas de una `CutList` contra un perfil de restricciones.
 * Devuelve issues sin lanzar; el llamador decide qué hacer con ellos.
 */
export function validarConPerfil(
  lista: CutList,
  perfil: ConstraintProfile,
): ProfileIssue[] {
  const issues: ProfileIssue[] = [];

  for (const pieza of lista.piezas) {
    const conCanto = tieneCantos(pieza);

    // — Mínimo de corte (65 mm) — error si no se cumple.
    if (pieza.largo < perfil.minCutWidth || pieza.ancho < perfil.minCutHeight) {
      issues.push({
        code: "min-corte",
        severity: "error",
        message:
          `${pieza.nombre}: ${pieza.largo}×${pieza.ancho} mm ` +
          `menor al mínimo de corte ` +
          `(${perfil.minCutWidth}×${perfil.minCutHeight} mm)`,
      });
    }

    // — Mínimo con canto (70 mm) — aviso (recomendado, no obligatorio).
    if (conCanto && perfil.minWithEdge) {
      if (pieza.largo < perfil.minWithEdge || pieza.ancho < perfil.minWithEdge) {
        issues.push({
          code: "min-con-canto",
          severity: "aviso",
          message:
            `${pieza.nombre}: ${pieza.largo}×${pieza.ancho} mm con canto ` +
            `menor al mínimo recomendado (${perfil.minWithEdge} mm)`,
        });
      }
    }

    // — Pieza máxima — error si excede la hoja.
    const pMax = Math.max(pieza.largo, pieza.ancho);
    const pMin = Math.min(pieza.largo, pieza.ancho);
    const maxW = Math.max(perfil.maxPartWidth, perfil.maxPartHeight);
    const maxH = Math.min(perfil.maxPartWidth, perfil.maxPartHeight);
    if (pMax > maxW || pMin > maxH) {
      issues.push({
        code: "max-pieza",
        severity: "error",
        message:
          `${pieza.nombre}: ${pieza.largo}×${pieza.ancho} mm ` +
          `excede el máximo de pieza ` +
          `(${perfil.maxPartWidth}×${perfil.maxPartHeight} mm)`,
      });
    }

    // — Largo mínimo de pieza mecanizada — aviso.
    if (perfil.minMachinedLength && tieneMecanizado(pieza)) {
      if (Math.max(pieza.largo, pieza.ancho) < perfil.minMachinedLength) {
        issues.push({
          code: "min-mecanizado",
          severity: "aviso",
          message:
            `${pieza.nombre}: pieza mecanizada con lado ` +
            `${Math.max(pieza.largo, pieza.ancho)} mm ` +
            `menor al mínimo de mecanizado (${perfil.minMachinedLength} mm)`,
        });
      }
    }
  }

  return issues;
}
