/**
 * Escritorio (con faldón) paramétrico.
 *
 * Geometría (mm, medidas exteriores)
 * ----------------------------------
 * - ``ancho``, ``fondo`` y ``alto`` exteriores. La cubierta es el tablero de
 *   arriba; los costados son paneles que corren todo el fondo y sostienen la
 *   cubierta.
 * - El **faldón** es el travesaño frontal bajo la cubierta, entre los costados:
 *   su alto es ``faldon`` y **debe ser ≥ 70 mm** (requisito del usuario). El
 *   travesaño trasero da rigidez y permite fijar el escritorio a muro.
 * - El alto del travesaño del fixture de Cortecloud
 *   (`tests/fixtures/cortecloud/escritorio_D_simple.json`) es 100 mm; el
 *   faldón central del mismo fixture es 65 mm, pero aquí se exige ≥ 70 mm por
 *   requerimiento explícito.
 *
 * Convención de cantos: ver `docs/modulos-parametricos.md`. En la cubierta
 * (horizontal) la arista frontal se marca en ``ancho_a`` y los laterales en
 * ``largo_a``/``largo_b``; en los costados (verticales) la arista frontal en
 * ``largo_a``; en el faldón la arista inferior en ``ancho_b``.
 */

import { Accesorio, Modulo } from "./modulo.js";
import {
  CANTO_DEFAULT,
  MATERIAL_DEFAULT,
  exigirPositivo,
  frentes,
} from "./common.js";
import { Cantos, Pieza, ValueError } from "./parts.js";

export const FALDON_MINIMO = 70.0;

export const CAMPOS: Record<string, string> = {
  ancho: "Ancho exterior del escritorio (mm)",
  fondo: "Profundidad del escritorio (mm)",
  alto: "Alto exterior total, piso a cara superior de la cubierta (mm)",
  faldon: "Alto del faldón frontal (mm) — mínimo 70",
  espesor: "Espesor del tablero del cuerpo (mm)",
  espesor_cubierta: "Espesor del tablero de la cubierta (mm); 0 = igual al cuerpo",
  material: "Texto del material del cuerpo (como en el despiece)",
  material_cubierta: "Texto del material de la cubierta; vacío = igual al cuerpo",
  canto: "Texto del canto de las aristas vistas del cuerpo",
  canto_cubierta: "Texto del canto de la cubierta; vacío = igual al del cuerpo",
  nombre: "Nombre del módulo para el despiece",
};

export interface ParamsEscritorio {
  ancho?: number;
  fondo?: number;
  alto?: number;
  faldon?: number;
  espesor?: number;
  espesorCubierta?: number;
  material?: string;
  materialCubierta?: string;
  canto?: string;
  cantoCubierta?: string;
  nombre?: string;
}

export const DEFAULTS_ESCRITORIO: Required<Omit<ParamsEscritorio, "nombre" | "materialCubierta" | "cantoCubierta">> & {
  nombre: string;
  materialCubierta: string;
  cantoCubierta: string;
} = {
  ancho: 1200.0,
  fondo: 600.0,
  alto: 750.0,
  faldon: 100.0,
  espesor: 18.0,
  espesorCubierta: 18.0,
  material: MATERIAL_DEFAULT,
  materialCubierta: "",
  canto: CANTO_DEFAULT,
  cantoCubierta: "",
  nombre: "",
};

