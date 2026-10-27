/**
 * Salida SVG del layout. Unidades del SVG: milímetros (viewBox = medidas reales).
 * SVG 1.1: https://www.w3.org/TR/SVG11/
 */

const XML_ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const SHEET_GAP = 90; // mm entre tableros al apilar varios

export function escapeXml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => XML_ESCAPES[char]);
}

const round = (value) => Math.round(value * 100) / 100;

const STYLES = `<style>
  .sheet { fill: #ffffff; stroke: #1f2937; stroke-width: 3; }
  .piece { fill: #eef2f8; stroke: #4b5563; stroke-width: 1.6; }
  .piece--rotated { fill: #fdecea; }
  .piece-label { fill: #111827; font-family: ui-sans-serif, system-ui, sans-serif; }
  .sheet-title { fill: #111827; font-family: ui-sans-serif, system-ui, sans-serif; font-size: 26px; font-weight: 600; }
  .sheet-subtitle { fill: #4b5563; font-family: ui-sans-serif, system-ui, sans-serif; font-size: 20px; }
</style>`;

function truncate(text, maxChars) {
  const value = String(text ?? '');
  return value.length <= maxChars ? value : `${value.slice(0, Math.max(1, maxChars - 1))}…`;
}

function labelText(placement) {
  return `${round(placement.width)}×${round(placement.height)}${placement.rotated ? ' ↻' : ''}`;
}

/**
 * Grupo SVG de un tablero (sin <svg> contenedor). `offsetY` desplaza el tablero
 * hacia abajo para apilar varios en un mismo lienzo.
 */
export function renderSheetGroup(sheet, { offsetY = 0, showLabels = true, title = null, subtitle = null } = {}) {
  const parts = [];
  if (title) parts.push(`<text class="sheet-title" x="0" y="${round(offsetY - 34)}">${escapeXml(title)}</text>`);
  if (subtitle) parts.push(`<text class="sheet-subtitle" x="0" y="${round(offsetY - 10)}">${escapeXml(subtitle)}</text>`);
  parts.push(`<rect class="sheet" x="0" y="${round(offsetY)}" width="${sheet.width}" height="${sheet.height}" />`);

  for (const placement of sheet.placements) {
    const y = offsetY + placement.y;
    parts.push(
      `<rect class="piece${placement.rotated ? ' piece--rotated' : ''}" x="${round(placement.x)}" y="${round(y)}" ` +
        `width="${round(placement.width)}" height="${round(placement.height)}" />`,
    );

    if (!showLabels || placement.width < 60 || placement.height < 34) continue;
    const size = Math.max(8, Math.min(22, Math.min(placement.height / 5, placement.width / 9)));
    const maxChars = Math.max(3, Math.floor((placement.width - 10) / (size * 0.56)));
    const cx = round(placement.x + placement.width / 2);
    const cy = round(y + placement.height / 2);
    parts.push(
      `<text class="piece-label" x="${cx}" y="${round(cy - size * 0.1)}" font-size="${round(size)}" text-anchor="middle">` +
        `${escapeXml(truncate(placement.label, maxChars))}</text>`,
      `<text class="piece-label" x="${cx}" y="${round(cy + size * 0.95)}" font-size="${round(size * 0.85)}" ` +
        `text-anchor="middle">${escapeXml(labelText(placement))}</text>`,
    );
  }

  return parts.join('\n');
}

/** Lienzo con todos los tableros apilados. */
export function renderLayoutSvg(layout, { showLabels = true, sheetGap = SHEET_GAP, width = null } = {}) {
  const sheets = layout?.sheets ?? [];
  if (sheets.length === 0) {
    return (
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 120" width="600" height="120" role="img" ` +
      `aria-label="Sin layout">${STYLES}<text class="sheet-subtitle" x="16" y="70">Sin layout: revisa las piezas y el tablero.</text></svg>`
    );
  }

  const groups = [];
  let offsetY = 0;
  for (const sheet of sheets) {
    groups.push(
      renderSheetGroup(sheet, {
        offsetY,
        showLabels,
        title: `Tablero ${sheet.index} · ${sheet.name} · ${round(sheet.width)}×${round(sheet.height)} mm` +
          `${sheet.thickness ? ` × ${sheet.thickness} mm` : ''}`,
        subtitle: `${sheet.stats.pieces} piezas · aprovechamiento ${sheet.stats.yieldPct}% · sobrante ${round(
          sheet.stats.wasteArea / 1e6,
        )} m²`,
      }),
    );
    offsetY += sheet.height + sheetGap;
  }

  const contentWidth = Math.max(...sheets.map((sheet) => sheet.width));
  const contentHeight = offsetY - sheetGap + 40;
  const attributes = width ? ` width="${width}" height="${(contentHeight / contentWidth) * width}"` : '';

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-30 -70 ${contentWidth + 60} ${contentHeight + 70}"${attributes} ` +
    `role="img" aria-label="Layout de corte">${STYLES}\n${groups.join('\n')}\n</svg>`
  );
}
