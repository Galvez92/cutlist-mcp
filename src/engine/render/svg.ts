/**
 * Salida SVG: hoja con piezas, cantos, veta, medidas y etiquetas.
 *
 * Un SVG por hoja (`renderSheetSvg`) o todas las hojas apiladas en un solo
 * documento (`renderLayoutSvg`).
 */

import { EDGE_SIDES, formatMm, formatPct, sheetSideOfPartEdge } from "../geometry.js";
import { labelForPlacement } from "../labels.js";
import type { EdgeSide, LayoutResult, SheetLayout } from "../types.js";
import {
  EDGE_COLOR,
  GRAIN_COLOR,
  MUTED_COLOR,
  PIECE_STROKE,
  SHEET_FILL,
  SHEET_STROKE,
  TEXT_COLOR,
  pieceFill,
  rgbToCss,
} from "./palette.js";

export interface SvgRenderOptions {
  /** Ancho en px del tablero más ancho. Por defecto 900. */
  widthPx?: number;
  paddingPx?: number;
  showLabels?: boolean;
  showEdges?: boolean;
  showGrain?: boolean;
}

const DEFAULT_WIDTH_PX = 900;
const DEFAULT_PADDING_PX = 16;
const HEADER_PX = 26;
const GAP_PX = 18;
const FONT = "Helvetica, Arial, sans-serif";

interface GroupContext {
  scale: number;
  showLabels: boolean;
  showEdges: boolean;
  showGrain: boolean;
  nextId: () => string;
}

