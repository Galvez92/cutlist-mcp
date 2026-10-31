/**
 * Cortecloud — JSON de piezas (importación y exportación).
 *
 * Fuente principal (documentación oficial de Serrabits):
 * https://cortecloud.com/api-docs/guias/json_import/
 *
 * Estructura documentada: `{"parts": [ {...} ]}` con `quantity`, `c`, `l`,
 * `function`, `complement`, `c1`/`c2`/`l1`/`l2` (texto del canto o `null`),
 * `material` y `machining` (furación/usinado).
 *
 * Lo no verificado se marca «por revisar» en `DESCRIPTOR`; ver
 * `docs/formatos/cortecloud.md`.
 */

import type { CutList } from "./model.js";
import { CutList as CutListClass, Piece } from "./model.js";
import { DIRECCION_AMBOS, FormatDescriptor, FormatError, propagarAvisos } from "./base.js";
import type { Source } from "./model.js";
import { PARCIAL } from "./model.js";

export const CLAVE = "cortecloud";

export const DESCRIPTOR = new FormatDescriptor({
  clave: CLAVE,
  nombre: "Cortecloud (JSON de piezas)",
  direccion: DIRECCION_AMBOS,
  estado: PARCIAL,
  fuentes: [
    {
      url: "https://cortecloud.com/api-docs/guias/json_import/",
      descripcion:
        "Guía oficial «Importar JSON Cortecloud» (Serrabits): estructura de " +
        "`parts`, atributos de furación/usinado y sistema de coordenadas.",
    } satisfies Source,
    {
      url: "tests/fixtures/cortecloud/escritorio_D_simple.json",
      descripcion: "Muestra real saneada (escritorio D, 30 piezas) usada en las pruebas.",
    } satisfies Source,
  ],
  porRevisar: [
    "La guía oficial no declara la unidad de medida de las dimensiones: se " +
      "asume milímetro (mm) según el proyecto.",
    "`c` = largo y `l` = ancho están en la tabla de campos de la guía oficial; " +
      "los lados siguen su sistema de coordenadas (C1 = 0-1, L1 = 1-2, " +
      "C2 = 2-3, L2 = 3-0, pieza vista por la cara interna).",
    "El bloque `machining` se conserva tal cual (ida y vuelta) sin interpretar " +
      "geometría ni validar cotas.",
  ],
  extensiones: [".json"],
});

function cargar(texto: string): Record<string, unknown> {
  let datos: unknown;
  try {
    datos = JSON.parse(texto);
  } catch (err) {
    throw new FormatError(`JSON inválido: ${(err as Error).message}`);
  }
  if (typeof datos !== "object" || datos === null || Array.isArray(datos)) {
    throw new FormatError("el JSON de Cortecloud debe ser un objeto con clave `parts`");
  }
  return datos as Record<string, unknown>;
}

function piezaDesdeJson(bruto: Record<string, unknown>, indice: number): Piece {
  const faltantes = (["c", "l"] as const).filter((campo) => bruto[campo] === null || bruto[campo] === undefined);
  if (faltantes.length) {
    throw new FormatError(`pieza #${indice}: faltan campos obligatorios ${faltantes}`);
  }
  const nombre = (bruto.function as string) || (bruto.complement as string) || `pieza ${indice}`;
  const cantidad = bruto.quantity ?? 1;
  const extra: Record<string, unknown> = {};
  for (const campo of ["machining", "startSide"] as const) {
    if (bruto[campo] !== undefined && bruto[campo] !== null) extra[campo] = bruto[campo];
  }
  return new Piece({
    nombre: String(nombre),
    largo: bruto.c as number,
    ancho: bruto.l as number,
    cantidad: cantidad as number,
    material: (bruto.material as string) ?? null,
    cantos: {
      c1: (bruto.c1 as string | null) ?? null,
      c2: (bruto.c2 as string | null) ?? null,
      l1: (bruto.l1 as string | null) ?? null,
      l2: (bruto.l2 as string | null) ?? null,
    },
    grupo: (bruto.complement as string) ?? null,
    extra,
  });
}

export interface ImportarOpciones {}

export function importar(texto: string, _opciones: ImportarOpciones = {}): CutList {
  const datos = cargar(texto);
  const partes = datos.parts;
  if (!Array.isArray(partes)) {
    throw new FormatError("el JSON debe tener una lista `parts`");
  }
  const lista = new CutListClass({ metadatos: { formato: CLAVE } });
  partes.forEach((bruto, i) => {
    const indice = i + 1;
    if (typeof bruto !== "object" || bruto === null || Array.isArray(bruto)) {
      throw new FormatError(`pieza #${indice}: se esperaba un objeto JSON`);
    }
    try {
      lista.agregar(piezaDesdeJson(bruto as Record<string, unknown>, indice));
    } catch (err) {
      if (err instanceof FormatError) throw err;
      throw new FormatError(`pieza #${indice}: ${(err as Error).message}`);
    }
  });
  for (const campo of ["serviceId", "projectId", "board"] as const) {
    if (datos[campo] !== undefined && datos[campo] !== null) {
      lista.metadatos[campo] = datos[campo];
    }
  }
  return propagarAvisos(DESCRIPTOR, lista);
}

function jsonDesdePieza(pieza: Piece): Record<string, unknown> {
  const cantos = pieza.cantos;
  const bruto: Record<string, unknown> = {
    quantity: pieza.cantidad,
    c: pieza.largo,
    l: pieza.ancho,
    function: pieza.nombre,
    complement: pieza.grupo,
    c1: cantos.c1 ?? null,
    c2: cantos.c2 ?? null,
    l1: cantos.l1 ?? null,
    l2: cantos.l2 ?? null,
    material: pieza.material,
  };
  for (const campo of ["machining", "startSide"] as const) {
    if (pieza.extra[campo] !== undefined && pieza.extra[campo] !== null) {
      bruto[campo] = pieza.extra[campo];
    }
  }
  return bruto;
}

export interface ExportarOpciones {
  sangria?: number;
}

export function exportar(lista: unknown, opciones: ExportarOpciones = {}): string {
  const listaCorte = lista as CutList;
  const sangria = opciones.sangria ?? 2;
  const documento = { parts: listaCorte.piezas.map(jsonDesdePieza) };
  return JSON.stringify(documento, null, sangria) + "\n";
}
