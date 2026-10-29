/**
 * CSV genérico — formato propio de cutlist-mcp (importación y exportación).
 *
 * Especificado en `docs/formatos/csv-generico.md`: encabezado obligatorio, un
 * registro por pieza, separador y decimal configurables. Al ser un formato
 * propio y documentado por el proyecto, su estado es *verificado*.
 */

import type { CutList } from "./model.js";
import { CutList as CutListClass, Piece, VERIFICADO } from "./model.js";
import type { Source } from "./model.js";
import {
  DIRECCION_AMBOS,
  FormatDescriptor,
  FormatError,
  aBooleano,
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

export const CLAVE = "csv_generico";

export const ENCABEZADOS = [
  "nombre", "largo", "ancho", "cantidad", "espesor", "material", "veta",
  "grupo", "etiqueta", "notas", "canto_c1", "canto_c2", "canto_l1", "canto_l2",
] as const;

const OBLIGATORIOS = ["nombre", "largo", "ancho"] as const;

export const DESCRIPTOR = new FormatDescriptor({
  clave: CLAVE,
  nombre: "CSV genérico (formato propio)",
  direccion: DIRECCION_AMBOS,
  estado: VERIFICADO,
  fuentes: [
    {
      url: "docs/formatos/csv-generico.md",
      descripcion:
        "Especificación del formato CSV propio: columnas, obligatoriedad, " +
        "unidad (mm) y convención de cantos C/L.",
    } satisfies Source,
  ],
  extensiones: [".csv", ".txt"],
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
  if (!encabezado) throw new FormatError("el CSV genérico requiere encabezado de columnas");
  const mapa = mapearColumnas(filas[0]);
  const faltantes = OBLIGATORIOS.filter((campo) => !(campo in mapa));
  if (faltantes.length) {
    throw new FormatError(
      "faltan columnas obligatorias: " + faltantes.join(", ") +
        ` (encabezado leído: ${filas[0]})`,
    );
  }
  const lista = new CutListClass({ metadatos: { formato: CLAVE, separador: separador ?? "auto" } });
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
  return new Piece({
    nombre: valor("nombre") ?? "sin nombre",
    largo: aNumero(valor("largo"), decimal),
    ancho: aNumero(valor("ancho"), decimal),
    cantidad: aEntero(valor("cantidad"), decimal),
    espesor: aNumeroOpcional(valor("espesor"), decimal),
    material: valor("material"),
    veta: aBooleano(valor("veta")),
    grupo: valor("grupo"),
    etiqueta: valor("etiqueta"),
    notas: valor("notas"),
    cantos: {
      c1: valor("canto_c1"),
      c2: valor("canto_c2"),
      l1: valor("canto_l1"),
      l2: valor("canto_l2"),
    },
  });
}

export interface ExportarOpciones {
  separador?: string;
  decimal?: string;
  encabezado?: boolean;
  unidad?: boolean;
}

export function exportar(lista: unknown, opciones: ExportarOpciones = {}): string {
  const listaCorte = lista as CutList;
  const separador = opciones.separador ?? ";";
  const decimal = opciones.decimal ?? ",";
  const encabezado = opciones.encabezado ?? true;
  const unidad = opciones.unidad ?? false;
  const filas: string[][] = listaCorte.piezas.map((pieza) => {
    const cantos = pieza.cantos;
    return [
      pieza.nombre,
      formatearNumero(pieza.largo, decimal),
      formatearNumero(pieza.ancho, decimal),
      String(pieza.cantidad),
      formatearNumero(pieza.espesor, decimal),
      pieza.material ?? "",
      pieza.veta === null ? "" : pieza.veta ? "si" : "no",
      pieza.grupo ?? "",
      pieza.etiqueta ?? "",
      pieza.notas ?? "",
      cantos.c1 ?? "",
      cantos.c2 ?? "",
      cantos.l1 ?? "",
      cantos.l2 ?? "",
    ];
  });
  let encabezados: string[] = encabezado ? [...ENCABEZADOS] : [];
  if (unidad) {
    encabezados = encabezados.map((c) =>
      c === "largo" || c === "ancho" || c === "espesor" ? `${c}_mm` : c,
    );
  }
  return escribirTabla(encabezados, filas, separador);
}
