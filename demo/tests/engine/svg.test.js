import { describe, expect, it } from 'vitest';
import { escapeXml, optimize, renderLayoutSvg, renderSheetGroup } from '@core/index.js';

const layout = (overrides = {}) =>
  optimize({
    kerf: 4,
    parts: [
      { label: 'Costado <sur>', width: 800, height: 500, qty: 2 },
      { label: 'Estante', width: 600, height: 300, qty: 1 },
    ],
    sheets: [{ name: 'MDF & 18', width: 2500, height: 1830, thickness: 18 }],
    ...overrides,
  });

const countOccurrences = (text, needle) => text.split(needle).length - 1;

describe('escapeXml', () => {
  it('escapa los caracteres reservados de XML', () => {
    expect(escapeXml('a<b>&"\'')).toBe('a&lt;b&gt;&amp;&quot;&#39;');
  });
});

describe('renderLayoutSvg', () => {
  it('dibuja un rectángulo por pieza colocada y uno por tablero', () => {
    const result = layout();
    const svg = renderLayoutSvg(result);

    expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"')).toBe(true);
    expect(countOccurrences(svg, '<rect class="piece')).toBe(result.stats.piecesPlaced);
    expect(countOccurrences(svg, 'class="sheet"')).toBe(result.sheets.length);
    expect(svg).toContain('viewBox="-30 -70 2560 1940"'); // 2500×1830 + margen para los títulos
  });

  it('escapa las etiquetas de las piezas', () => {
    const svg = renderLayoutSvg(layout());
    expect(svg).toContain('&lt;sur&gt;');
    expect(svg).not.toContain('<sur>');
  });

  it('incluye las medidas y el aprovechamiento del tablero', () => {
    const svg = renderLayoutSvg(layout());
    expect(svg).toContain('2500×1830 mm');
    expect(svg).toContain('%');
  });

  it('sin layout devuelve un aviso en lugar de un SVG vacío', () => {
    const svg = renderLayoutSvg(null);
    expect(svg).toContain('Sin layout');
    expect(countOccurrences(svg, '<rect class="piece')).toBe(0);
  });

  it('apila varios tableros con desplazamiento vertical', () => {
    const result = layout({ parts: [{ label: 'Media', width: 1200, height: 1800, qty: 4 }], kerf: 0 });
    expect(result.sheets.length).toBeGreaterThan(1);

    const svg = renderLayoutSvg(result);
    const offsets = [...svg.matchAll(/class="sheet" x="0" y="([\d.]+)"/g)].map((match) => Number(match[1]));
    expect(offsets).toHaveLength(result.sheets.length);
    expect(offsets[0]).toBe(0);
    expect(offsets[1]).toBeGreaterThan(offsets[0]);
  });
});

describe('renderSheetGroup', () => {
  it('desplaza el grupo completo según offsetY', () => {
    const result = layout();
    const group = renderSheetGroup(result.sheets[0], { offsetY: 100 });
    expect(group).toContain('y="100"');
    expect(group).not.toContain('<svg');
  });
});
