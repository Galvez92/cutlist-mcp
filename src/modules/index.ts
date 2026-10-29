/** Registro de módulos paramétricos: cajonera, clóset, cocina y librero. */

import type { Modulo } from "./modulo.js";
import * as cajon from "./cajon.js";
import * as cajonera from "./cajonera.js";
import * as closet from "./closet.js";
import * as cocina from "./cocina.js";
import * as escritorio from "./escritorio.js";
import * as librero from "./librero.js";
import { ValueError } from "./parts.js";

/** Tipos simples expuestos a la vista previa (igual que el Python original). */
export type TipoCampo = "float" | "int" | "bool" | "texto" | "lista" | "float_opcional";

/** Descriptor de un parámetro de módulo. */
export interface CampoParam {
  /** Clave pública (snake_case, la que usa la idea escrita y la API). */
  nombre: string;
  /** Clave interna (camelCase) en la interfaz de parámetros. */
  campo: string;
  tipo: TipoCampo;
  default: number | number[] | boolean | string | null;
  descripcion: string;
}

export interface CampoUi {
  nombre: string;
  anotacion: string;
  tipo: TipoCampo;
  default: number | number[] | boolean | string | null;
  descripcion: string;
}

/** Un tipo de módulo: título, parámetros y generador. */
export class ModuloRegistrado {
  constructor(
    readonly tipo: string,
    readonly titulo: string,
    readonly descripcion: string,
    readonly campos: readonly CampoParam[],
    readonly generar: (params?: Record<string, unknown>) => Modulo,
  ) {}

  /** Parámetros con tipo, valor por omisión y descripción (para la vista previa). */
  camposUi(): CampoUi[] {
    return this.campos.map((c) => ({
      nombre: c.nombre,
      anotacion: c.tipo,
      tipo: c.tipo,
      default: c.default,
      descripcion: c.descripcion,
    }));
  }
}

const caj = (nombre: string, campo: string, tipo: TipoCampo, def: number | number[] | boolean | string | null, descripcion: string): CampoParam => ({
  nombre,
  campo,
  tipo,
  default: def,
  descripcion,
});

const CAMPOS_CAJON: CampoParam[] = [
  caj("ancho", "ancho", "float", 600.0, "Ancho exterior de la caja del cajón (mm)"),
  caj("fondo", "fondo", "float", 500.0, "Profundidad del cajón, largo del lateral (mm)"),
  caj("alto", "alto", "float", 150.0, "Alto del lateral del cajón (mm)"),
  caj("espesor", "espesor", "float", 18.0, "Espesor del tablero del cuerpo (mm)"),
  caj("fondo_espesor", "fondoEspesor", "float", 3.0, "Espesor del panel del fondo (mm); 0 = sin fondo"),
  caj("ranura_ancho", "ranuraAncho", "float", 6.7, "Ancho de la ranura del fondo (mm) — debe estar en las permitidas del perfil"),
  caj("ranura_distancia", "ranuraDistancia", "float", 15.0, "Distancia de la ranura desde el borde inferior (mm)"),
  caj("ranura_profundidad", "ranuraProfundidad", "float", 10.0, "Profundidad de la ranura en la cara interior (mm)"),
  caj("distancia_minifix", "distanciaMinifix", "float", 50.0, "Distancia de los minifix desde las orillas superior e inferior (mm)"),
  caj("material", "material", "texto", "Melamina 18 mm", "Texto del material del cuerpo (como en el despiece)"),
  caj("material_fondo", "materialFondo", "texto", "MDF 3 mm", "Texto del material del fondo"),
  caj("canto", "canto", "texto", "PVC 0.4 mm", "Texto del canto de las aristas vistas"),
  caj("nombre", "nombre", "texto", "", "Nombre del módulo para el despiece"),
];

