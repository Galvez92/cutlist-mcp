/**
 * DXF (ASCII) — exportación de layouts de corte y lectura de contornos.
 *
 * Documentación pública consultada (DXF Reference de Autodesk):
 * - ENTITIES: https://help.autodesk.com/view/ACD/2023/ENU/?guid=GUID-7D07C886-FD1D-4A0C-A7AB-B4D21F18E484
 * - POLYLINE (66 y flag 1 cerrada): https://help.autodesk.com/view/ACD/2023/ENU/?guid=GUID-ABF6B778-BE20-4B49-9B58-A94E64CEFFF3
 * - LINE: https://help.autodesk.com/view/ACD/2023/ENU/?guid=GUID-FCEF5726-53AE-4C43-B4EA-C84EB8686A66
 * - LWPOLYLINE (sólo lectura): https://help.autodesk.com/view/ACD/2023/ENU/?guid=GUID-748FC305-F3F2-4F74-825A-61F04D757A50
 *
 * Se escribe DXF R12 (AC1009) con pares código/valor, entidades
 * POLYLINE/VERTEX/SEQEND y TEXT; `$INSUNITS = 4` (milímetros). La exportación
 * consume el `LayoutResult` del motor (rama optimizer-engine): hojas con piezas
 * colocadas. La lectura reconoce rectángulos alineados a los ejes.
 */

import type { CutList } from "./model.js";
import { CutList as CutListClass, Piece, PARCIAL } from "./model.js";
import type { Source } from "./model.js";
import type { LayoutResult, Placement, SheetLayout } from "../types.js";
import { DIRECCION_AMBOS, FormatDescriptor, FormatError, propagarAvisos } from "./base.js";

export const CLAVE = "dxf";

const CAPA_HOJA = "HOJA";
const CAPA_PIEZAS = "PIEZAS";
const CAPA_ETIQUETAS = "ETIQUETAS";
const CAPAS_NO_PIEZA = [CAPA_HOJA, CAPA_ETIQUETAS];
const COLORES: Record<string, number> = { HOJA: 7, PIEZAS: 3, ETIQUETAS: 2 };
const SEPARACION_HOJAS = 50.0;
const TOLERANCIA = 1e-6;

export const DESCRIPTOR = new FormatDescriptor({
  clave: CLAVE,
  nombre: "DXF (ASCII, AutoCAD R12)",
  direccion: DIRECCION_AMBOS,
  estado: PARCIAL,
  fuentes: [
    {
      url: "https://help.autodesk.com/view/ACD/2023/ENU/?guid=GUID-7D07C886-FD1D-4A0C-A7AB-B4D21F18E484",
      descripcion: "Autodesk DXF Reference: sección ENTITIES.",
    } satisfies Source,
    {
      url: "https://help.autodesk.com/view/ACD/2023/ENU/?guid=GUID-ABF6B778-BE20-4B49-9B58-A94E64CEFFF3",
      descripcion: "Autodesk DXF Reference: POLYLINE (código 66 y flag 1 = cerrada).",
    } satisfies Source,
    {
      url: "https://help.autodesk.com/view/ACD/2023/ENU/?guid=GUID-FCEF5726-53AE-4C43-B4EA-C84EB8686A66",
      descripcion: "Autodesk DXF Reference: LINE.",
    } satisfies Source,
    {
      url: "https://help.autodesk.com/view/ACD/2023/ENU/?guid=GUID-748FC305-F3F2-4F74-825A-61F04D757A50",
      descripcion: "Autodesk DXF Reference: LWPOLYLINE (sólo se lee).",
    } satisfies Source,
  ],
  porRevisar: [
    "La escritura se limita a R12 (AC1009) con POLYLINE/VERTEX/SEQEND y TEXT; " +
      "no se emiten bloques, arcos ni entidades de versiones posteriores.",
    "La lectura sólo reconoce rectángulos alineados a los ejes (polilíneas " +
      "cerradas de 4 vértices o 4 LINE que los forman); otros contornos se " +
      "ignoran y no se convierten en piezas.",
    "Las capas se usan como grupo de la pieza; no está verificado ningún " +
      "convenio de capas de otros programas (PolyBoard, software de CNC).",
    "Al leer se excluyen por defecto las capas propias HOJA y ETIQUETAS; con " +
      "DXF de otros programas hay que indicar `soloCapa` o `excluirCapas=[]`.",
  ],
  extensiones: [".dxf"],
});

