/**
 * Promob — importación del listado de piezas (TXT/CSV).
 *
 * Documentación pública consultada:
 * - https://suporte.promob.com/hc/pt-br/articles/31120346591505-KB-Promob-Como-exportar-dados-do-orcamento-para-outros-softwares
 * - https://suporte.promob.com/hc/pt-br/articles/31117846533905-Cut-Pro-Configuracoes-de-Otimizadores-de-Corte
 * - https://cutplanning.tawk.help/article/promob-plus
 *
 * Verificado: Promob exporta la listagem como XML o TXT, y su módulo Cut Pro
 * genera un CSV para optimizadores con separador, decimal, unidad y cabecera
 * configurables por el usuario.
 * No verificado (formato «por revisar»): el esquema del XML de listagem y el
 * orden/columnas por defecto del CSV de cada optimizador. El importador exige
 * declarar las columnas y, si no, usa un orden por defecto marcado «por revisar».
 * No se implementa importador de XML: su estructura no está publicada.
 */

import type { CutList } from "./model.js";
import { CutList as CutListClass, POR_REVISAR } from "./model.js";
import type { Source } from "./model.js";
import { DIRECCION_IMPORT, FormatDescriptor, FormatError, leerTabla, propagarAvisos } from "./base.js";
import { columnasDesdeEncabezado, leerPiezas, normalizarColumnas } from "./listado.js";
import type { Columna } from "./listado.js";

export const CLAVE = "promob";

export const COLUMNAS_POR_DEFECTO = [
  "nombre", "cantidad", "largo", "ancho", "espesor", "material",
  "grupo", "veta", "canto_c1", "canto_c2", "canto_l1", "canto_l2",
];

export const DESCRIPTOR = new FormatDescriptor({
  clave: CLAVE,
  nombre: "Promob (listado TXT/CSV)",
  direccion: DIRECCION_IMPORT,
  estado: POR_REVISAR,
  fuentes: [
    {
      url: "https://suporte.promob.com/hc/pt-br/articles/31120346591505-KB-Promob-Como-exportar-dados-do-or%C3%A7amento-para-outros-softwares",
      descripcion: "Promob: «Enviar para» exporta a XML/TXT y a sistemas de plano de corte.",
    } satisfies Source,
    {
      url: "https://suporte.promob.com/hc/pt-br/articles/31117846533905-Cut-Pro-Configura%C3%A7%C3%B5es-de-Otimizadores-de-Corte",
      descripcion:
        "Promob Cut Pro: el archivo de integración es CSV y el separador, separador " +
        "decimal, unidad de medida, cabecera y columnas los configura el usuario por optimizador.",
    } satisfies Source,
    {
      url: "https://cutplanning.tawk.help/article/promob-plus",
      descripcion: "Ejemplo real de integración de un optimizador (Cut Planning) que importa la listagem XML o TXT de Promob.",
    } satisfies Source,
  ],
  porRevisar: [
    "El esquema del XML de listagem de Promob no está publicado: el importador " +
      "XML queda pendiente hasta tener una muestra real.",
    "Las columnas y su orden en el CSV de integración los define el usuario en " +
      "el Configurador de Cut Pro; sin `columnas=` se asume el orden " +
      COLUMNAS_POR_DEFECTO.join(", ") + ".",
    "Separador, separador decimal (por defecto se asume «;» y coma) y unidad de " +
      "medida son configurables en Promob y deben declararse si difieren.",
    "No está verificado que Promob importe listas de corte externas, así que no " +
      "se implementa exportación hacia Promob.",
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
          " (en Promob se configuran por optimizador).",
        DESCRIPTOR.fuentes[1].url,
      );
      datos = filas;
    } else {
      campos = normalizarColumnas(opciones.columnas);
      datos = filas;
    }
    const piezas = leerPiezas(datos, campos, { decimal: opciones.decimal });
    for (const pieza of piezas) lista.agregar(pieza);
  } catch (err) {
    throw new FormatError(`listado de Promob: ${(err as Error).message}`);
  }
  return propagarAvisos(DESCRIPTOR, lista);
}
