/**
 * Cajonera (torre de cajones) paramétrica.
 *
 * Geometría (mm, medidas exteriores)
 * ----------------------------------
 * - ``ancho``, ``alto`` y ``fondo`` son exteriores: de costado exterior a costado
 * exterior, criterio de modulación de ARAUCO (*Cómo Diseñar y Construir
 * Correctamente una Cocina*, serie Cómo Hacer 17).
 * - Caja del cuerpo: 2 costados de ``alto x fondo``, base y tapa entre costados
 * (``ancho - 2 x espesor``) y un travesaño trasero de rigidez. La trasera de
 * 3 mm va encastrada en una ranura de los cuatro lados (``trasera_ranura``;
 * ``false`` la deja clavada al dorso); espesor de trasera según ARAUCO #17.
 * - Frentes cubrientes: la altura total se reparte en ``cajones`` frentes con
 * ``juego`` entre ellos. La caja de cada cajón se arma como el despiece real del
 * fixture `tests/fixtures/cortecloud/escritorio_D_simple.json`.
 * - La cajonera apoya en el piso (sin zócalo).
 *
 * Convención de cantos: ver `docs/modulos-parametricos.md`. En piezas verticales
 * (costados, frentes) el frente del mueble se marca en ``largo_a``; en
 * horizontales (base, tapa) en ``ancho_a``. La pieza y su espejo son la misma
 * línea, por eso el lado izquierdo/derecho no se distingue.
 */

import { Accesorio, Modulo } from "./modulo.js";
import {
  ALTO_TRAVESAÑO_DEFAULT,
  CANTO_DEFAULT,
  JUEGO_DEFAULT,
  MATERIAL_DEFAULT,
  MATERIAL_TRASERA_DEFAULT,
  RANURA_TRASERA_ANCHO_DEFAULT,
  RANURA_TRASERA_DISTANCIA_DEFAULT,
  RANURA_TRASERA_PROFUNDIDAD_DEFAULT,
  cajon,
  elegirCorredera,
  encajeTrasera,
  exigirPositivo,
  fondoUtilCajon,
  frentes,
  repartir,
} from "./common.js";
import { Cantos, Mecanizado, Pieza, ValueError } from "./parts.js";

export const CAMPOS: Record<string, string> = {
  ancho: "Ancho exterior, de costado a costado (mm)",
  alto: "Alto exterior total (mm)",
  fondo: "Profundidad del costado (mm)",
  cajones: "Cantidad de cajones",
  espesor: "Espesor del tablero del cuerpo (mm)",
  trasera_espesor: "Espesor de la trasera (mm); 0 = sin trasera",
  trasera_ranura: "Encastrar la trasera en una ranura de los cuatro lados; false = clavada al dorso",
  ranura_ancho: "Ancho de la ranura de la trasera (mm) — por revisar, el perfil exige una de sus medidas",
  ranura_profundidad: "Profundidad de la ranura de la trasera en la cara interior (mm)",
  ranura_distancia: "Distancia de la ranura desde el borde del dorso (mm)",

  juego: "Holgura entre frentes (mm) — por revisar",
  juego_corredera: "Juego lateral total de la corredera (mm) — por revisar",
  margen_alto_cajon: "Diferencia de alto entre frente y caja del cajón (mm) — por revisar",
  juego_fondo: "Holgura entre el fondo de la caja y la trasera (mm)",
  alturas_frente: "Alturas de frente explícitas, de abajo hacia arriba (mm)",
  material: "Texto del material del cuerpo (como en el despiece)",
  material_frente: "Texto del material de frentes; vacío = igual al cuerpo",
  material_trasera: "Texto del material de la trasera",
  canto: "Texto del canto de las aristas vistas del cuerpo",
  canto_frente: "Texto del canto de los frentes; vacío = igual al del cuerpo",
  nombre: "Nombre del módulo para el despiece",
};

export interface ParamsCajonera {
  ancho?: number;
  alto?: number;
  fondo?: number;
  cajones?: number;
  espesor?: number;
  traseraEspesor?: number;
  traseraRanura?: boolean;
  ranuraAncho?: number;
  ranuraProfundidad?: number;
  ranuraDistancia?: number;
  juego?: number;
  juegoCorredera?: number;
  margenAltoCajon?: number;
  juegoFondo?: number;
  alturasFrente?: number[] | null;
  material?: string;
  materialFrente?: string;
  materialTrasera?: string;
  canto?: string;
  cantoFrente?: string;
  nombre?: string;
}

