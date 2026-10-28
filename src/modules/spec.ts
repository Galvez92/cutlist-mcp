/**
 * Convierte una idea escrita a un módulo: ``"cajonera ancho=450 cajones=3"``.
 *
 * Sintaxis (propia de esta herramienta, no es un formato de intercambio):
 * ``tipo clave=valor clave=valor`` con el tipo entre los alias de
 * `./index.js`. Los valores numéricos aceptan unidades en mm; las listas
 * van en JSON (``posiciones_repisas=[500,1000]`` o ``alturas_frente="[110,180]"``);
 * las cadenas con espacios se entrecomillan (``nombre="Clóset pieza 2"``).
 */

import { ALIAS, MODULOS, construirParams, obtener } from "./index.js";
import type { ModuloRegistrado } from "./index.js";
import { ValueError } from "./parts.js";
import type { Modulo } from "./modulo.js";

/** Separa el texto en ``(tipo, valores)`` sin construir el módulo. */
export function parsear(texto: string): { tipo: string; valores: Record<string, string> } {
  if (!texto || !texto.trim()) {
    throw new ValueError("no se escribió ninguna idea");
  }
  const partes = texto.split(/\s+/).filter((p) => p.length > 0);
  const crudo = (partes[0] ?? "").toLowerCase();
  const dosPalabras = partes.length > 1 ? `${partes[0].toLowerCase()} ${partes[1].toLowerCase()}` : "";
  let tipo: string;
  let resto: string[];
  if (dosPalabras in ALIAS) {
    tipo = ALIAS[dosPalabras];
    resto = partes.slice(2);
  } else {
    tipo = ALIAS[crudo] ?? crudo;
    resto = partes.slice(1);
  }
  if (!(tipo in MODULOS)) {
    throw new ValueError(
      `módulo desconocido: ${JSON.stringify(crudo)}; disponibles: ${Object.keys(MODULOS).sort().join(", ")} ` +
        `(alias: ${Object.keys(ALIAS).sort().join(", ")})`,
    );
  }

  const valores: Record<string, string> = {};
  for (const trozo of separarEnPares(resto)) {
    if (!trozo.includes("=") && !trozo.includes(":")) {
      throw new ValueError(`parámetro sin valor: ${JSON.stringify(trozo)}; use clave=valor (ej. ancho=450)`);
    }
    const separador = trozo.includes("=") ? "=" : ":";
    const [claveRaw, valorRaw] = trozo.split(separador, 2);
    const clave = claveRaw.trim();
    if (!clave) {
      throw new ValueError(`parámetro sin nombre: ${JSON.stringify(trozo)}`);
    }
    if (clave in valores) {
      throw new ValueError(`parámetro repetido: ${clave}`);
    }
    valores[clave] = (valorRaw ?? "").trim();
  }
  return { tipo, valores };
}

/** Vuelve a unir los trozos que quedan dentro de comillas o corchetes. */
function separarEnPares(trozos: string[]): string[] {
  const pares: string[] = [];
  let actual = "";
  let profundidad = 0;
  let comillas: string | null = null;
  for (const trozo of trozos) {
    if (actual) actual += " ";
    actual += trozo;
    for (const caracter of trozo) {
      if (comillas) {
        if (caracter === comillas) comillas = null;
      } else if (caracter === "'" || caracter === '"') {
        comillas = caracter;
      } else if (caracter === "[" || caracter === "(") {
        profundidad += 1;
      } else if (caracter === "]" || caracter === ")") {
        profundidad -= 1;
      }
    }
    if (comillas === null && profundidad <= 0 && (actual.includes("=") || actual.includes(":"))) {
      pares.push(actual);
      actual = "";
      profundidad = 0;
    }
  }
  if (actual) pares.push(actual);
  return pares;
}

/** Genera el módulo validando parámetros contra el registro. */
export function construir(tipo: string, valores: Record<string, unknown> = {}): Modulo {
  const registro: ModuloRegistrado = obtener(tipo);
  return registro.generar(construirParams(registro, valores));
}

/** Atajo: idea escrita -> módulo. */
export function construirDesdeTexto(texto: string): Modulo {
  const { tipo, valores } = parsear(texto);
  return construir(tipo, valores);
}