function round(value: number): string {
  return `${Math.round(value * 100) / 100}`;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function resolveOptions(options: SvgRenderOptions): {
  widthPx: number;
  paddingPx: number;
  showLabels: boolean;
  showEdges: boolean;
  showGrain: boolean;
} {
  return {
    widthPx: options.widthPx ?? DEFAULT_WIDTH_PX,
    paddingPx: options.paddingPx ?? DEFAULT_PADDING_PX,
    showLabels: options.showLabels ?? true,
    showEdges: options.showEdges ?? true,
    showGrain: options.showGrain ?? true,
  };
}

/** Coordenadas de la línea de canto dentro de la pieza, con margen interno. */
function edgeLine(
  x: number,
  y: number,
  w: number,
  h: number,
  side: EdgeSide,
  inset: number,
): { x1: number; y1: number; x2: number; y2: number } {
  switch (side) {
    case "top":
      return { x1: x + inset, y1: y + inset, x2: x + w - inset, y2: y + inset };
    case "bottom":
      return { x1: x + inset, y1: y + h - inset, x2: x + w - inset, y2: y + h - inset };
    case "left":
      return { x1: x + inset, y1: y + inset, x2: x + inset, y2: y + h - inset };
    case "right":
      return { x1: x + w - inset, y1: y + inset, x2: x + w - inset, y2: y + h - inset };
  }
}

function grainArrow(
  x: number,
  y: number,
  w: number,
  h: number,
  direction: "horizontal" | "vertical",
): string {
  const stroke = rgbToCss(GRAIN_COLOR);
  const centerX = x + w / 2;
  const centerY = y + h / 2;

  if (direction === "horizontal") {
    const half = Math.min(w / 2 - 6, 30);
    if (half < 6) return "";
    const x1 = centerX - half;
    const x2 = centerX + half;
    return `<line x1="${round(x1)}" y1="${round(centerY)}" x2="${round(x2)}" y2="${round(centerY)}" stroke="${stroke}" stroke-width="1.2"/><polygon points="${round(x2)},${round(centerY)} ${round(x2 - 6)},${round(centerY - 4)} ${round(x2 - 6)},${round(centerY + 4)}" fill="${stroke}"/>`;
  }

  const half = Math.min(h / 2 - 6, 30);
  if (half < 6) return "";
  const y1 = centerY - half;
  const y2 = centerY + half;
  return `<line x1="${round(centerX)}" y1="${round(y1)}" x2="${round(centerX)}" y2="${round(y2)}" stroke="${stroke}" stroke-width="1.2"/><polygon points="${round(centerX)},${round(y2)} ${round(centerX - 4)},${round(y2 - 6)} ${round(centerX + 4)},${round(y2 - 6)}" fill="${stroke}"/>`;
}

function sheetGroup(sheet: SheetLayout, ctx: GroupContext): string {
  const { scale } = ctx;
  const out: string[] = ["<g>"];

  out.push(
    `<rect x="0" y="0" width="${round(sheet.width * scale)}" height="${round(sheet.height * scale)}" fill="${rgbToCss(SHEET_FILL)}" stroke="${rgbToCss(SHEET_STROKE)}" stroke-width="1"/>`,
  );

  if (sheet.trim > 0) {
    out.push(
      `<rect x="${round(sheet.trim * scale)}" y="${round(sheet.trim * scale)}" width="${round((sheet.width - sheet.trim * 2) * scale)}" height="${round((sheet.height - sheet.trim * 2) * scale)}" fill="none" stroke="${rgbToCss(MUTED_COLOR)}" stroke-width="1" stroke-dasharray="4 4"/>`,
    );
  }

  for (const placement of sheet.placements) {
    const px = placement.x * scale;
    const py = placement.y * scale;
    const pw = placement.width * scale;
    const ph = placement.height * scale;
    const fill = pieceFill(placement.partId);

    out.push(
      `<rect x="${round(px)}" y="${round(py)}" width="${round(pw)}" height="${round(ph)}" fill="${fill.css}" stroke="${rgbToCss(PIECE_STROKE)}" stroke-width="1"/>`,
    );

    if (ctx.showEdges) {
      for (const side of EDGE_SIDES) {
        if (placement.edges[side] <= 0) continue;
        const line = edgeLine(
          px,
          py,
          pw,
          ph,
          sheetSideOfPartEdge(side, placement.rotated),
          2,
        );
        out.push(
          `<line x1="${round(line.x1)}" y1="${round(line.y1)}" x2="${round(line.x2)}" y2="${round(line.y2)}" stroke="${rgbToCss(EDGE_COLOR)}" stroke-width="3" stroke-linecap="round"/>`,
        );
      }
    }

    if (ctx.showGrain && placement.grainInSheet !== "none") {
      out.push(grainArrow(px, py, pw, ph, placement.grainInSheet));
    }

    if (ctx.showLabels && pw > 34 && ph > 16) {
      const clipId = ctx.nextId();
      out.push(
        `<clipPath id="${clipId}"><rect x="${round(px)}" y="${round(py)}" width="${round(pw)}" height="${round(ph)}"/></clipPath>`,
      );
      const lines = labelForPlacement(placement, sheet).lines.slice(0, 4);
      const text: string[] = [`<g clip-path="url(#${clipId})">`];
      let lineY = py + 13;
      for (const [index, line] of lines.entries()) {
        if (lineY > py + ph - 3) break;
        const bold = index === 0 ? ' font-weight="700"' : "";
        const size = index === 0 ? 11 : 9;
        text.push(
          `<text x="${round(px + 4)}" y="${round(lineY)}" font-family="${FONT}" font-size="${size}"${bold} fill="${rgbToCss(TEXT_COLOR)}">${escapeXml(line)}</text>`,
        );
        lineY += 12;
      }
      text.push("</g>");
      out.push(text.join(""));
    }
  }

  out.push("</g>");
  return out.join("\n");
}

function sheetHeader(sheet: SheetLayout): string {
  const material = sheet.material ? ` · ${sheet.material}` : "";
  return `Hoja ${sheet.index} · ${formatMm(sheet.width)} × ${formatMm(sheet.height)} × ${formatMm(sheet.thickness)} mm${material} · aprovechamiento ${formatPct(sheet.yieldPct)} · ${sheet.placements.length} piezas`;
}

/** SVG de una hoja, listo para insertar en una página o guardar como .svg. */
export function renderSheetSvg(
  sheet: SheetLayout,
  options: SvgRenderOptions = {},
): string {
  const { widthPx, paddingPx, showLabels, showEdges, showGrain } =
    resolveOptions(options);
  const scale = widthPx / Math.max(sheet.width, 1);
  const boardHeight = sheet.height * scale;
  const totalWidth = widthPx + paddingPx * 2;
  const totalHeight = paddingPx * 2 + HEADER_PX + boardHeight;
  const header = sheetHeader(sheet);
  let counter = 0;
  const ctx: GroupContext = {
    scale,
    showLabels,
    showEdges,
    showGrain,
    nextId: () => `clip-${sheet.index}-${(counter += 1)}`,
  };

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${round(totalWidth)}" height="${round(totalHeight)}" viewBox="0 0 ${round(totalWidth)} ${round(totalHeight)}" font-family="${FONT}" role="img" aria-label="${escapeXml(header)}">`,
    `<rect x="0" y="0" width="${round(totalWidth)}" height="${round(totalHeight)}" fill="#ffffff"/>`,
    `<text x="${round(paddingPx)}" y="${round(paddingPx + 16)}" font-size="13" font-weight="700" fill="${rgbToCss(TEXT_COLOR)}">${escapeXml(header)}</text>`,
    `<g transform="translate(${round(paddingPx)},${round(paddingPx + HEADER_PX)})">`,
    sheetGroup(sheet, ctx),
    "</g>",
    "</svg>",
  ].join("\n");
}

