/**
 * OpenCutList (SketchUp) — CSV de piezas (importación y exportación).
 *
 * Documentación pública consultada:
 * - Exportar a CSV: https://docs.opencutlist.org/features/parts/export-to-csv
 * - Columnas y fórmulas: https://docs.opencutlist.org/features/parts/export-to-csv/customization
 * - Importar CSV: https://docs.opencutlist.org/features/import
 *
 * Verificado: separador tabulador/coma/punto y coma, UTF-8; al importar los
 * campos obligatorios son Designation, Length, Width, Thickness; Quantity,
 * Material y Tags son opcionales y sin columna de cantidad se asume 1.
 * No verificado: los títulos nativos de columna (configurables y traducibles) y
 * el uso de unidades dentro del archivo.
 */

import type { CutList } from "./model.js";
import { CutList as CutListClass, Piece, PARCIAL } from "./model.js";
import type { Source } from "./model.js";
import {
  DIRECCION_AMBOS,
  FormatDescriptor,
  FormatError,
  aEntero,
  aNumero,
  aNumeroOpcional,
  celda,
  escribirTabla,
  formatearNumero,
  leerTabla,
  mapearColumnas,
  propagarAvisos,
} from "./base.js";

export const CLAVE = "opencutlist";

const ENCABEZADOS_SALIDA = [
  "Designation", "Length", "Width", "Thickness", "Quantity", "Material", "Tags",
] as const;

const OBLIGATORIOS = ["nombre", "largo", "ancho", "espesor"] as const;

export const DESCRIPTOR = new FormatDescriptor({
  clave: CLAVE,
  nombre: "SketchUp / OpenCutList (CSV)",
  direccion: DIRECCION_AMBOS,
  estado: PARCIAL,
  fuentes: [
    {
      url: "https://docs.opencutlist.org/features/parts/export-to-csv",
      descripcion:
        "Documentación de OpenCutList: exportación a CSV/XLSX, separadores y codificación.",
    } satisfies Source,
    {
      url: "https://docs.opencutlist.org/features/import",
      descripcion:
        "Documentación de OpenCutList: importación CSV, campos obligatorios " +
        "(Designation, Length, Width, Thickness) y opcionales.",
    } satisfies Source,
    {
      url: "https://docs.opencutlist.org/features/parts/export-to-csv/customization",
      descripcion:
        "Columnas nativas, fórmulas y orden configurable; los títulos son editables por el usuario.",
    } satisfies Source,
  ],
  porRevisar: [
    "Los títulos de columna de una exportación real son configurables y " +
      "traducibles: el importador acepta encabezados en es/en, pero no se pudo " +
      "verificar el texto por defecto que escribe OpenCutList.",
    "Las dimensiones se escriben sin unidad; OpenCutList las interpreta en las " +
      "unidades del modelo, por lo que al importar hay que elegir milímetros.",
    "El archivo .skp (formato binario de SketchUp) no se lee: el camino " +
      "soportado es la exportación CSV de OpenCutList.",
  ],
  extensiones: [".csv"],
});

export interface ImportarOpciones {
  separador?: string;
  decimal?: string;
  encabezado?: boolean;
}

export function importar(texto: string, opciones: ImportarOpciones = {}): CutList {
  const separador = opciones.separador;
  const decimal = opciones.decimal;
  const encabezado = opciones.encabezado ?? true;
  const filas = leerTabla(texto, separador);
  if (filas.length === 0) throw new FormatError("el CSV está vacío");
  if (!encabezado) throw new FormatError("OpenCutList exporta con encabezado; hace falta el encabezado");
  const mapa = mapearColumnas(filas[0]);
  const faltantes = OBLIGATORIOS.filter((campo) => !(campo in mapa));
  if (faltantes.length) {
    throw new FormatError(
      "faltan columnas obligatorias de OpenCutList (Designation, Length, Width, " +
        "Thickness): " + faltantes.join(", ") + ` (encabezado: ${filas[0]})`,
    );
  }
  const lista = new CutListClass({ metadatos: { formato: CLAVE } });
  filas.slice(1).forEach((fila, i) => {
    const numero = i + 2;
    try {
      lista.agregar(piezaDesdeFila(fila, mapa, decimal));
    } catch (err) {
      throw new FormatError(`fila ${numero}: ${(err as Error).message}`);
    }
  });
  return propagarAvisos(DESCRIPTOR, lista);
}

function piezaDesdeFila(fila: string[], mapa: Record<string, number>, decimal?: string): Piece {
  const valor = (campo: string): string | null => celda(fila, mapa[campo]);
  const cantidad = valor("cantidad");
  return new Piece({
    nombre: valor("nombre") ?? "sin nombre",
    largo: aNumero(valor("largo"), decimal),
    ancho: aNumero(valor("ancho"), decimal),
    cantidad: cantidad ? aEntero(cantidad, decimal) : 1,
    espesor: aNumeroOpcional(valor("espesor"), decimal),
    material: valor("material"),
    etiqueta: valor("etiqueta"),
  });
}

export interface ExportarOpciones {
  separador?: string;
  decimal?: string;
  encabezado?: boolean;
  incluirEtiquetas?: boolean;
}

export function exportar(lista: unknown, opciones: ExportarOpciones = {}): string {
  const listaCorte = lista as CutList;
  const separador = opciones.separador ?? ";";
  const decimal = opciones.decimal ?? ".";
  const encabezado = opciones.encabezado ?? true;
  const incluirEtiquetas = opciones.incluirEtiquetas ?? true;
  const filas: string[][] = listaCorte.piezas.map((pieza) => [
    pieza.nombre,
    formatearNumero(pieza.largo, decimal),
    formatearNumero(pieza.ancho, decimal),
    formatearNumero(pieza.espesor, decimal),
    String(pieza.cantidad),
    pieza.material ?? "",
    incluirEtiquetas ? pieza.etiqueta ?? "" : "",
  ]);
  let encabezados: string[] = encabezado ? [...ENCABEZADOS_SALIDA] : [];
  if (!incluirEtiquetas) {
    filas.forEach((fila) => fila.pop());
    if (encabezados.length) encabezados = encabezados.slice(0, -1);
  }
  return escribirTabla(encabezados, filas, separador);
}