export function generar(params: ParamsEscritorio = {}): Modulo {
  const p = { ...DEFAULTS_ESCRITORIO, ...params };
  exigirPositivo({
    ancho: p.ancho,
    fondo: p.fondo,
    alto: p.alto,
    faldon: p.faldon,
    espesor: p.espesor,
  });
  if (p.faldon < FALDON_MINIMO) {
    throw new ValueError(
      `el faldón de ${p.faldon.toFixed(0)} mm es menor al mínimo de ${FALDON_MINIMO.toFixed(0)} mm`,
    );
  }

  const [material, materialCubierta, canto, cantoCubierta] = frentes(
    p.material,
    p.materialCubierta,
    p.canto,
    p.cantoCubierta,
  );
  const espesorCubierta = p.espesorCubierta || p.espesor;
  const nombre =
    p.nombre || `Escritorio ${p.ancho.toFixed(0)}x${p.fondo.toFixed(0)}x${p.alto.toFixed(0)}`;
  const anchoInterior = p.ancho - 2 * p.espesor;
  if (anchoInterior <= 0) {
    throw new ValueError("el ancho exterior no deja interior entre costados");
  }
  const altoCostado = p.alto - espesorCubierta;
  if (altoCostado <= 0) {
    throw new ValueError("el espesor de la cubierta no deja alto para los costados");
  }
  if (p.faldon > altoCostado) {
    throw new ValueError(
      `el faldón (${p.faldon.toFixed(0)} mm) no cabe en el alto del costado (${altoCostado.toFixed(0)} mm)`,
    );
  }

  const comun = { espesor: p.espesor, material, modulo: nombre };

  const piezas: Pieza[] = [
    // Cubierta: ancho × fondo, canto en el frente y los dos costados.
    new Pieza({
      nombre: "Cubierta",
      largo: p.fondo,
      ancho: p.ancho,
      espesor: espesorCubierta,
      material: materialCubierta,
      rol: "cubierta",
      cantos: new Cantos(cantoCubierta, cantoCubierta, cantoCubierta),
      veta: "ancho",
      funcion: "Cubierta del escritorio — canto en el frente y los dos costados",
      modulo: nombre,
    }),
    // Costados: corren todo el fondo, alto = total − cubierta.
    new Pieza({
      nombre: "Costado",
      largo: altoCostado,
      ancho: p.fondo,
      cantidad: 2,
      rol: "costado",
      cantos: new Cantos(canto),
      funcion: "Costado del escritorio — canto en la arista frontal",
      ...comun,
    }),
    // Faldón: travesaño frontal entre costados, alto = faldon.
    new Pieza({
      nombre: "Faldón",
      largo: anchoInterior,
      ancho: p.faldon,
      rol: "faldon",
      cantos: new Cantos(undefined, undefined, undefined, canto),
      funcion: `Faldón frontal entre costados — canto en la arista inferior (${p.faldon.toFixed(0)} mm, ≥ ${FALDON_MINIMO.toFixed(0)} mm)`,
      ...comun,
    }),
    // Travesaño trasero: rigidez, sin canto.
    new Pieza({
      nombre: "Travesaño trasero",
      largo: anchoInterior,
      ancho: p.faldon,
      rol: "travesaño",
      funcion: "Travesaño trasero de rigidez entre costados — permite fijar a muro",
      ...comun,
    }),
  ];

  const notas: string[] = [
    `Faldón de ${p.faldon.toFixed(0)} mm (mínimo ${FALDON_MINIMO.toFixed(0)} mm).`,
    "El travesaño trasero da rigidez al escritorio y permite fijarlo a muro.",
    `Costados de ${p.fondo.toFixed(0)} mm de fondo y ${altoCostado.toFixed(0)} mm de alto ` +
      `(total ${p.alto.toFixed(0)} mm menos ${espesorCubierta.toFixed(0)} mm de cubierta).`,
  ];

  const accesorios = [
    new Accesorio("Tornillo de armado", 1, "Costados, cubierta, faldón y travesaño"),
    new Accesorio("Nivelador o regleta", 2, "Opcional, bajo cada costado"),
    new Accesorio("Tirador o manija", 1, "Si el cajón lleva frente cubriente"),
  ];

  return new Modulo(
    "escritorio",
    nombre,
    {
      ancho: p.ancho,
      fondo: p.fondo,
      alto: p.alto,
      faldon: p.faldon,
      ancho_interior: anchoInterior,
      alto_costado: altoCostado,
    },
    piezas,
    accesorios,
    notas,
  );
}
