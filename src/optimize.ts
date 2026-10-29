/**
 * Punto de entrada del motor: piezas + tableros → layout optimizado,
 * aprovechamiento, lista de corte y etiquetas.
 *
 * Con `algorithm: "auto"` (por defecto) se prueban los dos algoritmos de
 * acomodo con cuatro órdenes de piezas y se devuelve el mejor resultado. El
 * criterio, en este orden: menos piezas sin colocar, menos hojas usadas y
 * menos desperdicio.
 */

import { buildCutList } from "./cutlist.js";
import { OptimizeError } from "./errors.js";
import { round2 } from "./geometry.js";
import { buildLabels } from "./labels.js";
import type { SheetAlgorithm } from "./optimizer/algorithm.js";
import { guillotineAlgorithm } from "./optimizer/guillotine.js";
import { maxRectsAlgorithm } from "./optimizer/maxrects.js";
import { normalizeParts, normalizeSheets } from "./optimizer/normalize.js";
import type { Ordering } from "./optimizer/order.js";
import { ORDERINGS } from "./optimizer/order.js";
import { buildJobs, packJob } from "./optimizer/pack.js";
import { validateParts } from "./profiles.js";
import type {
  AlgorithmKind,
  LayoutMetrics,
  LayoutResult,
  OptimizeRequest,
  PackingAttempt,
  SheetLayout,
  UnplacedPart,
} from "./types.js";

const ALGORITHMS: Record<AlgorithmKind, SheetAlgorithm> = {
  guillotine: guillotineAlgorithm,
  maxrects: maxRectsAlgorithm,
};

interface Candidate {
  algorithm: SheetAlgorithm;
  ordering: Ordering;
  sheets: SheetLayout[];
  unplaced: UnplacedPart[];
  attempt: PackingAttempt;
}

/**
 * Compara dos intentos: primero las piezas sin colocar, luego las hojas usadas
 * y por último el desperdicio.
 */
export function compareAttempts(a: PackingAttempt, b: PackingAttempt): number {
  if (a.unplacedQuantity !== b.unplacedQuantity) {
    return a.unplacedQuantity - b.unplacedQuantity;
  }
  if (a.sheetsUsed !== b.sheetsUsed) return a.sheetsUsed - b.sheetsUsed;
  const wasteA = a.sheetArea - a.usedArea;
  const wasteB = b.sheetArea - b.usedArea;
  return wasteA - wasteB;
}

function aggregateUnplaced(entries: UnplacedPart[]): UnplacedPart[] {
  const grouped = new Map<string, UnplacedPart>();
  for (const entry of entries) {
    const key = `${entry.partId}|${entry.reason}`;
    const current = grouped.get(key);
    if (current) {
      current.quantity += entry.quantity;
      continue;
    }
    grouped.set(key, { ...entry });
  }
  return [...grouped.values()];
}

function buildMetrics(
  parts: { qty: number }[],
  sheets: SheetLayout[],
  unplaced: UnplacedPart[],
): LayoutMetrics {
  const sheetArea = round2(sheets.reduce((sum, sheet) => sum + sheet.sheetArea, 0));
  const usedArea = round2(sheets.reduce((sum, sheet) => sum + sheet.usedArea, 0));
  const placed = sheets.reduce((sum, sheet) => sum + sheet.placements.length, 0);
  return {
    distinctParts: parts.length,
    partInstances: parts.reduce((sum, part) => sum + part.qty, 0),
    placed,
    unplaced: unplaced.reduce((sum, entry) => sum + entry.quantity, 0),
    sheetsUsed: sheets.length,
    sheetArea,
    usedArea,
    wasteArea: round2(sheetArea - usedArea),
    yieldPct: sheetArea > 0 ? round2((usedArea / sheetArea) * 100) : 0,
  };
}

export function optimize(request: OptimizeRequest): LayoutResult {
  const parts = normalizeParts(request.parts);
  const sheets = normalizeSheets(request.sheets, {
    kerf: request.kerf ?? 0,
    trim: request.trim ?? 0,
  });
  const allowRotation = request.allowRotation ?? true;
  const option = request.algorithm ?? "auto";

  const algorithms =
    option === "auto"
      ? [guillotineAlgorithm, maxRectsAlgorithm]
      : [ALGORITHMS[option]];

  if (!algorithms[0]) {
    throw new OptimizeError(
      "algoritmo-desconocido",
      `Algoritmo desconocido: "${option}" (use guillotine, maxrects o auto).`,
    );
  }

  const jobs = buildJobs(parts, sheets);
  const attempts: PackingAttempt[] = [];
  let best: Candidate | null = null;

  for (const algorithm of algorithms) {
    for (const ordering of ORDERINGS) {
      const layoutSheets: SheetLayout[] = [];
      const unplaced: UnplacedPart[] = [];
      let sheetIndex = 0;

      for (const job of jobs) {
        const packed = packJob(
          job,
          algorithm,
          ordering,
          { allowRotation },
          sheetIndex + 1,
        );
        sheetIndex += packed.sheets.length;
        layoutSheets.push(...packed.sheets);
        unplaced.push(...packed.unplaced);
      }

      const sheetArea = round2(
        layoutSheets.reduce((sum, sheet) => sum + sheet.sheetArea, 0),
      );
      const usedArea = round2(
        layoutSheets.reduce((sum, sheet) => sum + sheet.usedArea, 0),
      );
      const attempt: PackingAttempt = {
        algorithm: algorithm.kind,
        ordering: ordering.name,
        sheetsUsed: layoutSheets.length,
        sheetArea,
        usedArea,
        yieldPct: sheetArea > 0 ? round2((usedArea / sheetArea) * 100) : 0,
        unplacedQuantity: unplaced.length,
      };
      attempts.push(attempt);

      const candidate: Candidate = {
        algorithm,
        ordering,
        sheets: layoutSheets,
        unplaced,
        attempt,
      };
      if (!best || compareAttempts(candidate.attempt, best.attempt) < 0) {
        best = candidate;
      }
    }
  }

  if (!best) {
    throw new OptimizeError(
      "sin-resultado",
      "No se pudo calcular ningún acomodo con la entrada recibida.",
    );
  }

  const unplaced = aggregateUnplaced(best.unplaced);
  const result: LayoutResult = {
    algorithm: best.algorithm.kind,
    ordering: best.ordering.name,
    attempts: [...attempts].sort(compareAttempts),
    sheets: best.sheets,
    unplaced,
    cutList: buildCutList(parts, best.sheets),
    labels: [],
    metrics: buildMetrics(parts, best.sheets, unplaced),
    issues: request.profile ? validateParts(parts, request.profile) : [],
  };
  result.labels = buildLabels(result);
  return result;
}
