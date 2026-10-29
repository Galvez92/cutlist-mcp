/**
 * PolyBoard (Wood Designer) — importación de la lista de corte CSV/TXT.
 *
 * Documentación pública consultada:
 * - https://wooddesigner.org/help-centre/polyboard-cutting-list-export/
 * - https://wooddesigner.org/formating-cutting-lists-for-other-applications/
 *
 * Verificado: la lista se exporta a .csv/.txt y los campos, orden, separador y
 * decimales se configuran en Cutting list options > Format.
 * No verificado: columnas/orden por defecto, separador decimal por defecto y el
 * efecto de las opciones Overall vs net / Including oversizing / Grouped. Por
 * eso el importador exige declarar las columnas y, si no, usa un orden por
 * defecto marcado «por revisar».
 * No se implementa exportación: PolyBoard no documenta importar listas externas.
 */

import type { CutList } from "./model.js";
import { CutList as CutListClass, PARCIAL } from "./model.js";
import type { Source } from "./model.js";
import { DIRECCION_IMPORT, FormatDescriptor, FormatError, leerTabla, propagarAvisos } from "./base.js";
import { columnasDesdeEncabezado, leerPiezas, normalizarColumnas } from "./listado.js";
import type { Columna } from "./listado.js";

export const CLAVE = "polyboard";

// Orden asumido mientras no se verifique con un archivo real (ver porRevisar).
export const COLUMNAS_POR_DEFECTO = ["nombre", "largo", "ancho", "cantidad", "espesor", "material"];

export const DESCRIPTOR = new FormatDescriptor({
  clave: CLAVE,
  nombre: "PolyBoard (lista de corte CSV/TXT)",
  direccion: DIRECCION_IMPORT,
  estado: PARCIAL,
  fuentes: [
    {
      url: "https://wooddesigner.org/help-centre/polyboard-cutting-list-export/",
      descripcion:
        "Wood Designer: exportación de la lista de corte a CSV/TXT y opciones de formato (campos, orden, separador).",
    } satisfies Source,
    {
      url: "https://wooddesigner.org/formating-cutting-lists-for-other-applications/",
      descripcion: "Wood Designer: 2 vías de salida (ASCII y PP Report) para otras aplicaciones.",
    } satisfies Source,
  ],
  porRevisar: [
    "No hay conjunto ni orden de columnas por defecto publicados: sin " +
      "`columnas=` el importador usa " + COLUMNAS_POR_DEFECTO.join(", ") + " (orden asumido).",
    "Se asume separador «;» (la captura oficial muestra «;») y decimal coma; " +
      "ambos son configurables en PolyBoard.",
    "Según las opciones *Overall vs net dimensions*, *Including oversizing* y " +
      "*Grouped vs individual*, las cotas pueden ser brutas o netas y las piezas " +
      "idénticas pueden venir agrupadas o sueltas; no está verificado cuál es la " +
      "salida por defecto.",
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
          " (PolyBoard permite configurar campos y orden).",
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
    throw new FormatError(`listado de PolyBoard: ${(err as Error).message}`);
  }
  return propagarAvisos(DESCRIPTOR, lista);
}