// --------------------------------------------------------------------------- //
// Escritura
// --------------------------------------------------------------------------- //

function num(valor: number, decimales = 3): string {
  let texto = Number(valor).toFixed(decimales);
  if (texto.includes(".")) texto = texto.replace(/0+$/, "").replace(/\.$/, "");
  return texto === "" ? "0" : texto;
}

function par(codigo: number, valor: string | number, decimales = 3): string {
  const v = typeof valor === "number" ? num(valor, decimales) : valor;
  return `${codigo}\n${v}\n`;
}

function polilinea(capa: string, puntos: Array<[number, number]>, decimales: number): string {
  let salida = par(0, "POLYLINE") + par(8, capa) + par(66, 1) + par(70, 1);
  salida += par(10, 0.0) + par(20, 0.0) + par(30, 0.0);
  for (const [x, y] of puntos) {
    salida += par(0, "VERTEX") + par(8, capa);
    salida += par(10, x) + par(20, y) + par(30, 0.0);
  }
  return salida + par(0, "SEQEND") + par(8, capa);
}

function rectangulo(capa: string, x: number, y: number, largo: number, ancho: number, decimales: number): string {
  return polilinea(capa, [[x, y], [x + largo, y], [x + largo, y + ancho], [x, y + ancho]], decimales);
}

function texto(capa: string, x: number, y: number, contenido: string, alto: number, decimales: number): string {
  return par(0, "TEXT") + par(8, capa) + par(10, x) + par(20, y) + par(30, 0.0) + par(40, alto) + par(1, contenido);
}

export interface ExportarOpciones {
  incluirEtiquetas?: boolean;
  incluirMedidas?: boolean;
  altoTexto?: number;
  decimales?: number;
}

function esLayoutResult(o: unknown): o is LayoutResult {
  return typeof o === "object" && o !== null && Array.isArray((o as { sheets?: unknown }).sheets);
}

export function exportarLayout(layout: LayoutResult, opciones: ExportarOpciones = {}): string {
  const incluirEtiquetas = opciones.incluirEtiquetas ?? true;
  const incluirMedidas = opciones.incluirMedidas ?? true;
  const altoTexto = opciones.altoTexto ?? 40.0;
  const decimales = opciones.decimales ?? 3;
  const hojas: SheetLayout[] = layout.sheets;
  if (hojas.length === 0) throw new FormatError("el layout no tiene hojas: nada que exportar a DXF");

  let salida = par(0, "SECTION") + par(2, "HEADER");
  salida += par(9, "$ACADVER") + par(1, "AC1009");
  salida += par(9, "$INSUNITS") + par(70, 4);
  salida += par(0, "ENDSEC");

  salida += par(0, "SECTION") + par(2, "TABLES");
  salida += par(0, "TABLE") + par(2, "LAYER") + par(70, Object.keys(COLORES).length);
  for (const [capa, color] of Object.entries(COLORES)) {
    salida += par(0, "LAYER") + par(2, capa) + par(70, 0) + par(62, color);
  }
  salida += par(0, "ENDTAB") + par(0, "ENDSEC");

  salida += par(0, "SECTION") + par(2, "ENTITIES");
  let desplazamiento = 0.0;
  for (const hoja of hojas) {
    const origenX = desplazamiento;
    salida += rectangulo(CAPA_HOJA, origenX, 0.0, hoja.width, hoja.height, decimales);
    hoja.placements.forEach((colocacion: Placement, i) => {
      const indice = i + 1;
      const x = origenX + colocacion.x;
      const y = colocacion.y;
      salida += rectangulo(CAPA_PIEZAS, x, y, colocacion.width, colocacion.height, decimales);
      if (incluirEtiquetas) {
        const identificador = colocacion.code || `${hoja.label}-${indice}`;
        salida += texto(CAPA_ETIQUETAS, x + 5.0, y + 5.0, identificador, altoTexto, decimales);
        if (incluirMedidas) {
          const medidas = `${num(colocacion.width, decimales)} x ${num(colocacion.height, decimales)}`;
          salida += texto(CAPA_ETIQUETAS, x + 5.0, y + 5.0 + altoTexto * 1.2, medidas, altoTexto, decimales);
        }
      }
    });
    desplazamiento = origenX + hoja.width + SEPARACION_HOJAS;
  }

  salida += par(0, "ENDSEC") + par(0, "EOF");
  return salida;
}

