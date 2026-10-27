import { PDFDocument } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import { optimize } from '@core/index.js';
import { MM_TO_PT, layoutToPdf, sanitizeWinAnsi } from '@core/pdf.js';

const buildLayout = () =>
  optimize({
    kerf: 4,
    parts: [
      { label: 'Costado ® Ø35', width: 732, height: 600, qty: 2, edges: 0.4 },
      { label: 'Estante', width: 1173.5, height: 600, qty: 3 },
    ],
    sheets: [{ name: 'MDF Roble 18 mm', width: 2500, height: 1830, thickness: 18 }],
  });

describe('sanitizeWinAnsi', () => {
  it('conserva lo que Helvetica puede dibujar y sustituye el resto', () => {
    expect(sanitizeWinAnsi('Costado ® Ø35 áé')).toBe('Costado ® Ø35 áé');
    expect(sanitizeWinAnsi('732×600')).toBe('732x600');
    expect(sanitizeWinAnsi('corte 😀 → fin')).toBe('corte ? -> fin');
  });
});

describe('layoutToPdf', () => {
  it('produce un PDF que pdf-lib puede volver a leer', async () => {
    const layout = buildLayout();
    const bytes = await layoutToPdf(layout);

    expect(Buffer.from(bytes.slice(0, 5)).toString()).toBe('%PDF-');

    const reloaded = await PDFDocument.load(bytes);
    expect(reloaded.getPageCount()).toBe(1 + layout.sheets.length);
    expect(reloaded.getTitle()).toContain('cutlist-mcp');
  });

  it('usa la medida real del tablero en la página de cada tablero', async () => {
    const layout = buildLayout();
    const bytes = await layoutToPdf(layout);
    const reloaded = await PDFDocument.load(bytes);
    const [summary, firstSheet] = reloaded.getPages();
    const size = firstSheet.getSize();

    expect(size.width).toBeCloseTo(layout.sheets[0].width * MM_TO_PT + 56, 1);
    expect(size.height).toBeCloseTo(layout.sheets[0].height * MM_TO_PT + 56, 1);
    expect(summary.getSize().width).toBeCloseTo(841.89, 1); // A4 horizontal
  });

  it('permite omitir la hoja de lista de corte', async () => {
    const layout = buildLayout();
    const bytes = await layoutToPdf(layout, { includeSummary: false });
    const reloaded = await PDFDocument.load(bytes);
    expect(reloaded.getPageCount()).toBe(layout.sheets.length);
  });

  it('un layout sin piezas colocadas sigue generando un PDF válido', async () => {
    const layout = optimize({
      parts: [{ label: 'Enorme', width: 5000, height: 5000 }],
      sheets: [{ name: 'MDF', width: 2500, height: 1830 }],
    });
    const bytes = await layoutToPdf(layout);
    const reloaded = await PDFDocument.load(bytes);
    expect(reloaded.getPageCount()).toBe(1); // solo el resumen con lo que no se pudo colocar
  });
});

describe('paginación de la lista de corte', () => {
  it('agrega páginas de resumen cuando la lista de corte no cabe en una', async () => {
    const parts = Array.from({ length: 60 }, (_, index) => ({
      label: `Pieza ${index + 1}`,
      width: 200,
      height: 100,
      qty: 1,
    }));
    const layout = optimize({ kerf: 0, parts, sheets: [{ name: 'MDF', width: 2500, height: 1830 }] });
    const reloaded = await PDFDocument.load(await layoutToPdf(layout));

    expect(layout.cutList).toHaveLength(60);
    expect(reloaded.getPageCount()).toBeGreaterThan(1 + layout.sheets.length);
  });
});
