/**
 * Llenado de hojas: reparte las piezas de un trabajo entre las hojas de stock.
 *
 * Un trabajo agrupa las piezas del mismo material y espesor; solo compite por
 * los tableros compatibles. La pieza se coloca primero en el mejor hueco de
 * las hojas ya abiertas (para no abrir hojas de más) y, si no cabe, se abre
 * una hoja nueva.
 */

import { EPS, formatMm, grainInSheet, isCompatibleGrain, round2 } from "../geometry.js";
import type {
  Part,
  Placement,
  SheetLayout,
  SheetStock,
  UnplacedPart,
  UnplacedReason,
} from "../types.js";
import type {
  Fit,
  PackContext,
  PackItem,
  SheetAlgorithm,
} from "./algorithm.js";
import { isBetterFit } from "./algorithm.js";
import type { Ordering } from "./order.js";
import { sortItems } from "./order.js";
import type { Rect } from "./rect.js";
import { insetRect } from "./rect.js";

/** Instancia concreta de una pieza dentro de un trabajo. */
export interface JobItem extends PackItem {
  part: Part;
  /** Nº de instancia de esa pieza (1..qty). */
  instance: number;
  /** Total de instancias de esa pieza (para `1/3`). */
  totalInstances: number;
}

export interface Job {
  key: string;
  material?: string;
  thickness?: number;
  items: JobItem[];
  candidates: SheetStock[];
}

export interface PackJobOptions {
  allowRotation: boolean;
}

export interface PackJobResult {
  sheets: SheetLayout[];
  unplaced: UnplacedPart[];
}

interface Bin {
  stock: SheetStock;
  ctx: PackContext;
  freeRects: Rect[];
  placements: Placement[];
  /** Nº de unidad de ese tablero de stock (1 = primera). */
  instance: number;
}

