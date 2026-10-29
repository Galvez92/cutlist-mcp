/**
 * Salida PDF: una página con la lista de corte y una página por hoja.
 *
 * El PDF es vectorial, sin dependencias y con fuentes base (Helvetica); en las
 * piezas pequeñas la etiqueta se recorta al área de la pieza.
 * La flecha de veta solo se dibuja en el SVG: en el PDF la veta va indicada en
 * el texto de la etiqueta ("Veta horizontal (→)" / "Veta vertical (↓)").
 */

import { EDGE_SIDES, formatMm, formatPct, sheetSideOfPartEdge } from "../geometry.js";
import { labelForPlacement } from "../labels.js";
import type { EdgeSide, LayoutResult, SheetLayout } from "../types.js";
import {
  EDGE_COLOR,
  MUTED_COLOR,
  PIECE_STROKE,
  SHEET_FILL,
  SHEET_STROKE,
  TEXT_COLOR,
  pieceFill,
} from "./palette.js";
import { PdfBuilder, PdfCanvas } from "./pdf-writer.js";

export interface PdfRenderOptions {
  /** Ancho de página en puntos. Por defecto A4 horizontal (842). */
  pageWidth?: number;
  /** Alto de página en puntos. Por defecto A4 horizontal (595). */
  pageHeight?: number;
  /** Margen en puntos. Por defecto 28. */
  margin?: number;
  /** Dibujar etiquetas dentro de las piezas. Por defecto `true`. */
  showLabels?: boolean;
  /** Incluir la página de lista de corte. Por defecto `true`. */
  includeCutList?: boolean;
}

interface Column {
  title: string;
  x: number;
  w: number;
}

const COLUMNS: Column[] = [
  { title: "Código", x: 0, w: 46 },
  { title: "Pieza", x: 46, w: 150 },
  { title: "Cant.", x: 196, w: 30 },
  { title: "Corte (mm)", x: 226, w: 104 },
  { title: "Terminada (mm)", x: 330, w: 100 },
  { title: "Cantos", x: 430, w: 108 },
  { title: "Material", x: 538, w: 174 },
  { title: "Hojas", x: 712, w: 74 },
];

interface PageGeometry {
  pageWidth: number;
  pageHeight: number;
  margin: number;
  usableWidth: number;
}

function footer(
  canvas: PdfCanvas,
  geometry: PageGeometry,
  pageNumber: number,
  totalPages: number,
): void {
  canvas.text(
    geometry.margin,
    geometry.margin - 10,
    `cutlist-mcp · página ${pageNumber} de ${totalPages}`,
    { size: 8, color: MUTED_COLOR },
  );
}

function drawEdgeLine(
  canvas: PdfCanvas,
  x: number,
  y: number,
  w: number,
  h: number,
  side: EdgeSide,
  inset: number,
): void {
  const left = x + inset;
  const right = x + w - inset;
  const bottom = y + inset;
  const top = y + h - inset;
  switch (side) {
    case "top":
      canvas.line(left, top, right, top);
      return;
    case "bottom":
      canvas.line(left, bottom, right, bottom);
      return;
    case "left":
      canvas.line(left, bottom, left, top);
      return;
    case "right":
      canvas.line(right, bottom, right, top);
      return;
  }
}

interface CutListPageArgs {
  layout: LayoutResult;
  geometry: PageGeometry;
  rows: LayoutResult["cutList"];
  pageNumber: number;
  totalPages: number;
  isLast: boolean;
}

