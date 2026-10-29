/**
 * Paleta compartida por las salidas SVG y PDF: el mismo tono por pieza en
 * ambos formatos, para que la etiqueta impresa coincida con el plano.
 */

export interface RgbColor {
  r: number;
  g: number;
  b: number;
}

export const SHEET_FILL: RgbColor = { r: 248, g: 247, b: 244 };
export const SHEET_STROKE: RgbColor = { r: 51, g: 51, b: 51 };
export const PIECE_STROKE: RgbColor = { r: 36, g: 64, b: 94 };
export const EDGE_COLOR: RgbColor = { r: 180, g: 83, b: 9 };
export const GRAIN_COLOR: RgbColor = { r: 124, g: 135, b: 148 };
export const TEXT_COLOR: RgbColor = { r: 26, g: 32, b: 44 };
export const MUTED_COLOR: RgbColor = { r: 107, g: 114, b: 128 };

export function rgbToCss(color: RgbColor): string {
  return `rgb(${color.r} ${color.g} ${color.b})`;
}

/** Tono estable por pieza (misma pieza = mismo color en todas las hojas). */
export function pieceHue(partId: string): number {
  let hash = 0;
  for (let index = 0; index < partId.length; index += 1) {
    hash = (hash * 31 + partId.charCodeAt(index)) % 360;
  }
  return hash;
}

export function hslToRgb(hue: number, saturation: number, lightness: number): RgbColor {
  const c = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const h = (((hue % 360) + 360) % 360) / 60;
  const x = c * (1 - Math.abs((h % 2) - 1));
  const [r1, g1, b1] =
    h < 1
      ? [c, x, 0]
      : h < 2
        ? [x, c, 0]
        : h < 3
          ? [0, c, x]
          : h < 4
            ? [0, x, c]
            : h < 5
              ? [x, 0, c]
              : [c, 0, x];
  const m = lightness - c / 2;
  const to255 = (value: number) => Math.round((value + m) * 255);
  return { r: to255(r1), g: to255(g1), b: to255(b1) };
}

/** Relleno de la pieza: CSS (SVG) y RGB (PDF) a partir del mismo tono. */
export function pieceFill(partId: string): { css: string; rgb: RgbColor } {
  const hue = pieceHue(partId);
  return {
    css: `hsl(${hue} 62% 88%)`,
    rgb: hslToRgb(hue, 0.62, 0.88),
  };
}