/** SVG con todas las hojas apiladas, a una escala común. */
export function renderLayoutSvg(
  layout: LayoutResult,
  options: SvgRenderOptions = {},
): string {
  const { widthPx, paddingPx, showLabels, showEdges, showGrain } =
    resolveOptions(options);
  const widest = Math.max(...layout.sheets.map((sheet) => sheet.width), 1);
  const scale = widthPx / widest;
  let counter = 0;

  if (layout.sheets.length === 0) {
    const text = "Sin hojas: no se colocó ninguna pieza.";
    return [
      `<svg xmlns="http://www.w3.org/2000/svg" width="${widthPx}" height="60" viewBox="0 0 ${widthPx} 60" font-family="${FONT}">`,
      `<text x="8" y="32" font-size="13" fill="${rgbToCss(TEXT_COLOR)}">${escapeXml(text)}</text>`,
      "</svg>",
    ].join("\n");
  }

  const body: string[] = [];
  let y = paddingPx;

  for (const sheet of layout.sheets) {
    const header = sheetHeader(sheet);
    body.push(
      `<text x="${round(paddingPx)}" y="${round(y + 16)}" font-size="13" font-weight="700" fill="${rgbToCss(TEXT_COLOR)}">${escapeXml(header)}</text>`,
    );
    y += HEADER_PX;
    const ctx: GroupContext = {
      scale,
      showLabels,
      showEdges,
      showGrain,
      nextId: () => `clip-${sheet.index}-${(counter += 1)}`,
    };
    body.push(
      `<g transform="translate(${round(paddingPx)},${round(y)})">`,
      sheetGroup(sheet, ctx),
      "</g>",
    );
    y += sheet.height * scale + GAP_PX;
  }

  const totalWidth = widthPx + paddingPx * 2;
  const totalHeight = y + paddingPx;

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${round(totalWidth)}" height="${round(totalHeight)}" viewBox="0 0 ${round(totalWidth)} ${round(totalHeight)}" font-family="${FONT}" role="img" aria-label="Plan de corte">`,
    `<rect x="0" y="0" width="${round(totalWidth)}" height="${round(totalHeight)}" fill="#ffffff"/>`,
    ...body,
    "</svg>",
  ].join("\n");
}