export function exportar(objeto: unknown, opciones: ExportarOpciones = {}): string {
  if (!esLayoutResult(objeto)) {
    throw new FormatError(
      "el DXF se exporta desde un Layout (hojas con piezas colocadas), " +
        `no desde ${objeto === null ? "null" : typeof objeto}`,
    );
  }
  return exportarLayout(objeto, opciones);
}

// --------------------------------------------------------------------------- //
// Lectura
// --------------------------------------------------------------------------- //

interface Entidad {
  tipo: string;
  capa: string | null;
  flags: number;
  puntos: number[][];
  x2: number | null;
  y2: number | null;
  texto: string | null;
}

interface ParDxf {
  codigo: number;
  valor: string;
}

function pares(texto: string): ParDxf[] {
  const lineas = texto.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  while (lineas.length && lineas[lineas.length - 1].trim() === "") lineas.pop();
  const out: ParDxf[] = [];
  for (let i = 0; i < lineas.length - 1; i += 2) {
    const crudo = lineas[i].trim();
    if (crudo === "") continue;
    const codigo = Number(crudo);
    if (!Number.isInteger(codigo)) throw new FormatError(`código de grupo DXF inválido: ${JSON.stringify(crudo)}`);
    out.push({ codigo, valor: lineas[i + 1].trim() });
  }
  return out;
}

function leerEntidad(pares: ParDxf[], indice: number): [Entidad, number] {
  const tipo = pares[indice].valor.toUpperCase();
  const datos: Entidad = {
    tipo, capa: null, flags: 0, puntos: [], x2: null, y2: null, texto: null,
  };
  let j = indice + 1;
  while (j < pares.length && pares[j].codigo !== 0) {
    const { codigo, valor } = pares[j];
    try {
      if (codigo === 8) datos.capa = valor;
      else if (codigo === 70) datos.flags = Number(valor);
      else if (codigo === 10) datos.puntos.push([Number(valor), 0.0]);
      else if (codigo === 20 && datos.puntos.length) datos.puntos[datos.puntos.length - 1][1] = Number(valor);
      else if (codigo === 11) datos.x2 = Number(valor);
      else if (codigo === 21) datos.y2 = Number(valor);
      else if (codigo === 1) datos.texto = valor;
    } catch {
      throw new FormatError(`${tipo}: valor no numérico en el código ${codigo}: ${JSON.stringify(valor)}`);
    }
    j += 1;
  }
  return [datos, j];
}

function entidades(pares: ParDxf[]): Entidad[] {
  const out: Entidad[] = [];
  let seccion: string | null = null;
  let indice = 0;
  while (indice < pares.length) {
    const { codigo, valor } = pares[indice];
    if (codigo === 2 && seccion === null) {
      seccion = valor.toUpperCase();
      indice += 1;
      continue;
    }
    if (codigo === 0) {
      const tipo = valor.toUpperCase();
      if (tipo === "ENDSEC") {
        if (seccion === "ENTITIES") break;
        seccion = null;
        indice += 1;
        continue;
      }
      if (seccion === "ENTITIES" && tipo !== "SECTION") {
        const [entidad, next] = leerEntidad(pares, indice);
        out.push(entidad);
        indice = next;
        continue;
      }
    }
    indice += 1;
  }
  return out;
}