function normalizeText(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

/** ¿El material de la pieza admite este tablero? Sin material = genérico. */
export function materialMatches(
  partMaterial: string | undefined,
  sheetMaterial: string | undefined,
): boolean {
  if (!partMaterial || !sheetMaterial) return true;
  return normalizeText(partMaterial) === normalizeText(sheetMaterial);
}

/** ¿El espesor pedido coincide con el del tablero? Sin espesor = cualquiera. */
export function thicknessMatches(
  partThickness: number | undefined,
  sheetThickness: number,
): boolean {
  if (partThickness === undefined) return true;
  return Math.abs(partThickness - sheetThickness) <= EPS;
}

/**
 * Agrupa las piezas por material y espesor, y calcula para cada trabajo los
 * tableros compatibles. Los tableros sin material sirven para cualquier pieza.
 */
export function buildJobs(parts: Part[], sheets: SheetStock[]): Job[] {
  const jobs = new Map<string, Job>();

  for (const part of parts) {
    const key = `${normalizeText(part.material ?? "")}|${part.thickness ?? "*"}`;
    let job = jobs.get(key);
    if (!job) {
      job = {
        key,
        material: part.material,
        thickness: part.thickness,
        items: [],
        candidates: sheets.filter(
          (sheet) =>
            materialMatches(part.material, sheet.material) &&
            thicknessMatches(part.thickness, sheet.thickness),
        ),
      };
      jobs.set(key, job);
    }
    for (let instance = 1; instance <= part.qty; instance += 1) {
      job.items.push({
        key: `${part.id}#${instance}`,
        w: part.width,
        h: part.height,
        grain: part.grain,
        part,
        instance,
        totalInstances: part.qty,
      });
    }
  }

  return [...jobs.values()];
}

/** Reparte las piezas de un trabajo. `startIndex` es el nº de la primera hoja. */
export function packJob(
  job: Job,
  algorithm: SheetAlgorithm,
  ordering: Ordering,
  options: PackJobOptions,
  startIndex: number,
): PackJobResult {
  const remaining = new Map<string, number>();
  for (const stock of job.candidates) remaining.set(stock.id, stock.qty);

  const bins: Bin[] = [];
  const opened = new Map<string, number>();
  const unplaced: UnplacedPart[] = [];

  const contextFor = (stock: SheetStock): PackContext => ({
    kerf: stock.kerf,
    allowRotation: options.allowRotation,
    sheetGrain: stock.grain,
    usable: insetRect({ x: 0, y: 0, w: stock.width, h: stock.height }, stock.trim),
  });

  const freshPlacement = (
    stock: SheetStock,
    item: JobItem,
  ): { ctx: PackContext; freeRects: Rect[]; fit: Fit } | null => {
    const ctx = contextFor(stock);
    const freeRects = algorithm.initFreeRects(ctx.usable, ctx);
    const fit = algorithm.findPlacement(freeRects, item, ctx);
    return fit ? { ctx, freeRects, fit } : null;
  };

  const reasonFor = (item: JobItem): { reason: UnplacedReason; detail: string } => {
    const compatible = job.candidates.filter((stock) =>
      isCompatibleGrain(item.grain, stock.grain),
    );
    if (compatible.length === 0) {
      return {
        reason: "sin-tablero-compatible",
        detail: `No hay tablero compatible (material, espesor o veta) para una pieza de ${formatMm(item.w)} × ${formatMm(item.h)} mm.`,
      };
    }
    const fitsFresh = compatible.some((stock) => freshPlacement(stock, item) !== null);
    if (!fitsFresh) {
      const maxW = Math.max(...compatible.map((stock) => stock.width));
      const maxH = Math.max(...compatible.map((stock) => stock.height));
      return {
        reason: "no-cabe-en-tablero",
        detail: `La pieza de ${formatMm(item.w)} × ${formatMm(item.h)} mm no cabe en ningún tablero compatible (máximo ${formatMm(maxW)} × ${formatMm(maxH)} mm).`,
      };
    }
    return {
      reason: "stock-insuficiente",
      detail: `Se agotó el stock de tableros compatibles para la pieza de ${formatMm(item.w)} × ${formatMm(item.h)} mm.`,
    };
  };

  for (const item of sortItems(job.items, ordering)) {
    let chosenBin: Bin | null = null;
    let chosenFit: Fit | null = null;

    for (const bin of bins) {
      if (!isCompatibleGrain(item.grain, bin.stock.grain)) continue;
      const fit = algorithm.findPlacement(bin.freeRects, item, bin.ctx);
      if (fit && isBetterFit(fit, chosenFit)) {
        chosenBin = bin;
        chosenFit = fit;
      }
    }

    if (!chosenFit) {
      for (const stock of job.candidates) {
        if (!isCompatibleGrain(item.grain, stock.grain)) continue;
        if ((remaining.get(stock.id) ?? 0) <= 0) continue;
        const fresh = freshPlacement(stock, item);
        if (!fresh) continue;
        const instance = (opened.get(stock.id) ?? 0) + 1;
        opened.set(stock.id, instance);
        remaining.set(stock.id, (remaining.get(stock.id) ?? 0) - 1);
        const bin: Bin = {
          stock,
          ctx: fresh.ctx,
          freeRects: fresh.freeRects,
          placements: [],
          instance,
        };
        bins.push(bin);
        chosenBin = bin;
        chosenFit = fresh.fit;
        break;
      }
    }

    if (!chosenBin || !chosenFit) {
      const { reason, detail } = reasonFor(item);
      unplaced.push({
        partId: item.part.id,
        code: item.part.code,
        label: item.part.label,
        quantity: 1,
        reason,
        detail,
      });
      continue;
    }

    const rect = chosenBin.freeRects[chosenFit.rectIndex];
    if (!rect) continue;
    const width = chosenFit.rotated ? item.h : item.w;
    const height = chosenFit.rotated ? item.w : item.h;
    chosenBin.placements.push({
      partId: item.part.id,
      code: item.part.code,
      label: item.part.label,
      x: rect.x,
      y: rect.y,
      width,
      height,
      rotated: chosenFit.rotated,
      grain: item.part.grain,
      grainInSheet: grainInSheet(item.part.grain, chosenFit.rotated),
      edges: item.part.edges,
      material: item.part.material,
      thickness: item.part.thickness,
    });
    algorithm.commit(chosenBin.freeRects, chosenFit, item, chosenBin.ctx);
  }

  const sheets: SheetLayout[] = bins.map((bin, index) => {
    const usedArea = bin.placements.reduce(
      (sum, placement) => sum + placement.width * placement.height,
      0,
    );
    const sheetArea = bin.stock.width * bin.stock.height;
    return {
      sheetId: bin.stock.id,
      instance: bin.instance,
      index: startIndex + index,
      label: bin.stock.label,
      width: bin.stock.width,
      height: bin.stock.height,
      thickness: bin.stock.thickness,
      material: bin.stock.material,
      grain: bin.stock.grain,
      kerf: bin.stock.kerf,
      trim: bin.stock.trim,
      placements: bin.placements,
      usedArea: round2(usedArea),
      sheetArea: round2(sheetArea),
      wasteArea: round2(sheetArea - usedArea),
      yieldPct: sheetArea > 0 ? round2((usedArea / sheetArea) * 100) : 0,
    };
  });

  return { sheets, unplaced };
}