const CAMPOS_CAJONERA: CampoParam[] = [
  caj("ancho", "ancho", "float", 450.0, "Ancho exterior, de costado a costado (mm)"),
  caj("alto", "alto", "float", 800.0, "Alto exterior total (mm)"),
  caj("fondo", "fondo", "float", 500.0, "Profundidad del costado (mm)"),
  caj("cajones", "cajones", "int", 4, "Cantidad de cajones"),
  caj("espesor", "espesor", "float", 18.0, "Espesor del tablero del cuerpo (mm)"),
  caj("trasera_espesor", "traseraEspesor", "float", 3.0, "Espesor de la trasera (mm); 0 = sin trasera"),
  caj("juego", "juego", "float", 3.0, "Holgura entre frentes (mm) — por revisar"),
  caj("juego_corredera", "juegoCorredera", "float", 25.0, "Juego lateral total de la corredera (mm) — por revisar"),
  caj("margen_alto_cajon", "margenAltoCajon", "float", 20.0, "Diferencia de alto entre frente y caja del cajón (mm) — por revisar"),
  caj("juego_fondo", "juegoFondo", "float", 10.0, "Holgura entre el fondo de la caja y la trasera (mm)"),
  caj("alturas_frente", "alturasFrente", "lista", null, "Alturas de frente explícitas, de abajo hacia arriba (mm)"),
  caj("material", "material", "texto", "Melamina 18 mm", "Texto del material del cuerpo (como en el despiece)"),
  caj("material_frente", "materialFrente", "texto", "", "Texto del material de frentes; vacío = igual al cuerpo"),
  caj("material_trasera", "materialTrasera", "texto", "MDF 3 mm", "Texto del material de la trasera"),
  caj("canto", "canto", "texto", "PVC 0.4 mm", "Texto del canto de las aristas vistas del cuerpo"),
  caj("canto_frente", "cantoFrente", "texto", "", "Texto del canto de los frentes; vacío = igual al del cuerpo"),
  caj("nombre", "nombre", "texto", "", "Nombre del módulo para el despiece"),
];

const CAMPOS_CLOSET: CampoParam[] = [
  caj("ancho", "ancho", "float", 1500.0, "Ancho exterior, de costado a costado (mm)"),
  caj("alto", "alto", "float", 2400.0, "Alto exterior total (mm)"),
  caj("fondo", "fondo", "float", 600.0, "Profundidad del costado (mm) — por revisar"),
  caj("puertas", "puertas", "int", 2, "Cantidad de puertas"),
  caj("tipo_puerta", "tipoPuerta", "texto", "batiente", "batiente, corredera o sin"),
  caj("repisas", "repisas", "int", 3, "Cantidad de repisas (si no se dan posiciones explícitas)"),
  caj("posiciones_repisas", "posicionesRepisas", "lista", null, "Alturas de repisa sobre el piso interior (mm)"),
  caj("barral_altura", "barralAltura", "float_opcional", 1700.0, "Altura del barral sobre el piso del módulo (mm); vacío = sin barral"),
  caj("repisas_moviles", "repisasMoviles", "bool", false, "Perforar los costados para soportes de repisa (Ø5)"),
  caj("espesor", "espesor", "float", 18.0, "Espesor del tablero del cuerpo (mm)"),
  caj("espesor_puerta", "espesorPuerta", "float", 18.0, "Espesor del tablero de puertas (mm)"),
  caj("trasera_espesor", "traseraEspesor", "float", 3.0, "Espesor de la trasera (mm); 0 = sin trasera"),
  caj("juego", "juego", "float", 3.0, "Holgura entre puertas (mm); el revelado mínimo de la bisagra pide 2.6"),
  caj("traslape_corredera", "traslapeCorredera", "float", 30.0, "Traslape entre puertas correderas (mm) — por revisar"),
  caj("juego_guia", "juegoGuia", "float", 45.0, "Juego vertical para las guías de puerta corredera (mm) — por revisar"),
  caj("material", "material", "texto", "Melamina 18 mm", "Texto del material del cuerpo (como en el despiece)"),
  caj("material_frente", "materialFrente", "texto", "", "Texto del material de puertas; vacío = igual al cuerpo"),
  caj("material_trasera", "materialTrasera", "texto", "MDF 3 mm", "Texto del material de la trasera"),
  caj("canto", "canto", "texto", "PVC 0.4 mm", "Texto del canto de las aristas vistas del cuerpo"),
  caj("canto_frente", "cantoFrente", "texto", "", "Texto del canto de las puertas; vacío = igual al del cuerpo"),
  caj("nombre", "nombre", "texto", "", "Nombre del módulo para el despiece"),
];