function igual(a: number[], b: number[], tolerancia = TOLERANCIA): boolean {
  return Math.abs(a[0] - b[0]) <= tolerancia && Math.abs(a[1] - b[1]) <= tolerancia;
}

function rectanguloDesdePuntos(
  puntos: number[][],
  tolerancia = TOLERANCIA,
): [number, number, number, number] | null {
  const xs = [...new Set(puntos.map((p) => Math.round(p[0] * 1e6) / 1e6))].sort((a, b) => a - b);
  const ys = [...new Set(puntos.map((p) => Math.round(p[1] * 1e6) / 1e6))].sort((a, b) => a - b);
  if (xs.length !== 2 || ys.length !== 2) return null;
  const largo = xs[1] - xs[0];
  const ancho = ys[1] - ys[0];
  if (largo <= tolerancia || ancho <= tolerancia) return null;
  return [xs[0], ys[0], largo, ancho];
}

type Vertical = [indice: number, capa: string | null, x: number, minY: number, maxY: number];
type Horizontal = [indice: number, capa: string | null, minX: number, maxX: number, y: number];
type Segmento = [p1: [number, number], p2: [number, number], capa: string | null];

function buscarVertical(verticales: Vertical[], x: number, y1: number, y2: number, tolerancia = TOLERANCIA): Vertical | null {
  for (const v of verticales) {
    if (
      Math.abs(v[2] - x) <= tolerancia &&
      Math.abs(v[3] - Math.min(y1, y2)) <= tolerancia &&
      Math.abs(v[4] - Math.max(y1, y2)) <= tolerancia
    ) {
      return v;
    }
  }
  return null;
}

function rectangulosDesdeLineas(
  segmentos: Segmento[],
  tolerancia = TOLERANCIA,
): Array<[capa: string | null, x: number, y: number, largo: number, ancho: number]> {
  const horizontales: Horizontal[] = [];
  const verticales: Vertical[] = [];
  segmentos.forEach((seg, indice) => {
    const [p1, p2, capa] = seg;
    if (Math.abs(p1[1] - p2[1]) <= tolerancia) {
      horizontales.push([indice, capa, Math.min(p1[0], p2[0]), Math.max(p1[0], p2[0]), p1[1]]);
    } else if (Math.abs(p1[0] - p2[0]) <= tolerancia) {
      verticales.push([indice, capa, p1[0], Math.min(p1[1], p2[1]), Math.max(p1[1], p2[1])]);
    }
  });

  const usados = new Set<number>();
  const rectangulos: Array<[string | null, number, number, number, number]> = [];
  for (let a = 0; a < horizontales.length; a++) {
    for (let b = a + 1; b < horizontales.length; b++) {
      const [ia, capaA, x1a, x2a, ya] = horizontales[a];
      const [ib, capaB, x1b, x2b, yb] = horizontales[b];
      if (Math.abs(x1a - x1b) > tolerancia || Math.abs(x2a - x2b) > tolerancia) continue;
      if (Math.abs(ya - yb) <= tolerancia) continue;
      const izquierda = buscarVertical(verticales, x1a, ya, yb);
      const derecha = buscarVertical(verticales, x2a, ya, yb);
      if (izquierda === null || derecha === null) continue;
      const ids = new Set([ia, ib, izquierda[0], derecha[0]]);
      if ([...ids].some((id) => usados.has(id))) continue;
      for (const id of ids) usados.add(id);
      rectangulos.push([capaA || capaB, x1a, Math.min(ya, yb), x2a - x1a, Math.abs(ya - yb)]);
    }
  }
  return rectangulos;
}

function textoDentro(
  textos: Array<[number, number, string]>,
  x: number, y: number, largo: number, ancho: number,
): string | null {
  for (const [tx, ty, contenido] of textos) {
    if (x <= tx && tx <= x + largo && y <= ty && ty <= y + ancho && contenido) return contenido;
  }
  return null;
}

