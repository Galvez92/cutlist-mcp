/**
 * Clóset (armario de colgar y repisas) paramétrico.
 *
 * Geometría (mm, medidas exteriores)
 * ----------------------------------
 * - ``ancho``, ``alto`` y ``fondo`` exteriores (costado a costado).
 * - Caja: 2 costados, tapa y base entre costados, trasera de 3 mm clavada al dorso
 * (espesor de trasera según ARAUCO, serie Cómo Hacer 17).
 * - Repisas: repartidas en el interior o en posiciones explícitas. Si
 * ``repisasMoviles`` está activo, los costados llevan barrenos Ø5 con el
 * criterio de ARAUCO #6 (a 40–50 mm del borde, 30 mm de paso entre barrenos,
 * una posición y dos arriba y dos abajo).
 * - Puertas ``batiente`` (cubrientes, con ``juego`` entre ellas) o ``corredera``
 * (traslapadas, con juego de guía). El barral es un accesorio, no una pieza.
 * - Bisagras: la cantidad por puerta sale del alto (Hettich Sensys) y del peso de
 *   la puerta (Blum CLIP top), y el revelado mínimo está verificado con los
 *   mismos catálogos; ver ``bisagrasPuerta()`` en ``bisagras.ts``.
 *   El traslape y el juego de guía de las correderas siguen ``por revisar``: los
 *   fija el sistema de correderas elegido.
 *
 * El módulo no decide la distribución interna (dónde va el colgado y dónde las
 * repisas): eso se pide con ``posicionesRepisas`` y ``barralAltura``.
 */

import { Accesorio, Modulo } from "./modulo.js";
import {
  CANTO_DEFAULT,
  JUEGO_DEFAULT,
  MATERIAL_DEFAULT,
  MATERIAL_TRASERA_DEFAULT,
  barrenosRepisa,
  exigirPositivo,
  frentes,
  posicionesRepisas,
  repartir,
} from "./common.js";
import { Cantos, Mecanizado, Pieza, ValueError } from "./parts.js";
import {
  ALTO_MAXIMO_BISAGRAS,
  ANCHO_MAXIMO_GUIA_BISAGRAS,
  JUEGO_MINIMO_ENTRE_PUERTAS,
  bisagrasPuerta,
  notasPesoBisagras,
} from "./bisagras.js";

export const TIPOS_PUERTA = ["batiente", "corredera", "sin"] as const;

export const CAMPOS: Record<string, string> = {
  ancho: "Ancho exterior, de costado a costado (mm)",
  alto: "Alto exterior total (mm)",
  fondo: "Profundidad del costado (mm) — por revisar",
  puertas: "Cantidad de puertas",
  tipo_puerta: "batiente, corredera o sin",
  repisas: "Cantidad de repisas (si no se dan posiciones explícitas)",
  posiciones_repisas: "Alturas de repisa sobre el piso interior (mm)",
  barral_altura: "Altura del barral sobre el piso del módulo (mm); vacío = sin barral",
  repisas_moviles: "Perforar los costados para soportes de repisa (Ø5)",
  espesor: "Espesor del tablero del cuerpo (mm)",
  espesor_puerta: "Espesor del tablero de puertas (mm)",
  trasera_espesor: "Espesor de la trasera (mm); 0 = sin trasera",
  juego: "Holgura entre puertas (mm); el revelado mínimo de la bisagra pide 2.6",
  traslape_corredera: "Traslape entre puertas correderas (mm) — por revisar",
  juego_guia: "Juego vertical para las guías de puerta corredera (mm) — por revisar",
  material: "Texto del material del cuerpo (como en el despiece)",
  material_frente: "Texto del material de puertas; vacío = igual al cuerpo",
  material_trasera: "Texto del material de la trasera",
  canto: "Texto del canto de las aristas vistas del cuerpo",
  canto_frente: "Texto del canto de las puertas; vacío = igual al del cuerpo",
  nombre: "Nombre del módulo para el despiece",
};

