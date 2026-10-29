/**
 * Escritor mínimo de PDF (subconjunto de PDF 1.4, sin dependencias).
 *
 * Cubre lo que necesitan los planos de corte: páginas con un flujo de
 * contenido cada una, rectángulos, líneas, recorte (clip) y texto con las
 * fuentes base Helvetica / Helvetica-Bold y codificación WinAnsi.
 * Las cadenas se escriben en latin1, que es el rango que cubre WinAnsi para
 * español (á é í ó ú ñ) sin embeber fuentes.
 */

import type { RgbColor } from "./palette.js";

/** Número con 3 decimales, sin notación exponencial. */
function num(value: number): string {
  const rounded = Math.round(value * 1000) / 1000;
  return `${rounded === 0 ? 0 : rounded}`;
}

function escapeText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)")
    // Caracteres fuera de latin1 (p. ej. emoji) no se pueden representar con
    // WinAnsi: se sustituyen para no romper el archivo.
    .replace(/[^\x20-\xFF]/g, "?");
}

/** Ancho aproximado de Helvetica (0.5 em por carácter). */
export function approxTextWidth(text: string, size: number): number {
  return text.length * size * 0.5;
}

/** Recorta el texto para que quepa en `maxWidth` (con "..." si sobra). */
export function truncateToWidth(
  text: string,
  size: number,
  maxWidth: number,
): string {
  const maxChars = Math.max(1, Math.floor(maxWidth / (size * 0.5)));
  if (text.length <= maxChars) return text;
  return `${text.slice(0, Math.max(1, maxChars - 3))}...`;
}

export interface TextOptions {
  size: number;
  bold?: boolean;
  color?: RgbColor;
  align?: "left" | "center";
  maxWidth?: number;
}

/** Constructor de flujos de contenido PDF (coordenadas: origen abajo-izquierda). */
export class PdfCanvas {
  private readonly ops: string[] = [];

  setFill(color: RgbColor): this {
    this.ops.push(
      `${num(color.r / 255)} ${num(color.g / 255)} ${num(color.b / 255)} rg`,
    );
    return this;
  }

  setStroke(color: RgbColor): this {
    this.ops.push(
      `${num(color.r / 255)} ${num(color.g / 255)} ${num(color.b / 255)} RG`,
    );
    return this;
  }

  setLineWidth(width: number): this {
    this.ops.push(`${num(width)} w`);
    return this;
  }

  /** Patrón de trazo; `[]` vuelve a línea continua. */
  setDash(pattern: number[]): this {
    this.ops.push(pattern.length ? `[${pattern.map(num).join(" ")}] 0 d` : "[] 0 d");
    return this;
  }

  rect(x: number, y: number, w: number, h: number, mode: "f" | "S" | "B"): this {
    this.ops.push(`${num(x)} ${num(y)} ${num(w)} ${num(h)} re ${mode}`);
    return this;
  }

  line(x1: number, y1: number, x2: number, y2: number): this {
    this.ops.push(`${num(x1)} ${num(y1)} m ${num(x2)} ${num(y2)} l S`);
    return this;
  }

  /** Recorta todo lo que se dibuje hasta `endClip()`. */
  beginClip(x: number, y: number, w: number, h: number): this {
    this.ops.push("q", `${num(x)} ${num(y)} ${num(w)} ${num(h)} re W n`);
    return this;
  }

  endClip(): this {
    this.ops.push("Q");
    return this;
  }

  text(x: number, y: number, value: string, options: TextOptions): this {
    const { size } = options;
    const content = options.maxWidth
      ? truncateToWidth(value, size, options.maxWidth)
      : value;
    if (content === "") return this;
    if (options.color) this.setFill(options.color);
    const startX =
      options.align === "center"
        ? x - approxTextWidth(content, size) / 2
        : x;
    this.ops.push(
      `BT /${options.bold ? "F2" : "F1"} ${num(size)} Tf 1 0 0 1 ${num(startX)} ${num(y)} Tm (${escapeText(content)}) Tj ET`,
    );
    return this;
  }

  toBuffer(): Buffer {
    return Buffer.from(this.ops.join("\n"), "latin1");
  }
}

/** Documento PDF: objetos indirectos y tabla xref. */
export class PdfBuilder {
  /** Índice 0 sin usar: los objetos se numeran desde 1. */
  private readonly objects: (Buffer | null)[] = [null];

  addObject(body: string): number {
    this.objects.push(Buffer.from(body, "latin1"));
    return this.objects.length - 1;
  }

  addStream(content: Buffer, extraDict = ""): number {
    const dictionary = `<< /Length ${content.length}${extraDict ? ` ${extraDict}` : ""} >>`;
    this.objects.push(
      Buffer.concat([
        Buffer.from(`${dictionary}\nstream\n`, "latin1"),
        content,
        Buffer.from("\nendstream", "latin1"),
      ]),
    );
    return this.objects.length - 1;
  }

  setObject(number: number, body: string): void {
    this.objects[number] = Buffer.from(body, "latin1");
  }

  build(rootObjectNumber: number): Uint8Array {
    const chunks: Buffer[] = [];
    let offset = 0;
    const push = (chunk: Buffer): void => {
      chunks.push(chunk);
      offset += chunk.length;
    };

    // Comentario binario: marca el archivo como binario para las herramientas.
    push(Buffer.from("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n", "latin1"));

    const count = this.objects.length;
    const offsets = new Array<number>(count).fill(0);

    for (let number = 1; number < count; number += 1) {
      const body = this.objects[number];
      if (!body) {
        throw new Error(`PDF: el objeto ${number} no está definido.`);
      }
      offsets[number] = offset;
      push(Buffer.from(`${number} 0 obj\n`, "latin1"));
      push(body);
      push(Buffer.from("\nendobj\n", "latin1"));
    }

    const xrefOffset = offset;
    let xref = `xref\n0 ${count}\n0000000000 65535 f \n`;
    for (let number = 1; number < count; number += 1) {
      xref += `${String(offsets[number]).padStart(10, "0")} 00000 n \n`;
    }
    push(Buffer.from(xref, "latin1"));
    push(
      Buffer.from(
        `trailer\n<< /Size ${count} /Root ${rootObjectNumber} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`,
        "latin1",
      ),
    );

    return new Uint8Array(Buffer.concat(chunks));
  }
}
