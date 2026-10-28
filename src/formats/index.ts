/**
 * Registro de formatos de importación/exportación.
 *
 * Cada formato declara su dirección, su estado de verificación y las fuentes
 * públicas consultadas. Los datos no verificados viajan con la lista de corte
 * como avisos «por revisar» (ver `src/formats/model.ts`).
 */

import { readFileSync, writeFileSync } from "node:fs";
import { extname } from "node:path";

import type { CutList, Notice } from "./model.js";
import { POR_REVISAR } from "./model.js";
import { FormatError, type FormatDescriptor } from "./base.js";
import * as cortecloud from "./cortecloud.js";
import * as csvGenerico from "./csv_generico.js";
import * as dxf from "./dxf.js";
import * as opencutlist from "./opencutlist.js";
import * as polyboard from "./polyboard.js";
import * as pro100 from "./pro100.js";
import * as promob from "./promob.js";

interface ModuloFormato {
  DESCRIPTOR: FormatDescriptor;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  importar?: (texto: string, opciones?: any) => CutList;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  exportar?: (objeto: unknown, opciones?: any) => string;
}

// Orden estable para listar_formatos() y formato_para_extension().
const MODULOS: ModuloFormato[] = [
  cortecloud, dxf, csvGenerico, opencutlist, polyboard, pro100, promob,
];

export const FORMATOS: Record<string, FormatDescriptor> = Object.fromEntries(
  MODULOS.map((m) => [m.DESCRIPTOR.clave, m.DESCRIPTOR]),
);

const MODULO_POR_CLAVE: Record<string, ModuloFormato> = Object.fromEntries(
  MODULOS.map((m) => [m.DESCRIPTOR.clave, m]),
);

export { FormatError, FormatDescriptor } from "./base.js";
export { CutList, Piece } from "./model.js";
export type { Notice, Source, EstadoVerificacion } from "./model.js";

export function claves(): string[] {
  return MODULOS.map((m) => m.DESCRIPTOR.clave);
}

export function listarFormatos(): FormatDescriptor[] {
  return MODULOS.map((m) => m.DESCRIPTOR);
}

export function descriptor(clave: string): FormatDescriptor {
  const d = FORMATOS[clave];
  if (!d) {
    throw new FormatError(
      `formato desconocido: ${JSON.stringify(clave)}. Disponibles: ${Object.keys(FORMATOS)}`,
    );
  }
  return d;
}

function modulo(clave: string): ModuloFormato {
  const m = MODULO_POR_CLAVE[clave];
  if (!m) {
    throw new FormatError(
      `formato desconocido: ${JSON.stringify(clave)}. Disponibles: ${Object.keys(MODULO_POR_CLAVE)}`,
    );
  }
  return m;
}

export function importar(
  texto: string,
  formato: string,
  opciones: Record<string, unknown> = {},
): CutList {
  const m = modulo(formato);
  if (!descriptor(formato).permiteImportar) {
    throw new FormatError(`el formato ${JSON.stringify(formato)} no tiene importador`);
  }
  return m.importar!(texto, opciones);
}

export function exportar(
  objeto: unknown,
  formato: string,
  opciones: Record<string, unknown> = {},
): string {
  const m = modulo(formato);
  if (!descriptor(formato).permiteExportar) {
    throw new FormatError(`el formato ${JSON.stringify(formato)} no tiene exportador`);
  }
  return m.exportar!(objeto, opciones);
}

export function formatoParaExtension(ruta: string): string | null {
  const sufijo = extname(ruta).toLowerCase();
  for (const m of MODULOS) {
    if (m.DESCRIPTOR.extensiones.includes(sufijo)) return m.DESCRIPTOR.clave;
  }
  return null;
}

export function importarArchivo(
  ruta: string,
  formato?: string,
  opciones: Record<string, unknown> = {},
): CutList {
  const clave = formato ?? formatoParaExtension(ruta);
  if (!clave) throw new FormatError(`no se pudo deducir el formato de ${JSON.stringify(ruta)}`);
  let texto = readFileSync(ruta, "utf8");
  if (texto.charCodeAt(0) === 0xfeff) texto = texto.slice(1);
  return importar(texto, clave, opciones);
}

export function exportarArchivo(
  objeto: unknown,
  ruta: string,
  formato?: string,
  opciones: Record<string, unknown> = {},
): string {
  const clave = formato ?? formatoParaExtension(ruta);
  if (!clave) throw new FormatError(`no se pudo deducir el formato de ${JSON.stringify(ruta)}`);
  const texto = exportar(objeto, clave, opciones);
  writeFileSync(ruta, texto, "utf8");
  return texto;
}

export function porRevisar(): Record<string, Notice[]> {
  const out: Record<string, Notice[]> = {};
  for (const clave of claves()) {
    const d = FORMATOS[clave];
    if (d.estado === POR_REVISAR) out[clave] = d.avisos();
  }
  return out;
}