export interface ParamsCloset {
  ancho?: number;
  alto?: number;
  fondo?: number;
  puertas?: number;
  tipoPuerta?: string;
  repisas?: number;
  posicionesRepisas?: number[] | null;
  barralAltura?: number | null;
  repisasMoviles?: boolean;
  espesor?: number;
  espesorPuerta?: number;
  traseraEspesor?: number;
  juego?: number;
  traslapeCorredera?: number;
  juegoGuia?: number;
  material?: string;
  materialFrente?: string;
  materialTrasera?: string;
  canto?: string;
  cantoFrente?: string;
  nombre?: string;
}

export const DEFAULTS_CLOSET = {
  ancho: 1500.0,
  alto: 2400.0,
  fondo: 600.0,
  puertas: 2,
  tipoPuerta: "batiente",
  repisas: 3,
  posicionesRepisas: null as number[] | null,
  barralAltura: 1700.0 as number | null,
  repisasMoviles: false,
  espesor: 18.0,
  espesorPuerta: 18.0,
  traseraEspesor: 3.0,
  juego: JUEGO_DEFAULT,
  traslapeCorredera: 30.0,
  juegoGuia: 45.0,
  material: MATERIAL_DEFAULT,
  materialFrente: "",
  materialTrasera: MATERIAL_TRASERA_DEFAULT,
  canto: CANTO_DEFAULT,
  cantoFrente: "",
  nombre: "",
};

// La tabla de bisagras vive en `bisagras.ts` porque la comparten el clóset y la
// cocina. Se reexporta desde aquí para no cambiar la API de este módulo.
export * from "./bisagras.js";

