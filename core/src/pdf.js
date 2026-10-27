/**
 * Exportación PDF del layout (una página por tablero + hoja de lista de corte).
 *
 * Usa `pdf-lib` (https://pdf-lib.js.org/) para generar un PDF 1.7 válido.
 * Tamaño de página del tablero = medidas reales convertidas a puntos (72 pt = 1 in),
 * por lo que el PDF se puede imprimir a escala 1:1 si el papel lo permite.
 */

import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

export const MM_TO_PT = 72 / 25.4;
export const PDF_MIME = 'application/pdf';
export const PDF_BASENAME = 'cutlist-layout';

const PAGE = { width: 841.89, height: 595.28 }; // A4 horizontal, en puntos
const MARGIN = 28;
const LINE = 12;

/**
 * WinAnsi (Helvetica estándar) no cubre todos los caracteres del fixture
 * (®, Ø, acentos sí; emoji y símbolos matemáticos no).
 */
export function sanitizeWinAnsi(text) {
  const replacements = { '×': 'x', '↻': '(g)', '≥': '>=', '≤': '<=', '→': '->', '…': '...' };
  let out = '';
  for (const char of String(text ?? '')) {
    if (replacements[char] != null) {
      out += replacements[char];
      continue;
    }
    const code = char.codePointAt(0);
    // 0x7F–0x9F no están definidos en WinAnsi
    out += code <= 0xff && !(code >= 0x7f && code <= 0x9f) ? char : '?';
  }
  return out;
}

function fitText(font, text, size, maxWidth) {
  let out = sanitizeWinAnsi(text);
  if (maxWidth <= 0) return '';
  if (font.widthOfTextAtSize(out, size) <= maxWidth) return out;
  while (out.length > 1 && font.widthOfTextAtSize(`${out}...`.slice(0, -1), size) > maxWidth) {
    out = out.slice(0, -1);
  }
  return `${out}...`;
}

function writer(pdf, fonts) {
  let page = pdf.addPage([PAGE.width, PAGE.height]);
  let y = PAGE.height - MARGIN;
  return {
    line(text, { size = 9, bold = false, step = LINE, color = rgb(0.1, 0.1, 0.1) } = {}) {
      if (y < MARGIN + step) {
        page = pdf.addPage([PAGE.width, PAGE.height]);
        y = PAGE.height - MARGIN;
      }
      page.drawText(fitText(bold ? fonts.bold : fonts.font, text, size, PAGE.width - 2 * MARGIN), {
        x: MARGIN,
        y,
        size,
        font: bold ? fonts.bold : fonts.font,
        color,
      });
      y -= step;
    },
    space(step = LINE / 2) {
      y -= step;
    },
  };
}

function drawSummary(pdf, layout, fonts) {
  const stats = layout.stats;
  const out = writer(pdf, fonts);
  out.line('cutlist-mcp · lista de corte', { size: 15, bold: true, step: 20 });
  out.line(
    `Modo ${layout.mode} · kerf ${layout.kerf} mm · tableros ${stats.sheetsUsed} · aprovechamiento ${stats.yieldPct}%`,
    { size: 10, step: 14 },
  );
  out.line(
    `Piezas colocadas ${stats.piecesPlaced}/${stats.piecesRequested} · área de piezas ${(
      stats.usedArea / 1e6
    ).toFixed(3)} m² · sobrante ${(stats.wasteArea / 1e6).toFixed(3)} m²`,
    { size: 10, step: 16 },
  );

  if (layout.profile) {
    out.line(
      `Perfil ${layout.profile.label} (por revisar: ${layout.profile.source})`,
      { size: 9, color: rgb(0.45, 0.2, 0.1), step: 14 },
    );
  }

  out.space(6);
  out.line('etiqueta | cant | ancho | alto | veta | canto mm | tableros', { bold: true, step: 14 });
  for (const entry of layout.cutList) {
    out.line(
      `${entry.label} | ${entry.qty} | ${entry.width} | ${entry.height} | ${entry.grain} | ${entry.edgeLengthMm} | ${entry.sheets.join(' ')}`,
    );
  }

  if (layout.unplaced.length) {
    out.space(6);
    out.line(`Sin colocar (${layout.unplaced.length})`, { bold: true, color: rgb(0.6, 0.1, 0.1), step: 14 });
    for (const piece of layout.unplaced) {
      out.line(`${piece.label} ${piece.width}×${piece.height} mm — ${piece.reason}`);
    }
  }

  if (layout.warnings.length) {
    out.space(6);
    out.line(`Avisos (${layout.warnings.length})`, { bold: true, color: rgb(0.5, 0.35, 0.05), step: 14 });
    for (const warning of layout.warnings) out.line(warning);
  }
}

function drawSheetPage(pdf, sheet, fonts) {
  const sheetWidth = sheet.width * MM_TO_PT;
  const sheetHeight = sheet.height * MM_TO_PT;
  const page = pdf.addPage([sheetWidth + 2 * MARGIN, sheetHeight + 2 * MARGIN]);

  page.drawText(
    fitText(
      fonts.bold,
      `Tablero ${sheet.index} · ${sheet.name} · ${sheet.width}×${sheet.height} mm · ${sheet.stats.pieces} piezas · aprovechamiento ${sheet.stats.yieldPct}%`,
      9,
      sheetWidth,
    ),
    { x: MARGIN, y: sheetHeight + MARGIN - 9, size: 9, font: fonts.bold, color: rgb(0.1, 0.1, 0.1) },
  );

  page.drawRectangle({
    x: MARGIN,
    y: MARGIN,
    width: sheetWidth,
    height: sheetHeight,
    borderColor: rgb(0.12, 0.16, 0.22),
    borderWidth: 1,
  });

  for (const placement of sheet.placements) {
    const x = MARGIN + placement.x * MM_TO_PT;
    const y = MARGIN + (sheet.height - placement.y - placement.height) * MM_TO_PT;
    const width = placement.width * MM_TO_PT;
    const height = placement.height * MM_TO_PT;
    page.drawRectangle({
      x,
      y,
      width,
      height,
      color: placement.rotated ? rgb(0.99, 0.93, 0.92) : rgb(0.94, 0.96, 0.99),
      borderColor: rgb(0.3, 0.33, 0.38),
      borderWidth: 0.6,
    });

    if (width < 42 || height < 22) continue;
    const size = Math.min(8, Math.max(4.5, height / 5));
    page.drawText(fitText(fonts.font, placement.label, size, width - 6), {
      x: x + 3,
      y: y + height / 2 + 1,
      size,
      font: fonts.font,
      color: rgb(0.06, 0.09, 0.16),
    });
    page.drawText(fitText(fonts.font, `${placement.width}×${placement.height}`, size * 0.9, width - 6), {
      x: x + 3,
      y: y + height / 2 - size - 1,
      size: size * 0.9,
      font: fonts.font,
      color: rgb(0.25, 0.29, 0.35),
    });
  }
}

export async function layoutToPdf(layout, options = {}) {
  const { title = 'cutlist-mcp · layout de corte', includeSummary = true } = options;
  const pdf = await PDFDocument.create();
  const fonts = {
    font: await pdf.embedFont(StandardFonts.Helvetica),
    bold: await pdf.embedFont(StandardFonts.HelveticaBold),
  };

  pdf.setTitle(sanitizeWinAnsi(title));
  pdf.setCreator('cutlist-mcp');
  pdf.setProducer('cutlist-mcp (pdf-lib)');

  if (includeSummary) drawSummary(pdf, layout, fonts);
  for (const sheet of layout.sheets) drawSheetPage(pdf, sheet, fonts);

  return pdf.save();
}