const CAMPOS_COCINA: CampoParam[] = [
  caj("ancho", "ancho", "float", 600.0, "Ancho exterior, de costado a costado (mm)"),
  caj("alto", "alto", "float", 900.0, "Alto del piso a la cara superior de la cubierta (mm)"),
  caj("fondo", "fondo", "float", 600.0, "Profundidad total del módulo, costado + puerta (mm)"),
  caj("zocalo", "zocalo", "float", 100.0, "Altura libre bajo el módulo / zócalo (mm)"),
  caj("retranqueo_zocalo", "retranqueoZocalo", "float", 75.0, "Retranqueo del zócalo respecto del borde de las puertas (mm)"),
  caj("cubierta_espesor", "cubiertaEspesor", "float", 0.0, "Espesor del mesón sobre el módulo (mm); 0 = sin mesón"),
  caj("puertas", "puertas", "int", 2, "Cantidad de puertas cubrientes (0 si lleva cajones)"),
  caj("cajones", "cajones", "int", 0, "Cantidad de cajones (0 si lleva puertas)"),
  caj("espesor", "espesor", "float", 18.0, "Espesor del tablero del cuerpo (mm)"),
  caj("espesor_puerta", "espesorPuerta", "float", 18.0, "Espesor del tablero de puertas (mm)"),
  caj("trasera_espesor", "traseraEspesor", "float", 3.0, "Espesor de la trasera (mm); 0 = sin trasera"),
  caj("juego", "juego", "float", 3.0, "Holgura entre puertas o frentes (mm) — por revisar"),
  caj("juego_corredera", "juegoCorredera", "float", 25.0, "Juego lateral total de la corredera (mm) — por revisar"),
  caj("margen_alto_cajon", "margenAltoCajon", "float", 20.0, "Diferencia de alto entre frente y caja del cajón (mm) — por revisar"),
  caj("juego_fondo", "juegoFondo", "float", 10.0, "Holgura entre el fondo de la caja y la trasera (mm)"),
  caj("material", "material", "texto", "Melamina 18 mm", "Texto del material del cuerpo (como en el despiece)"),
  caj("material_frente", "materialFrente", "texto", "", "Texto del material de puertas; vacío = igual al cuerpo"),
  caj("material_trasera", "materialTrasera", "texto", "MDF 3 mm", "Texto del material de la trasera"),
  caj("canto", "canto", "texto", "PVC 0.4 mm", "Texto del canto de las aristas vistas del cuerpo"),
  caj("canto_frente", "cantoFrente", "texto", "", "Texto del canto de las puertas; vacío = igual al del cuerpo"),
  caj("nombre", "nombre", "texto", "", "Nombre del módulo para el despiece"),
];