export function generar(params: ParamsCloset = {}): Modulo {
  const p = { ...DEFAULTS_CLOSET, ...params };
  exigirPositivo({
    ancho: p.ancho,
    alto: p.alto,
    fondo: p.fondo,
    espesor: p.espesor,
    espesor_puerta: p.espesorPuerta,
  });
  if (!(TIPOS_PUERTA as readonly string[]).includes(p.tipoPuerta)) {
    throw new ValueError(`tipo_puerta inválido: ${JSON.stringify(p.tipoPuerta)}; use ${TIPOS_PUERTA.join(", ")}`);
  }
  if (p.repisas < 0) {
    throw new ValueError("la cantidad de repisas no puede ser negativa");
  }
  if (p.tipoPuerta !== "sin" && p.puertas < 1) {
    throw new ValueError("se pidieron puertas pero la cantidad es menor que uno");
  }
  if (p.tipoPuerta === "corredera" && p.puertas < 2) {
    throw new ValueError("las puertas correderas necesitan al menos dos hojas");
  }

  const [material, materialFrente, canto, cantoFrente] = frentes(
    p.material,
    p.materialFrente,
    p.canto,
    p.cantoFrente,
  );
  const nombre =
    p.nombre || `Clóset ${p.ancho.toFixed(0)}x${p.alto.toFixed(0)}x${p.fondo.toFixed(0)}`;
  const anchoInterior = p.ancho - 2 * p.espesor;
  if (anchoInterior <= 0) {
    throw new ValueError("el ancho exterior no deja interior entre costados");
  }
  if (p.traseraEspesor >= p.fondo) {
    throw new ValueError("la trasera no puede ocupar toda la profundidad");
  }

  const interiorDesde = p.espesor;
  const interiorHasta = p.alto - p.espesor;
  const alturasRepisas =
    p.posicionesRepisas !== null
      ? [...p.posicionesRepisas]
      : posicionesRepisas(p.repisas, interiorDesde, interiorHasta);
  for (const posicion of alturasRepisas) {
    if (!(interiorDesde < posicion && posicion < interiorHasta)) {
      throw new ValueError(
        `la repisa a ${posicion.toFixed(0)} mm queda fuera del interior del módulo`,
      );
    }
  }

  const comun = { espesor: p.espesor, material, modulo: nombre };
  const mecanizadoCostado = p.repisasMoviles ? barrenosRepisa(alturasRepisas) : new Mecanizado();
  let funcionCostado = "Costado — canto en la arista frontal";
  if (mecanizadoCostado.barrenos.length) {
    funcionCostado += " y barrenos Ø5 para repisas móviles";
  }

  const piezas: Pieza[] = [
    new Pieza({
      nombre: "Costado",
      largo: p.alto,
      ancho: p.fondo,
      cantidad: 2,
      rol: "costado",
      cantos: new Cantos(canto),
      mecanizado: mecanizadoCostado,
      funcion: funcionCostado,
      ...comun,
    }),
    new Pieza({
      nombre: "Base",
      largo: p.fondo,
      ancho: anchoInterior,
      rol: "base",
      cantos: new Cantos(undefined, undefined, canto),
      funcion: "Base entre costados — canto en la arista frontal",
      ...comun,
    }),
    new Pieza({
      nombre: "Tapa",
      largo: p.fondo,
      ancho: anchoInterior,
      rol: "tapa",
      cantos: new Cantos(undefined, undefined, canto),
      funcion: "Tapa entre costados — canto en la arista frontal",
      ...comun,
    }),
  ];

  if (alturasRepisas.length) {
    piezas.push(
      new Pieza({
        nombre: "Repisa",
        largo: p.fondo,
        ancho: anchoInterior,
        cantidad: alturasRepisas.length,
        rol: "repisa",
        cantos: new Cantos(undefined, undefined, canto),
        funcion: "Repisa entre costados — canto en la arista frontal",
        ...comun,
      }),
    );
  }

  const notas: string[] = [];
  if (!alturasRepisas.length) {
    notas.push("Módulo sin repisas.");
  } else if (p.posicionesRepisas === null) {
    notas.push("Repisas repartidas parejas en el interior del módulo.");
  } else {
    notas.push("Repisas en las alturas pedidas.");
  }
  notas.push(
    p.traseraEspesor > 0
      ? "La trasera se clava/atornilla al dorso, sin ranura."
      : "Módulo sin trasera: necesita muro o rigidización adicional.",
  );
  if (alturasRepisas.length) {
    notas.push(
      "Alturas de repisa sobre el piso interior (mm): " +
        alturasRepisas.map((h) => (h - p.espesor).toFixed(0)).join(", "),
    );
  }

  const accesorios: Accesorio[] = [];
  if (p.barralAltura !== null) {
    if (!(0 < p.barralAltura && p.barralAltura < p.alto)) {
      throw new ValueError("la altura del barral debe quedar dentro del módulo");
    }
    accesorios.push(
      new Accesorio(
        "Barral redondo",
        1,
        `A ${p.barralAltura.toFixed(0)} mm sobre el piso del módulo (por revisar según el tipo de colgado)`,
      ),
      new Accesorio("Soporte de barral", 2),
    );
  }
  if (mecanizadoCostado.barrenos.length) {
    accesorios.push(
      new Accesorio(
        "Soporte de repisa Ø5",
        4 * alturasRepisas.length,
        "Cuatro soportes por repisa",
      ),
    );
  }

  if (p.tipoPuerta === "batiente") {
    const altoPuerta = p.alto - p.juego;
    if (altoPuerta <= 0) {
      throw new ValueError("la holgura de puerta deja alto no positivo");
    }
    const anchoPuerta = repartir(p.ancho, p.puertas, p.juego)[0];
    piezas.push(
      new Pieza({
        nombre: "Puerta",
        largo: altoPuerta,
        ancho: anchoPuerta,
        cantidad: p.puertas,
        espesor: p.espesorPuerta,
        material: materialFrente,
        rol: "puerta",
        cantos: new Cantos().todas(cantoFrente),
        funcion: "Puerta batiente cubriente — canto en las 4 aristas",
        modulo: nombre,
      }),
    );
    const calculoBisagras = bisagrasPuerta(anchoPuerta, altoPuerta, p.espesorPuerta);
    notas.push(
      `Puertas cubrientes de ${anchoPuerta.toFixed(1)} mm con ${p.juego.toFixed(0)} mm de holgura entre ellas (revelado mínimo documentado: ${JUEGO_MINIMO_ENTRE_PUERTAS.toFixed(1)} mm entre dos puertas).`,
    );
    notas.push(...notasPesoBisagras(calculoBisagras));
    if (p.juego < JUEGO_MINIMO_ENTRE_PUERTAS) {
      notas.push(
        `La holgura de ${p.juego.toFixed(1)} mm queda bajo el revelado mínimo de la bisagra (${JUEGO_MINIMO_ENTRE_PUERTAS.toFixed(1)} mm): las puertas no abren a la vez.`,
      );
    }
    if (altoPuerta > ALTO_MAXIMO_BISAGRAS) {
      notas.push(
        `Puertas de ${altoPuerta.toFixed(0)} mm de alto: la guía de bisagras llega a ${ALTO_MAXIMO_BISAGRAS.toFixed(0)} mm; revisar la cantidad con el fabricante.`,
      );
    }
    if (anchoPuerta > ANCHO_MAXIMO_GUIA_BISAGRAS) {
      notas.push(
        `Puertas de ${anchoPuerta.toFixed(1)} mm de ancho: la guía de bisagras vale hasta ${ANCHO_MAXIMO_GUIA_BISAGRAS.toFixed(0)} mm por hoja; revisar la cantidad con el fabricante.`,
      );
    }
    accesorios.push(
      new Accesorio(
        "Bisagra",
        calculoBisagras.bisagras * p.puertas,
        `Guías de Hettich Sensys (por alto) y Blum (2 bisagras hasta 6 kg, 3 hasta 12 kg): ${calculoBisagras.bisagras} por puerta con ${calculoBisagras.pesoKg.toFixed(1)} kg`,
      ),
    );
    accesorios.push(new Accesorio("Tirador o manija", p.puertas));
  } else if (p.tipoPuerta === "corredera") {
    const anchoHoja = (p.ancho + (p.puertas - 1) * p.traslapeCorredera) / p.puertas;
    const altoHoja = p.alto - p.juegoGuia;
    if (altoHoja <= 0) {
      throw new ValueError("el juego de guía deja alto de hoja no positivo");
    }
    piezas.push(
      new Pieza({
        nombre: "Puerta corredera",
        largo: altoHoja,
        ancho: anchoHoja,
        cantidad: p.puertas,
        espesor: p.espesorPuerta,
        material: materialFrente,
        rol: "puerta",
        cantos: new Cantos().todas(cantoFrente),
        funcion: "Hoja de puerta corredera traslapada — canto en las 4 aristas",
        modulo: nombre,
      }),
    );
    notas.push(
      `Hojas traslapadas ${p.traslapeCorredera.toFixed(0)} mm y ${p.juegoGuia.toFixed(0)} mm de juego para las guías: por revisar contra el sistema de correderas elegido.`,
    );
    accesorios.push(
      new Accesorio("Guía superior de puerta corredera", 1, "Por revisar"),
      new Accesorio("Guía inferior de puerta corredera", 1, "Por revisar"),
    );
  }

  if (p.traseraEspesor > 0) {
    piezas.push(
      new Pieza({
        nombre: "Trasera",
        largo: p.alto,
        ancho: p.ancho,
        espesor: p.traseraEspesor,
        material: p.materialTrasera,
        rol: "trasera",
        veta: "indiferente",
        funcion: "Trasera clavada al dorso del módulo",
        modulo: nombre,
      }),
    );
  }

  return new Modulo(
    "closet",
    nombre,
    {
      ancho: p.ancho,
      alto: p.alto,
      fondo: p.fondo,
      puertas: p.tipoPuerta !== "sin" ? p.puertas : 0,
      repisas: alturasRepisas.length,
      ancho_interior: anchoInterior,
    },
    piezas,
    accesorios,
    notas,
  );
}