export const DEFAULTS_CAJONERA: Required<Omit<ParamsCajonera, "alturasFrente" | "nombre" | "materialFrente" | "cantoFrente">> & {
  alturasFrente: number[] | null;
  nombre: string;
  materialFrente: string;
  cantoFrente: string;
} = {
  ancho: 450.0,
  alto: 800.0,
  fondo: 500.0,
  cajones: 4,
  espesor: 18.0,
  traseraEspesor: 3.0,
  traseraRanura: true,
  ranuraAncho: RANURA_TRASERA_ANCHO_DEFAULT,
  ranuraProfundidad: RANURA_TRASERA_PROFUNDIDAD_DEFAULT,
  ranuraDistancia: RANURA_TRASERA_DISTANCIA_DEFAULT,
  juego: JUEGO_DEFAULT,
  juegoCorredera: 25.0,
  margenAltoCajon: 20.0,
  juegoFondo: 10.0,
  alturasFrente: null,
  material: MATERIAL_DEFAULT,
  materialFrente: "",
  materialTrasera: MATERIAL_TRASERA_DEFAULT,
  canto: CANTO_DEFAULT,
  cantoFrente: "",
  nombre: "",
};

export function generar(params: ParamsCajonera = {}): Modulo {
  const p = { ...DEFAULTS_CAJONERA, ...params };
  exigirPositivo({
    ancho: p.ancho,
    alto: p.alto,
    fondo: p.fondo,
    espesor: p.espesor,
  });
  if (p.cajones < 1) {
    throw new ValueError("la cajonera necesita al menos un cajón");
  }

  const [material, materialFrente, canto, cantoFrente] = frentes(
    p.material,
    p.materialFrente,
    p.canto,
    p.cantoFrente,
  );
  const nombre =
    p.nombre || `Cajonera ${p.ancho.toFixed(0)}x${p.alto.toFixed(0)}x${p.fondo.toFixed(0)}`;
  const anchoInterior = p.ancho - 2 * p.espesor;
  if (anchoInterior <= 0) {
    throw new ValueError("el ancho exterior no deja interior entre costados");
  }
  if (p.traseraEspesor >= p.fondo) {
    throw new ValueError("la trasera no puede ocupar toda la profundidad");
  }

  const comun = { espesor: p.espesor, material, modulo: nombre };
  const encaje =
    p.traseraEspesor > 0 && p.traseraRanura
      ? encajeTrasera({
          anchoInterior,
          altoInterior: p.alto - 2 * p.espesor,
          fondo: p.fondo,
          anchoRanura: p.ranuraAncho,
          profundidad: p.ranuraProfundidad,
          distancia: p.ranuraDistancia,
          espesorTrasera: p.traseraEspesor,
        })
      : null;
  const ranurasTrasera = encaje ? [encaje.ranura] : [];
  const mecanizadoCostado = new Mecanizado(ranurasTrasera);
  const mecanizadoHorizontal = new Mecanizado(ranurasTrasera);
  const sufijoRanura = encaje ? ", ranura para la trasera" : "";
  const piezas: Pieza[] = [
    new Pieza({
      nombre: "Costado",
      largo: p.alto,
      ancho: p.fondo,
      cantidad: 2,
      rol: "costado",
      cantos: new Cantos(canto),
      mecanizado: mecanizadoCostado,
      funcion:
        "Costado — canto en la arista frontal" +
        sufijoRanura +
        (encaje ? ` a ${p.ranuraDistancia.toFixed(1)} mm del borde del dorso` : ""),
      ...comun,
    }),
    new Pieza({
      nombre: "Base",
      largo: p.fondo,
      ancho: anchoInterior,
      rol: "base",
      cantos: new Cantos(undefined, undefined, canto),
      mecanizado: mecanizadoHorizontal,
      funcion: "Base entre costados — canto en la arista frontal" + sufijoRanura,
      ...comun,
    }),
    new Pieza({
      nombre: "Tapa",
      largo: p.fondo,
      ancho: anchoInterior,
      rol: "tapa",
      cantos: new Cantos(undefined, undefined, canto),
      mecanizado: mecanizadoHorizontal,
      funcion: "Tapa entre costados — canto en la arista frontal" + sufijoRanura,
      ...comun,
    }),
    new Pieza({
      nombre: "Travesaño trasero",
      largo: anchoInterior,
      ancho: ALTO_TRAVESAÑO_DEFAULT,
      rol: "travesaño",
      funcion: "Travesaño trasero de rigidez, entre costados",
      ...comun,
    }),
  ];

  if (p.traseraEspesor > 0) {
    piezas.push(
      new Pieza({
        nombre: "Trasera",
        largo: encaje ? Math.max(encaje.largo, encaje.ancho) : p.alto,
        ancho: encaje ? Math.min(encaje.largo, encaje.ancho) : p.ancho,
        espesor: p.traseraEspesor,
        material: p.materialTrasera,
        rol: "trasera",
        veta: "indiferente",
        funcion: encaje
          ? "Trasera encastrada en la ranura de costados, base y tapa"
          : "Trasera clavada al dorso del módulo",
        modulo: nombre,
      }),
    );
  }

  const alturas = p.alturasFrente ?? repartir(p.alto, p.cajones, p.juego);
  if (alturas.length !== p.cajones) {
    throw new ValueError(
      `se pidieron ${p.cajones} cajones y se dieron ${alturas.length} alturas de frente`,
    );
  }
  if (alturas.reduce((a, b) => a + b, 0) + (p.cajones - 1) * p.juego > p.alto) {
    throw new ValueError("las alturas de frente no caben en el alto del módulo");
  }

  const anchoCaja = anchoInterior - p.juegoCorredera;
  if (anchoCaja <= 2 * p.espesor) {
    throw new ValueError("el juego de corredera no deja ancho útil en la caja del cajón");
  }
  // Fondo libre para la caja del cajón: termina en la cara frontal de la
  // trasera, que con ranura queda más adelante que el dorso.
  const fondoUtil = fondoUtilCajon(p.fondo, p.traseraEspesor, encaje, p.juegoFondo);
  const { largo: largoCorredera, esEstandar } = elegirCorredera(fondoUtil);

  const notas: string[] = [
    `Frentes cubrientes: cubren el frente del módulo, con ${p.juego.toFixed(0)} mm de holgura entre ellos (por revisar).`,
    `Caja de cajón de ${anchoCaja.toFixed(0)} mm de ancho exterior (${anchoInterior.toFixed(0)} mm de interior menos ${p.juegoCorredera.toFixed(0)} mm de juego de corredera: por revisar contra el herraje).`,
  ];
  if (p.traseraEspesor <= 0) {
    notas.push("Módulo sin trasera: necesita muro o rigidización adicional.");
  } else if (encaje) {
    notas.push(
      `Trasera encastrada ${encaje.largo.toFixed(0)} x ${encaje.ancho.toFixed(0)} mm en una ranura de ` +
        `${p.ranuraAncho.toFixed(1)} mm de ancho x ${p.ranuraProfundidad.toFixed(0)} mm de profundidad, ` +
        `a ${p.ranuraDistancia.toFixed(0)} mm del borde del dorso, con ${encaje.holgura.toFixed(1)} mm ` +
        `de holgura para el panel (manual de melamina; por revisar contra el fresol y el perfil de la máquina).`,
    );
    notas.push(
      "El travesaño trasero va por delante de la trasera encastrada: confirmar su retranqueo en taller.",
    );
  } else {
    notas.push("La trasera se clava/atornilla al dorso, sin ranura.");
  }
  if (!esEstandar) {
    notas.push(
      `El cajón queda de ${largoCorredera.toFixed(0)} mm de fondo: no calza ninguna corredera de 400/450/500 mm (ARAUCO #17); por revisar el catálogo del herraje.`,
    );
  }

  for (let numero = 1; numero <= alturas.length; numero++) {
    const altoFrente = alturas[numero - 1];
    const altoCaja = altoFrente - p.margenAltoCajon;
    if (altoCaja <= 0) {
      throw new ValueError(
        `el frente ${numero} de ${altoFrente.toFixed(0)} mm no deja alto para la caja`,
      );
    }
    piezas.push(
      new Pieza({
        nombre: "Frente de cajón",
        largo: altoFrente,
        ancho: p.ancho,
        espesor: p.espesor,
        material: materialFrente,
        rol: "frente",
        cantos: new Cantos().todas(cantoFrente),
        funcion: "Frente de cajón cubriente — canto en las 4 aristas",
        modulo: nombre,
      }),
    );
    piezas.push(
      ...cajon(
        "cajón",
        anchoCaja,
        largoCorredera,
        altoCaja,
        p.espesor,
        material,
        canto,
        nombre,
      ),
    );
  }

  const accesorios = [
    new Accesorio(
      "Corredera",
      p.cajones,
      `Un par por cajón, largo ${largoCorredera.toFixed(0)} mm`,
    ),
    new Accesorio("Tirador o manija", p.cajones),
    new Accesorio("Tornillo 4 x 50 mm", 1, "Armado de costados, base y tapa"),
  ];

  return new Modulo(
    "cajonera",
    nombre,
    {
      ancho: p.ancho,
      alto: p.alto,
      fondo: p.fondo,
      cajones: p.cajones,
      ancho_interior: anchoInterior,
      largo_caja_cajon: largoCorredera,
    },
    piezas,
    accesorios,
    notas,
  );
}