const CAMPOS_LIBRERO: CampoParam[] = [
  caj("ancho", "ancho", "float", 800.0, "Ancho exterior, de costado a costado (mm)"),
  caj("alto", "alto", "float", 2000.0, "Alto exterior total (mm)"),
  caj("fondo", "fondo", "float", 300.0, "Profundidad del costado (mm) — por revisar"),
  caj("repisas", "repisas", "int", 4, "Cantidad de repisas (si no se dan posiciones explícitas)"),
  caj("posiciones_repisas", "posicionesRepisas", "lista", null, "Alturas de repisa sobre el piso interior (mm)"),
  caj("repisas_moviles", "repisasMoviles", "bool", false, "Perforar los costados para soportes de repisa (Ø5)"),
  caj("espesor", "espesor", "float", 18.0, "Espesor del tablero del cuerpo (mm)"),
  caj("trasera_espesor", "traseraEspesor", "float", 3.0, "Espesor de la trasera (mm); 0 = sin trasera"),
  caj("material", "material", "texto", "Melamina 18 mm", "Texto del material del cuerpo (como en el despiece)"),
  caj("material_trasera", "materialTrasera", "texto", "MDF 3 mm", "Texto del material de la trasera"),
  caj("canto", "canto", "texto", "PVC 0.4 mm", "Texto del canto de las aristas vistas del cuerpo"),
  caj("nombre", "nombre", "texto", "", "Nombre del módulo para el despiece"),
];

const CAMPOS_ESCRITORIO: CampoParam[] = [
  caj("ancho", "ancho", "float", 1200.0, "Ancho exterior del escritorio (mm)"),
  caj("fondo", "fondo", "float", 600.0, "Profundidad del escritorio (mm)"),
  caj("alto", "alto", "float", 750.0, "Alto exterior total, piso a cara superior de la cubierta (mm)"),
  caj("faldon", "faldon", "float", 100.0, "Alto del faldón frontal (mm) — mínimo 70"),
  caj("espesor", "espesor", "float", 18.0, "Espesor del tablero del cuerpo (mm)"),
  caj("espesor_cubierta", "espesorCubierta", "float", 18.0, "Espesor del tablero de la cubierta (mm); 0 = igual al cuerpo"),
  caj("material", "material", "texto", "Melamina 18 mm", "Texto del material del cuerpo (como en el despiece)"),
  caj("material_cubierta", "materialCubierta", "texto", "", "Texto del material de la cubierta; vacío = igual al cuerpo"),
  caj("canto", "canto", "texto", "PVC 0.4 mm", "Texto del canto de las aristas vistas del cuerpo"),
  caj("canto_cubierta", "cantoCubierta", "texto", "", "Texto del canto de la cubierta; vacío = igual al del cuerpo"),
  caj("nombre", "nombre", "texto", "", "Nombre del módulo para el despiece"),
];

export const CAJON = new ModuloRegistrado(
  "cajon",
  "Cajón",
  "Caja de cajón individual: fondo en ranura, armado con minifix, correderas al centro.",
  CAMPOS_CAJON,
  (params) => cajon.generar(params as cajon.ParamsCajon),
);
export const CAJONERA = new ModuloRegistrado(
  "cajonera",
  "Cajonera",
  "Torre de cajones con frentes cubrientes.",
  CAMPOS_CAJONERA,
  (params) => cajonera.generar(params as cajonera.ParamsCajonera),
);
export const CLOSET = new ModuloRegistrado(
  "closet",
  "Clóset",
  "Armario con repisas, barral y puertas batientes o correderas.",
  CAMPOS_CLOSET,
  (params) => closet.generar(params as closet.ParamsCloset),
);
export const COCINA = new ModuloRegistrado(
  "cocina",
  "Mueble bajo de cocina",
  "Bajo mesada con zócalo, puertas o cajones (medidas de ARAUCO #17).",
  CAMPOS_COCINA,
  (params) => cocina.generar(params as cocina.ParamsCocina),
);
export const LIBRERO = new ModuloRegistrado(
  "librero",
  "Librero",
  "Estantería con tapa y base entre costados y repisas.",
  CAMPOS_LIBRERO,
  (params) => librero.generar(params as librero.ParamsLibrero),
);
export const ESCRITORIO = new ModuloRegistrado(
  "escritorio",
  "Escritorio",
  "Escritorio con cubierta, costados y faldón ≥ 70 mm.",
  CAMPOS_ESCRITORIO,
  (params) => escritorio.generar(params as escritorio.ParamsEscritorio),
);

