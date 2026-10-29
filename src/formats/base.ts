/**
 * Contrato común de los importadores/exportadores y utilidades de tabla.
 *
 * Cada módulo de formato expone:
 * - `DESCRIPTOR`: `FormatDescriptor` con el estado de verificación y las fuentes
 *   públicas consultadas.
 * - `importar(texto, opciones)`: `CutList` (si el formato se puede leer).
 * - `exportar(lista, opciones)`: `string` (si el formato se puede escribir).
 *
 * Regla del proyecto: ningún formato se inventa. Lo no verificado en
 * documentación pública se declara en `FormatDescriptor.porRevisar` y se
 * propaga a la `CutList` como `Notice` «por revisar».
 */

import type { EstadoVerificacion, Notice, Source } from "./model.js";
import { CutList, DataError, POR_REVISAR } from "./model.js";

export const DIRECCION_IMPORT = "import";
export const DIRECCION_EXPORT = "export";
export const DIRECCION_AMBOS = "ambos";
export type Direccion = typeof DIRECCION_IMPORT | typeof DIRECCION_EXPORT | typeof DIRECCION_AMBOS;

const DQ = '"';

/** El contenido no corresponde al formato esperado. */
export class FormatError extends DataError {
  constructor(message: string) {
    super(message);
    this.name = "FormatError";
  }
}

/** Metadatos de un formato: dirección, estado de verificación y fuentes. */
export class FormatDescriptor {
  readonly clave: string;
  readonly nombre: string;
  readonly direccion: Direccion;
  readonly estado: EstadoVerificacion;
  readonly fuentes: readonly Source[];
  readonly porRevisar: readonly string[];
  readonly extensiones: readonly string[];

  constructor(args: {
    clave: string;
    nombre: string;
    direccion: Direccion;
    estado: EstadoVerificacion;
    fuentes: readonly Source[];
    porRevisar?: readonly string[];
    extensiones?: readonly string[];
  }) {
    this.clave = args.clave;
    this.nombre = args.nombre;
    this.direccion = args.direccion;
    this.estado = args.estado;
    this.fuentes = args.fuentes;
    this.porRevisar = args.porRevisar ?? [];
    this.extensiones = args.extensiones ?? [];
  }

  avisos(): Notice[] {
    const fuente = this.fuentes.length ? this.fuentes[0].url : null;
    return this.porRevisar.map((mensaje) => ({ mensaje, fuente, estado: POR_REVISAR }));
  }

  get permiteImportar(): boolean {
    return this.direccion === DIRECCION_IMPORT || this.direccion === DIRECCION_AMBOS;
  }

  get permiteExportar(): boolean {
    return this.direccion === DIRECCION_EXPORT || this.direccion === DIRECCION_AMBOS;
  }
}

// --------------------------------------------------------------------------- //
// Alias de columnas (es / en / pt)
// --------------------------------------------------------------------------- //

export const ALIAS_CAMPOS: Record<string, readonly string[]> = {
  nombre: [
    "nombre", "nome", "name", "designation", "designacion", "designacao",
    "pieza", "part", "descripcion", "description", "funcion", "function",
    "item", "componente", "component",
  ],
  largo: ["largo", "largo_mm", "length", "longitud", "comprimento", "compr", "long"],
  ancho: ["ancho", "ancho_mm", "width", "largura", "anchura"],
  cantidad: [
    "cantidad", "quantity", "qty", "cant", "quantidade", "qtde", "pcs",
    "piezas", "count",
  ],
  espesor: ["espesor", "espesor_mm", "thickness", "espessura", "thick"],
  material: ["material", "material_name", "materialname", "mat"],
  veta: ["veta", "grain", "veio", "grain_direction", "sentido"],
  grupo: [
    "grupo", "complement", "complemento", "modulo", "module", "movel",
    "cabinet", "ambiente",
  ],
  notas: ["notas", "notes", "observaciones", "obs", "observacao"],
  etiqueta: ["etiqueta", "tags", "tag", "labels", "label"],
  canto_c1: ["canto_c1", "canto1", "edge_c1", "edge1", "c1", "borde_c1"],
  canto_c2: ["canto_c2", "canto2", "edge_c2", "edge2", "c2", "borde_c2"],
  canto_l1: ["canto_l1", "edge_l1", "l1", "borde_l1"],
  canto_l2: ["canto_l2", "edge_l2", "l2", "borde_l2"],
};

