/**
 * Perfiles de restricciones de máquina/proveedor.
 *
 * IMPORTANTE (regla del repo: nada inventado): los valores del perfil de
 * Cortecloud/Madijal provienen de observaciones de uso real del owner,
 * registradas en `docs/memoria/MEMORIA.md` y del pedido real en
 * `tests/fixtures/cortecloud/escritorio_D_simple.json`. NO se ha consultado
 * documentación pública del proveedor, por eso el perfil queda
 * `por revisar` y el motor lo reporta como hallazgo.
 *
 * Un perfil nunca se aplica por defecto: el llamador lo pasa en
 * `OptimizeRequest.profile` y solo se usa para validar (no cambia el acomodo).
 */

import { EPS, formatMm } from "./geometry.js";
import type {
  ConstraintProfile,
  Part,
  ProfileIssue,
  SheetInput,
} from "./types.js";
import type { CutList, Piece } from "./formats/model.js";

export const CORTECLOUD_MADIJAL_PROFILE: ConstraintProfile = {
  id: "cortecloud-madijal",
  name: "Cortecloud/Madijal (uso real observado)",
  reviewStatus: "por revisar",
  sources: [
    "docs/memoria/MEMORIA.md → «Perfil de restricciones de ejemplo: Cortecloud/Madijal»",
    "tests/fixtures/cortecloud/escritorio_D_simple.json → pedido real (30 piezas, 2 materiales, tablero 2500 × 1830 × 18 mm)",
  ],
  notes:
    "Restricciones observadas en pedidos reales: pieza mínima 65 mm de corte, pieza mecanizada ≥ 250 mm, pieza máxima 2480 × 1810 mm, tablero 2500 × 1830 × 18 mm, ranuras y diámetros de barrenos indicados abajo. No incluye kerf porque la memoria no lo documenta: el kerf lo envía el usuario. La regla de «pieza mecanizada ≥ 250 mm» no se valida automáticamente porque las piezas de entrada no declaran mecanizado.",
  minCutWidth: 65,
  minCutHeight: 65,
  minMachinedLength: 250,
  maxPartWidth: 2480,
  maxPartHeight: 1810,
  stock: [{ width: 2500, height: 1830, thickness: 18 }],
  // Ranuras permitidas (mm).
  grooves: [5.7, 6.2, 6.7, 7, 9.7, 12.7, 15.7, 18.7, 25.7],
  // Barrenos horizontales y verticales (Ø mm).
  drillDiameters: {
    horizontal: [3, 8],
    vertical: [3, 5, 8, 10, 15, 20, 35],
  },
};

/** Perfiles disponibles por id. */
export const PROFILES: Record<string, ConstraintProfile> = {
  [CORTECLOUD_MADIJAL_PROFILE.id]: CORTECLOUD_MADIJAL_PROFILE,
};

export interface SheetsFromProfileOptions {
  kerf?: number;
  qty?: number;
  material?: string;
}

/**
 * Tableros de stock del perfil como entrada del motor. El kerf no está en el
 * perfil (no documentado), así que se pide por parámetro; por defecto 0.
 */
export function sheetsFromProfile(
  profile: ConstraintProfile,
  options: SheetsFromProfileOptions = {},
): SheetInput[] {
  return profile.stock.map((sheet, index) => ({
    id: `${profile.id}-${index + 1}`,
    label: `${formatMm(sheet.width)} × ${formatMm(sheet.height)} × ${formatMm(sheet.thickness)} mm`,
    width: sheet.width,
    height: sheet.height,
    thickness: sheet.thickness,
    kerf: options.kerf ?? 0,
    qty: options.qty ?? 1,
    material: options.material,
  }));
}

/** Valida las piezas contra un perfil y devuelve los hallazgos. */
export function validateParts(
  parts: Part[],
  profile: ConstraintProfile,
): ProfileIssue[] {
  const issues: ProfileIssue[] = [];

  if (profile.reviewStatus === "por revisar") {
    issues.push({
      code: "perfil-por-revisar",
      severity: "por-revisar",
      message: `Perfil «${profile.name}» por revisar: valores tomados de ${profile.sources.join("; ")}. Verificar contra la documentación oficial del proveedor antes de usarlo como regla.`,
    });
  }

  for (const part of parts) {
    if (part.width < profile.minCutWidth || part.height < profile.minCutHeight) {
      issues.push({
        code: "pieza-bajo-minimo",
        severity: "error",
        partId: part.id,
        message: `${part.code}: ${formatMm(part.width)} × ${formatMm(part.height)} mm está por debajo del mínimo de corte ${formatMm(profile.minCutWidth)} × ${formatMm(profile.minCutHeight)} mm.`,
      });
    }
    // La pieza máxima es un límite de la máquina/hoja, no de orientación: la
    // pieza cabe girada. Se compara el lado mayor contra el límite mayor y el
    // menor contra el menor, igual que `cabe()` de los módulos paramétricos y
    // `validarConPerfil` de este archivo.
    const ladoMayor = Math.max(part.width, part.height);
    const ladoMenor = Math.min(part.width, part.height);
    const maxLadoMayor = Math.max(profile.maxPartWidth, profile.maxPartHeight);
    const maxLadoMenor = Math.min(profile.maxPartWidth, profile.maxPartHeight);
    if (ladoMayor > maxLadoMayor || ladoMenor > maxLadoMenor) {
      issues.push({
        code: "pieza-sobre-maximo",
        severity: "error",
        partId: part.id,
        message: `${part.code}: ${formatMm(part.width)} × ${formatMm(part.height)} mm supera la pieza máxima ${formatMm(profile.maxPartWidth)} × ${formatMm(profile.maxPartHeight)} mm.`,
      });
    }
    if (
      part.thickness !== undefined &&
      !profile.stock.some((sheet) => Math.abs(sheet.thickness - part.thickness!) <= EPS)
    ) {
      issues.push({
        code: "espesor-sin-stock",
        severity: "aviso",
        partId: part.id,
        message: `${part.code}: no hay tablero de ${formatMm(part.thickness)} mm en el perfil «${profile.name}».`,
      });
    }
  }

  return issues;
}

// ── Validación de CutList de formatos (rama formatos-import-export) ─────────

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