function drawCutListPage(args: CutListPageArgs): Buffer {
  const { layout, geometry, rows, pageNumber, totalPages, isLast } = args;
  const canvas = new PdfCanvas();
  const left = geometry.margin;
  let y = geometry.pageHeight - geometry.margin;

  canvas.text(left, y - 14, "Lista de corte", {
    size: 16,
    bold: true,
    color: TEXT_COLOR,
  });
  y -= 26;

  const { metrics } = layout;
  canvas.text(
    left,
    y,
    `Piezas distintas: ${metrics.distinctParts} · Colocadas: ${metrics.placed} de ${metrics.partInstances} · Sin colocar: ${metrics.unplaced} · Hojas: ${metrics.sheetsUsed} · Aprovechamiento: ${formatPct(metrics.yieldPct)}`,
    { size: 9.5, color: TEXT_COLOR, maxWidth: geometry.usableWidth },
  );
  y -= 13;

  canvas.text(
    left,
    y,
    `Algoritmo: ${layout.algorithm} · orden de piezas: ${layout.ordering}`,
    { size: 9, color: MUTED_COLOR },
  );
  y -= 20;

  for (const column of COLUMNS) {
    canvas.text(left + column.x, y, column.title, {
      size: 8.5,
      bold: true,
      color: MUTED_COLOR,
      maxWidth: column.w,
    });
  }
  canvas.setStroke(MUTED_COLOR).setLineWidth(0.5);
  y -= 6;
  canvas.line(left, y, left + geometry.usableWidth, y);
  y -= 12;

  for (const row of rows) {
    const cells = [
      row.code,
      row.label,
      `${row.placed}/${row.quantity}`,
      `${formatMm(row.cutWidth)} × ${formatMm(row.cutHeight)}`,
      `${formatMm(row.finishedWidth)} × ${formatMm(row.finishedHeight)}`,
      row.edgeSummary || "—",
      row.material ?? "—",
      row.sheets.length ? row.sheets.join(", ") : "sin colocar",
    ];
    for (const [index, column] of COLUMNS.entries()) {
      canvas.text(left + column.x, y, cells[index] ?? "", {
        size: 8.5,
        color: TEXT_COLOR,
        maxWidth: column.w,
      });
    }
    y -= 14;
  }

  if (isLast && layout.unplaced.length > 0 && y > geometry.margin + 34) {
    y -= 6;
    canvas.text(left, y, "Piezas sin colocar", {
      size: 9.5,
      bold: true,
      color: TEXT_COLOR,
    });
    y -= 13;
    for (const entry of layout.unplaced) {
      if (y < geometry.margin + 14) break;
      canvas.text(
        left,
        y,
        `${entry.code} ×${entry.quantity} — ${entry.detail}`,
        { size: 8.5, color: TEXT_COLOR, maxWidth: geometry.usableWidth },
      );
      y -= 12;
    }
  }

  footer(canvas, geometry, pageNumber, totalPages);
  return canvas.toBuffer();
}

interface SheetPageArgs {
  layout: LayoutResult;
  sheet: SheetLayout;
  geometry: PageGeometry;
  showLabels: boolean;
  pageNumber: number;
  totalPages: number;
}

function drawSheetPage(args: SheetPageArgs): Buffer {
  const { layout, sheet, geometry, showLabels, pageNumber, totalPages } = args;
  const canvas = new PdfCanvas();
  const left = geometry.margin;
  const material = sheet.material ? ` · ${sheet.material}` : "";
  const title = `Hoja ${sheet.index} de ${layout.metrics.sheetsUsed} · ${formatMm(sheet.width)} × ${formatMm(sheet.height)} × ${formatMm(sheet.thickness)} mm${material} · aprovechamiento ${formatPct(sheet.yieldPct)} · ${sheet.placements.length} piezas`;

  canvas.text(left, geometry.pageHeight - geometry.margin - 12, title, {
    size: 11,
    bold: true,
    color: TEXT_COLOR,
    maxWidth: geometry.usableWidth,
  });

  const drawingTop = geometry.pageHeight - geometry.margin - 26;
  const availableWidth = geometry.usableWidth;
  const availableHeight = drawingTop - geometry.margin - 16;
  const scale = Math.min(
    availableWidth / sheet.width,
    availableHeight / sheet.height,
  );
  const boardWidth = sheet.width * scale;
  const boardHeight = sheet.height * scale;
  const originX = geometry.margin + (availableWidth - boardWidth) / 2;
  const originY = geometry.margin + 16 + (availableHeight - boardHeight) / 2;

  const toX = (x: number): number => originX + x * scale;
  const toY = (y: number): number => originY + boardHeight - y * scale;

  canvas.setFill(SHEET_FILL).setStroke(SHEET_STROKE).setLineWidth(0.8);
  canvas.rect(originX, originY, boardWidth, boardHeight, "B");

  if (sheet.trim > 0) {
    canvas.setStroke(MUTED_COLOR).setLineWidth(0.5).setDash([3, 3]);
    canvas.rect(
      toX(sheet.trim),
      toY(sheet.height - sheet.trim),
      (sheet.width - sheet.trim * 2) * scale,
      (sheet.height - sheet.trim * 2) * scale,
      "S",
    );
    canvas.setDash([]);
  }

  for (const placement of sheet.placements) {
    const px = toX(placement.x);
    const bottom = toY(placement.y + placement.height);
    const pw = placement.width * scale;
    const ph = placement.height * scale;
    const fill = pieceFill(placement.partId);

    canvas.setFill(fill.rgb).setStroke(PIECE_STROKE).setLineWidth(0.5);
    canvas.rect(px, bottom, pw, ph, "B");

    canvas.setStroke(EDGE_COLOR).setLineWidth(2);
    for (const side of EDGE_SIDES) {
      if (placement.edges[side] <= 0) continue;
      drawEdgeLine(
        canvas,
        px,
        bottom,
        pw,
        ph,
        sheetSideOfPartEdge(side, placement.rotated),
        1.5,
      );
    }

    if (!showLabels || pw < 30 || ph < 10) continue;
    const size = Math.max(3.2, Math.min(9, pw * 0.14, ph * 0.3));
    const lines = labelForPlacement(placement, sheet).lines;
    canvas.beginClip(px, bottom, pw, ph);
    let lineY = bottom + ph - size - 1.5;
    for (const [index, line] of lines.entries()) {
      if (lineY < bottom + 1) break;
      canvas.text(px + 1.5, lineY, line, {
        size: index === 0 ? size : size * 0.92,
        bold: index === 0,
        color: TEXT_COLOR,
        maxWidth: pw - 3,
      });
      lineY -= size + 1.4;
    }
    canvas.endClip();
  }

  footer(canvas, geometry, pageNumber, totalPages);
  return canvas.toBuffer();
}