export const MODULOS: Record<string, ModuloRegistrado> = {
  cajon: CAJON,
  cajonera: CAJONERA,
  closet: CLOSET,
  cocina: COCINA,
  escritorio: ESCRITORIO,
  librero: LIBRERO,
};

/** Alias aceptados al nombrar un módulo en texto libre. */
export const ALIAS: Record<string, string> = {
  cajon: "cajon",
  "cajón": "cajon",
  cajonera: "cajonera",
  cajonero: "cajonera",
  closet: "closet",
  "clóset": "closet",
  placard: "closet",
  ropero: "closet",
  cocina: "cocina",
  "bajo mesada": "cocina",
  bajomesada: "cocina",
  "mueble bajo": "cocina",
  escritorio: "escritorio",
  mesa: "escritorio",
  librero: "librero",
  biblioteca: "librero",
  estanteria: "librero",
  "estantería": "librero",
};

const NULLISH = new Set(["", "none", "null", "sin", "ninguno"]);

function coercionar(valor: unknown, tipo: TipoCampo): unknown {
  if (typeof valor === "string") {
    let texto = valor.trim();
    if (
      texto.length >= 2 &&
      texto[0] === texto[texto.length - 1] &&
      (texto[0] === "'" || texto[0] === '"')
    ) {
      texto = texto.slice(1, -1);
    }
    if (tipo === "lista") {
      if (NULLISH.has(texto.toLowerCase())) return null;
      const arr = JSON.parse(texto) as unknown[];
      return arr.map((v) => Number(v));
    }
    if (tipo === "bool") {
      return ["1", "true", "si", "sí", "verdadero", "yes"].includes(texto.toLowerCase());
    }
    if (tipo === "float_opcional") {
      if (NULLISH.has(texto.toLowerCase())) return null;
      return Number(texto);
    }
    if (tipo === "float") return Number(texto);
    if (tipo === "int") return Math.trunc(Number(texto));
    return texto;
  }
  if (valor === null) return null;
  if (tipo === "lista") return (valor as unknown[]).map((v) => Number(v));
  if (tipo === "bool") return Boolean(valor);
  if (tipo === "float" || tipo === "float_opcional") return Number(valor);
  if (tipo === "int") return Math.trunc(Number(valor));
  return String(valor);
}

/** Crea los parámetros de un módulo, validando nombres y tipos. */
export function construirParams(
  registro: ModuloRegistrado,
  valores: Record<string, unknown>,
): Record<string, unknown> {
  const validos = new Map(registro.campos.map((c) => [c.nombre, c]));
  const desconocidos = Object.keys(valores).filter((k) => !validos.has(k)).sort();
  if (desconocidos.length) {
    throw new ValueError(
      `parámetro(s) desconocido(s) para ${registro.tipo}: ${desconocidos.join(", ")}. ` +
        `Válidos: ${registro.campos.map((c) => c.nombre).sort().join(", ")}`,
    );
  }
  const convertidos: Record<string, unknown> = {};
  for (const campo of registro.campos) {
    if (!(campo.nombre in valores)) continue;
    const valor = valores[campo.nombre];
    const esOpcional = campo.tipo === "lista" || campo.tipo === "float_opcional";
    if (valor === null && !esOpcional) continue;
    convertidos[campo.campo] = coercionar(valor, campo.tipo);
  }
  return convertidos;
}

/** Genera un módulo a partir de valores sueltos (JSON o texto). */
export function generarModulo(tipo: string, valores: Record<string, unknown> = {}): Modulo {
  return obtener(tipo).generar(construirParams(obtener(tipo), valores));
}

/** Devuelve el registro de un módulo por su tipo. */
export function obtener(tipo: string): ModuloRegistrado {
  const clave = tipo.trim().toLowerCase();
  if (!(clave in MODULOS)) {
    throw new ValueError(
      `módulo desconocido: ${JSON.stringify(tipo)}; disponibles: ${Object.keys(MODULOS).sort().join(", ")}`,
    );
  }
  return MODULOS[clave];
}
