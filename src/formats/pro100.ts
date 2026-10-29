/**
 * PRO100 — importación del listado de piezas (TXT/CSV).
 *
 * Documentación pública consultada:
 * - https://cutlistplus.com/Support/CAD/Pro100
 * - https://sovetpro100.blogspot.com/2016/06/export-spiska-detaley-iz-programmi-pro100-v-raskroy-kuznetsova.html
 *
 * Verificado: PRO100 exporta un listado de piezas en texto/CSV legible por otras
 * aplicaciones, y ese listado NO incluye el tipo de material de cada pieza
 * (según CutList Plus).
 * No verificado: nombres de columna, orden, separador y decimales del archivo
 * exportado (no hay especificación pública). El importador exige declarar las
 * columnas y, si no, usa un orden por defecto marcado «por revisar».
 * No se implementa exportación: PRO100 no documenta importar listas externas.
 */

import type { CutList } from "./model.js";
import { CutList as CutListClass, POR_REVISAR } from "./model.js";
import type { Source } from "./model.js";
import { DIRECCION_IMPORT, FormatDescriptor, FormatError, leerTabla, propagarAvisos } from "./base.js";
import { columnasDesdeEncabezado, leerPiezas, normalizarColumnas } from "./listado.js";
import type { Columna } from "./listado.js";

export const CLAVE = "pro100";

export const COLUMNAS_POR_DEFECTO = ["nombre", "cantidad", "largo", "ancho", "espesor"];

export const DESCRIPTOR = new FormatDescriptor({
  clave: CLAVE,
  nombre: "PRO100 (listado TXT/CSV)",
  direccion: DIRECCION_IMPORT,
  estado: POR_REVISAR,
  fuentes: [
    {
      url: "https://cutlistplus.com/Support/CAD/Pro100",
      descripcion:
        "CutList Plus: PRO100 exporta la lista de piezas como CSV y ese archivo " +
        "no especifica el tipo de material de cada pieza.",
    } satisfies Source,
    {
      url: "https://sovetpro100.blogspot.com/2016/06/export-spiska-detaley-iz-programmi-pro100-v-raskroy-kuznetsova.html",
      descripcion:
        "Guía de usuario (ru): «Отчёты и расчёты» guarda el listado de piezas en " +
        "un archivo de texto que otra aplicación puede leer.",
    } satisfies Source,
  ],
  porRevisar: [
    "El layout del listado exportado (nombres de columna, orden, separador) no " +
      "está publicado: sin `columnas=` se asume el orden " +
      COLUMNAS_POR_DEFECTO.join(", ") + ".",
    "El archivo de PRO100 no incluye el tipo de material de cada pieza " +
      "(limitación documentada por CutList Plus): el material debe completarse " +
      "aparte si el listado no lo trae.",
    "El archivo de proyecto .pro100 es propietario y no se lee; el camino " +
      "soportado es el listado exportado.",
  ],
  extensiones: [".csv", ".txt"],
});

export interface ImportarOpciones {
  columnas?: readonly string[];
  encabezado?: boolean;
  separador?: string;
  decimal?: string;
}

export function importar(texto: string, opciones: ImportarOpciones = {}): CutList {
  const filas = leerTabla(texto, opciones.separador);
  if (filas.length === 0) throw new FormatError("el listado está vacío");
  const lista = new CutListClass({ metadatos: { formato: CLAVE, separador: opciones.separador ?? "auto" } });
  let campos: Columna[];
  let datos: string[][];
  try {
    if (opciones.encabezado) {
      campos = columnasDesdeEncabezado(filas[0]);
      datos = filas.slice(1);
    } else if (opciones.columnas === undefined) {
      campos = normalizarColumnas(COLUMNAS_POR_DEFECTO);
      lista.avisar(
        "Columnas declaradas por defecto " +
          campos.filter((c): c is NonNullable<Columna> => c !== null).join(", ") +
          " (layout del archivo PRO100 no publicado).",
        DESCRIPTOR.fuentes[0].url,
      );
      datos = filas;
    } else {
      campos = normalizarColumnas(opciones.columnas);
      datos = filas;
    }
    const piezas = leerPiezas(datos, campos, { decimal: opciones.decimal });
    for (const pieza of piezas) lista.agregar(pieza);
  } catch (err) {
    throw new FormatError(`listado de PRO100: ${(err as Error).message}`);
  }
  return propagarAvisos(DESCRIPTOR, lista);
}