export interface ImportarOpciones {
  soloCapa?: string;
  excluirCapas?: readonly string[];
}

export function importar(texto: string, opciones: ImportarOpciones = {}): CutList {
  const ents = entidades(pares(texto));
  if (ents.length === 0) throw new FormatError("el DXF no tiene entidades en la sección ENTITIES");

  const textos: Array<[number, number, string]> = [];
  const polilineas: Array<{ capa: string | null; cerrada: boolean; puntos: number[][] }> = [];
  const segmentos: Segmento[] = [];

  let indice = 0;
  while (indice < ents.length) {
    const entidad = ents[indice];
    const tipo = entidad.tipo;
    if (tipo === "TEXT" && entidad.texto && entidad.puntos.length) {
      const [x, y] = entidad.puntos[0];
      textos.push([x, y, entidad.texto]);
      indice += 1;
      continue;
    }
    if (tipo === "LWPOLYLINE" || tipo === "POLYLINE") {
      if (tipo === "POLYLINE") {
        const puntos: number[][] = [];
        const cerrada = Boolean(entidad.flags & 1);
        let j = indice + 1;
        while (j < ents.length && (ents[j].tipo === "VERTEX" || ents[j].tipo === "SEQEND")) {
          if (ents[j].tipo === "VERTEX" && ents[j].puntos.length) puntos.push(ents[j].puntos[0]);
          if (ents[j].tipo === "SEQEND") {
            j += 1;
            break;
          }
          j += 1;
        }
        polilineas.push({ capa: entidad.capa, cerrada, puntos });
        indice = j;
        continue;
      }
      polilineas.push({
        capa: entidad.capa,
        cerrada: Boolean(entidad.flags & 1),
        puntos: [...entidad.puntos],
      });
      indice += 1;
      continue;
    }
    if (tipo === "LINE" && entidad.puntos.length && entidad.x2 !== null) {
      const inicio = entidad.puntos[0];
      segmentos.push([[inicio[0], inicio[1]], [entidad.x2, entidad.y2 ?? 0], entidad.capa]);
    }
    indice += 1;
  }

  const contornos: Array<[string | null, number, number, number, number]> = [];
  for (const poli of polilineas) {
    const puntos = [...poli.puntos];
    if (puntos.length > 1 && igual(puntos[0], puntos[puntos.length - 1])) puntos.pop();
    if (!poli.cerrada && puntos.length < 4) continue;
    const rect = rectanguloDesdePuntos(puntos);
    if (rect === null) continue;
    const [x, y, largo, ancho] = rect;
    contornos.push([poli.capa, x, y, largo, ancho]);
  }
  contornos.push(...rectangulosDesdeLineas(segmentos));

  const excluidas = new Set((opciones.excluirCapas ?? CAPAS_NO_PIEZA).map((c) => c.toUpperCase()));
  const lista = new CutListClass({ metadatos: { formato: CLAVE } });
  contornos.forEach((contorno, i) => {
    const numero = i + 1;
    const [capa, x, y, largo, ancho] = contorno;
    if (excluidas.has((capa ?? "").toUpperCase())) return;
    if (opciones.soloCapa && (capa ?? "").toUpperCase() !== opciones.soloCapa.toUpperCase()) return;
    const etiqueta = textoDentro(textos, x, y, largo, ancho);
    try {
      lista.agregar(
        new Piece({
          nombre: etiqueta ?? `contorno ${numero}`,
          largo,
          ancho,
          grupo: capa,
          etiqueta: capa,
          extra: { x, y },
        }),
      );
    } catch (err) {
      throw new FormatError(`contorno ${numero}: ${(err as Error).message}`);
    }
  });
  if (lista.piezas.length === 0) {
    throw new FormatError("no se reconocieron contornos rectangulares en el DXF");
  }
  return propagarAvisos(DESCRIPTOR, lista);
}