/** Genera el PDF del layout completo (lista de corte + una página por hoja). */
export function renderLayoutPdf(
  layout: LayoutResult,
  options: PdfRenderOptions = {},
): Uint8Array {
  const geometry: PageGeometry = {
    pageWidth: options.pageWidth ?? 842,
    pageHeight: options.pageHeight ?? 595,
    margin: options.margin ?? 28,
    usableWidth: 0,
  };
  geometry.usableWidth = geometry.pageWidth - geometry.margin * 2;

  const showLabels = options.showLabels ?? true;
  const includeCutList = options.includeCutList ?? true;
  const rows = includeCutList ? layout.cutList : [];
  const rowsPerPage = Math.max(
    1,
    Math.floor((geometry.pageHeight - geometry.margin * 2 - 130) / 14),
  );
  const sheetPages = layout.sheets.length;
  const cutListPages = includeCutList
    ? Math.max(1, Math.ceil(rows.length / rowsPerPage))
    : 0;
  const totalPages = cutListPages + sheetPages;

  const contents: Buffer[] = [];
  for (let index = 0; index < cutListPages; index += 1) {
    contents.push(
      drawCutListPage({
        layout,
        geometry,
        rows: rows.slice(index * rowsPerPage, (index + 1) * rowsPerPage),
        pageNumber: index + 1,
        totalPages,
        isLast: index === cutListPages - 1,
      }),
    );
  }

  for (const [index, sheet] of layout.sheets.entries()) {
    contents.push(
      drawSheetPage({
        layout,
        sheet,
        geometry,
        showLabels,
        pageNumber: cutListPages + index + 1,
        totalPages,
      }),
    );
  }

  // Un PDF sin páginas no es válido: si no hay lista de corte ni hojas, se
  // emite una página con la explicación.
  const pagesWithContent =
    contents.length > 0
      ? contents
      : [
          new PdfCanvas()
            .text(
              geometry.margin,
              geometry.pageHeight - geometry.margin - 14,
              "Sin hojas: no se colocó ninguna pieza.",
              { size: 12, color: TEXT_COLOR },
            )
            .toBuffer(),
        ];

  const builder = new PdfBuilder();
  const catalog = builder.addObject("<< >>");
  const pagesObject = builder.addObject("<< >>");
  const font = builder.addObject(
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
  );
  const fontBold = builder.addObject(
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>",
  );

  const pageNumbers = pagesWithContent.map((content) => {
    const stream = builder.addStream(content);
    return builder.addObject(
      `<< /Type /Page /Parent ${pagesObject} 0 R /MediaBox [0 0 ${geometry.pageWidth} ${geometry.pageHeight}] /Resources << /Font << /F1 ${font} 0 R /F2 ${fontBold} 0 R >> >> /Contents ${stream} 0 R >>`,
    );
  });

  builder.setObject(
    pagesObject,
    `<< /Type /Pages /Kids [${pageNumbers.map((number) => `${number} 0 R`).join(" ")}] /Count ${pageNumbers.length} >>`,
  );
  builder.setObject(catalog, `<< /Type /Catalog /Pages ${pagesObject} 0 R >>`);

  return builder.build(catalog);
}