const ACENTOS: Record<string, string> = {
  "\u00e1": "a", "\u00e9": "e", "\u00ed": "i", "\u00f3": "o", "\u00fa": "u",
  "\u00fc": "u", "\u00e0": "a", "\u00e2": "a", "\u00e3": "a", "\u00e7": "c",
  "\u00f1": "n", "\u00ea": "e", "\u00f4": "o", "\u00f5": "o",
};

export function normalizarNombre(texto: string): string {
  let t = String(texto).trim().toLowerCase();
  for (const [origen, destino] of Object.entries(ACENTOS)) {
    t = t.split(origen).join(destino);
  }
  t = t.replace(/[^a-z0-9]+/g, "_");
  return t.replace(/^_+|_+$/g, "");
}

export function mapearColumnas(encabezados: string[]): Record<string, number> {
  const aliasInverso: Record<string, string> = {};
  for (const [campo, alias] of Object.entries(ALIAS_CAMPOS)) {
    for (const a of alias) aliasInverso[a] = campo;
  }
  const mapa: Record<string, number> = {};
  encabezados.forEach((encabezado, indice) => {
    const campo = aliasInverso[normalizarNombre(encabezado)];
    if (campo && !(campo in mapa)) mapa[campo] = indice;
  });
  return mapa;
}

// --------------------------------------------------------------------------- //
// Conversión de valores
// --------------------------------------------------------------------------- //

const NUMERO_RE = /[-+]?\d[\d\s\u00a0.,]*/;

function inferirDecimal(texto: string): string {
  if (texto.includes(",") && texto.includes(".")) {
    return texto.lastIndexOf(",") > texto.lastIndexOf(".") ? "," : ".";
  }
  return texto.includes(",") ? "," : ".";
}

export function aNumero(valor: unknown, decimal?: string): number {
  if (typeof valor === "boolean") throw new DataError(`no es un número: ${JSON.stringify(valor)}`);
  if (typeof valor === "number") return valor;
  if (valor === null || valor === undefined) throw new DataError("falta un valor numérico");
  const texto = String(valor).trim();
  if (texto === "") throw new DataError("falta un valor numérico");
  const coincidencia = NUMERO_RE.exec(texto);
  if (!coincidencia) throw new DataError(`no es un número: ${JSON.stringify(valor)}`);
  let limpio = coincidencia[0].replace(/\u00a0/g, "").replace(/ /g, "");
  const separador = decimal ?? inferirDecimal(limpio);
  if (separador === ",") limpio = limpio.split(".").join("").replace(",", ".");
  else limpio = limpio.split(",").join("");
  const n = Number(limpio);
  if (!Number.isFinite(n)) throw new DataError(`no es un número: ${JSON.stringify(valor)}`);
  return n;
}

export function aNumeroOpcional(valor: unknown, decimal?: string): number | null {
  if (valor === null || valor === undefined || String(valor).trim() === "") return null;
  return aNumero(valor, decimal);
}

export function aEntero(valor: unknown, decimal?: string, defecto = 1): number {
  if (valor === null || valor === undefined || String(valor).trim() === "") return defecto;
  const numero = aNumero(valor, decimal);
  if (numero < 1) throw new DataError(`cantidad inválida: ${JSON.stringify(valor)}`);
  return Math.round(numero);
}

const TRUE_SET = new Set(["1", "si", "s\u00ed", "s", "true", "t", "yes", "y", "x", "con", "sim"]);
const FALSE_SET = new Set(["0", "no", "n", "false", "f", "sin", "nao", "n\u00e3o"]);

export function aBooleano(valor: unknown): boolean | null {
  if (valor === null || valor === undefined) return null;
  const texto = normalizarNombre(String(valor));
  if (texto === "") return null;
  if (TRUE_SET.has(texto)) return true;
  if (FALSE_SET.has(texto)) return false;
  return null;
}

