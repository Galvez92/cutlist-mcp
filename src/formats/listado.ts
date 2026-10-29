/**
 * Lector/escritor de listados delimitados con columnas declaradas.
 *
 * PolyBoard, Promob y PRO100 exportan listados de piezas en texto/CSV cuya
 * estructura no está publicada (campos, orden, separador y decimales son
 * configurables por el usuario en cada programa). En lugar de inventar un orden
 * de columnas, este módulo pide las columnas declaradas y, si no se declaran,
 * usa un orden por defecto marcado «por revisar» en cada formato.
 */

import type { Piece } from "./model.js";
import { DataError, Piece as PieceClass } from "./model.js";
import {
  aBooleano,
  aEntero,
  aNumero,
  aNumeroOpcional,
  escribirTabla,
  formatearNumero,
  mapearColumnas,
  normalizarNombre,
} from "./base.js";

export const CAMPOS_VALIDOS = [
  "nombre", "largo", "ancho", "cantidad", "espesor", "material", "veta",
  "grupo", "etiqueta", "notas", "canto_c1", "canto_c2", "canto_l1", "canto_l2",
] as const;
export type Campo = (typeof CAMPOS_VALIDOS)[number];

const CAMPOS_OBLIGATORIOS: Campo[] = ["nombre", "largo", "ancho"];
const VALIDO_SET = new Set<string>(CAMPOS_VALIDOS);

export type Columna = Campo | null;

export function normalizarColumnas(columnas: Iterable<string | null | undefined>): Columna[] {
  const limpias: Columna[] = [];
  for (const columna of columnas) {
    if (columna === null || columna === undefined || String(columna).trim() === "") {
      limpias.push(null);
      continue;
    }
    const nombre = normalizarNombre(columna);
    if (!VALIDO_SET.has(nombre)) {
      throw new DataError(
        `columna desconocida: ${JSON.stringify(columna)}. Válidas: ${[...CAMPOS_VALIDOS]}`,
      );
    }
    limpias.push(nombre as Campo);
  }
  const faltantes = CAMPOS_OBLIGATORIOS.filter((c) => !limpias.includes(c));
  if (faltantes.length) throw new DataError(`faltan columnas obligatorias: ${faltantes}`);
  return limpias;
}

export function columnasDesdeEncabezado(encabezados: readonly string[]): Columna[] {
  const mapa = mapearColumnas([...encabezados]);
  if (Object.keys(mapa).length === 0) {
    throw new DataError(
      `no se reconoció ninguna columna en el encabezado: ${[...encabezados]}`,
    );
  }
  const posiciones: Columna[] = new Array(encabezados.length).fill(null);
  for (const [campo, indice] of Object.entries(mapa)) {
    posiciones[indice] = campo as Campo;
  }
  return normalizarColumnas(posiciones);
}

export function leerPiezas(
  filas: Iterable<readonly string[]>,
  columnas: readonly Columna[],
  options: { decimal?: string; nombreDefecto?: string } = {},
): Piece[] {
  const cols = [...columnas];
  const decimal = options.decimal;
  const nombreDefecto = options.nombreDefecto ?? "sin nombre";
  const piezas: Piece[] = [];
  let numero = 0;
  for (const fila of filas) {
    numero += 1;
    const valores: Record<string, string> = {};
    cols.forEach((columna, i) => {
      if (columna === null) return;
      valores[columna] = i < fila.length ? String(fila[i]).trim() : "";
    });
    try {
      piezas.push(piezaDesdeValores(valores, decimal, nombreDefecto, numero));
    } catch (err) {
      if (err instanceof DataError) throw new DataError(`fila ${numero}: ${err.message}`);
      throw err;
    }
  }
  return piezas;
}

function valor(valores: Record<string, string>, campo: string): string | null {
  const dato = valores[campo] ?? "";
  return dato === "" ? null : dato;
}

function piezaDesdeValores(
  valores: Record<string, string>,
  decimal: string | undefined,
  nombreDefecto: string,
  numero: number,
): Piece {
  return new PieceClass({
    nombre: valor(valores, "nombre") ?? `${nombreDefecto} ${numero}`,
    largo: aNumero(valor(valores, "largo"), decimal),
    ancho: aNumero(valor(valores, "ancho"), decimal),
    cantidad: aEntero(valor(valores, "cantidad"), decimal),
    espesor: aNumeroOpcional(valor(valores, "espesor"), decimal),
    material: valor(valores, "material"),
    veta: aBooleano(valor(valores, "veta")),
    grupo: valor(valores, "grupo"),
    etiqueta: valor(valores, "etiqueta"),
    notas: valor(valores, "notas"),
    cantos: {
      c1: valor(valores, "canto_c1"),
      c2: valor(valores, "canto_c2"),
      l1: valor(valores, "canto_l1"),
      l2: valor(valores, "canto_l2"),
    },
  });
}

function campoComoTexto(pieza: Piece, columna: string, decimal: string): string {
  switch (columna) {
    case "nombre": return pieza.nombre;
    case "largo": return formatearNumero(pieza.largo, decimal);
    case "ancho": return formatearNumero(pieza.ancho, decimal);
    case "espesor": return formatearNumero(pieza.espesor, decimal);
    case "cantidad": return String(pieza.cantidad);
    case "veta": return pieza.veta === null ? "" : pieza.veta ? "si" : "no";
    case "canto_c1": return pieza.cantos.c1 ?? "";
    case "canto_c2": return pieza.cantos.c2 ?? "";
    case "canto_l1": return pieza.cantos.l1 ?? "";
    case "canto_l2": return pieza.cantos.l2 ?? "";
    case "material": return pieza.material ?? "";
    case "grupo": return pieza.grupo ?? "";
    case "etiqueta": return pieza.etiqueta ?? "";
    case "notas": return pieza.notas ?? "";
    default: return "";
  }
}

export function escribirListado(
  piezas: readonly Piece[],
  columnas: readonly string[],
  options: { separador?: string; decimal?: string; encabezado?: boolean } = {},
): string {
  const separador = options.separador ?? ";";
  const decimal = options.decimal ?? ".";
  const encabezado = options.encabezado ?? true;
  const filas = piezas.map((pieza) =>
    columnas.map((columna) => campoComoTexto(pieza, columna, decimal)),
  );
  const encabezados = encabezado ? [...columnas] : [];
  return escribirTabla(encabezados, filas, separador);
}