export function formatearNumero(valor: number | null, decimal = "."): string {
  if (valor === null || valor === undefined) return "";
  const n = Number(valor);
  if (Number.isInteger(n)) return String(n);
  let t = String(Math.round((n + Number.EPSILON) * 10000) / 10000);
  if (t.includes(".")) t = t.replace(/0+$/, "").replace(/\.$/, "");
  return decimal === "," ? t.replace(".", ",") : t;
}

// --------------------------------------------------------------------------- //
// Lectura y escritura de tablas
// --------------------------------------------------------------------------- //

export const SEPARADORES: readonly string[] = [";", ",", "\t", "|"];

export function detectarSeparador(texto: string, porDefecto = ";"): string {
  for (const linea of texto.split(/\r\n|\r|\n/)) {
    if (linea.trim() === "") continue;
    const conteos: Record<string, number> = {};
    for (const s of SEPARADORES) conteos[s] = linea.split(s).length - 1;
    let mejor = SEPARADORES[0];
    for (const s of SEPARADORES) if (conteos[s] > conteos[mejor]) mejor = s;
    if (conteos[mejor] > 0) return mejor;
    if (linea.split(/\s+/).length > 1) return " ";
    return porDefecto;
  }
  return porDefecto;
}

/** Parsea una línea delimitada respetando comillas dobles (quotechar `"`). */
function parsearFila(linea: string, separador: string): string[] {
  const celdas: string[] = [];
  let actual = "";
  let entreComillas = false;
  for (let i = 0; i < linea.length; i++) {
    const ch = linea[i];
    if (entreComillas) {
      if (ch === DQ) {
        if (linea[i + 1] === DQ) {
          actual += DQ;
          i++;
        } else {
          entreComillas = false;
        }
      } else {
        actual += ch;
      }
    } else if (ch === DQ) {
      entreComillas = true;
    } else if (ch === separador) {
      celdas.push(actual.trim());
      actual = "";
    } else {
      actual += ch;
    }
  }
  celdas.push(actual.trim());
  return celdas;
}

export function leerTabla(
  texto: string,
  separador?: string,
  ignorarComentarios = true,
): string[][] {
  const sep = separador ?? detectarSeparador(texto);
  const lineas = texto.split(/\r\n|\r|\n/).filter((linea) => {
    const limpia = linea.trim();
    if (limpia === "") return false;
    if (ignorarComentarios && linea.replace(/^\s+/, "").startsWith("#")) return false;
    return true;
  });
  if (sep === " ") return lineas.map((linea) => linea.trim().split(/\s+/));
  return lineas.map((linea) => parsearFila(linea, sep));
}

export function celda(fila: string[], indice: number | undefined, defecto: string | null = null): string | null {
  if (indice === undefined || indice >= fila.length) return defecto;
  const valor = fila[indice].trim();
  return valor === "" ? defecto : valor;
}

function necesitaComillas(campo: string, separador: string): boolean {
  return (
    campo.includes(separador) ||
    campo.includes(DQ) ||
    campo.includes("\r") ||
    campo.includes("\n")
  );
}

function entrecomillar(campo: string): string {
  return DQ + campo.split(DQ).join(DQ + DQ) + DQ;
}

export function escribirTabla(
  encabezados: string[],
  filas: string[][],
  separador = ";",
  finLinea = "\r\n",
): string {
  const escribirFila = (fila: string[]): string =>
    fila
      .map((campo) => (necesitaComillas(campo, separador) ? entrecomillar(campo) : campo))
      .join(separador);
  const lineas: string[] = [];
  if (encabezados.length) lineas.push(escribirFila(encabezados));
  for (const fila of filas) lineas.push(escribirFila(fila));
  return lineas.join(finLinea);
}

export function propagarAvisos(descriptor: FormatDescriptor, lista: CutList): CutList {
  lista.origen = descriptor.clave;
  lista.avisos.push(...descriptor.avisos());
  return lista;
}
