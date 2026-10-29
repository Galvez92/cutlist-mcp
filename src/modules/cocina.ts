/**
 * Mueble bajo de cocina (bajo mesada) paramétrico.
 *
 * Medidas de referencia: ARAUCO, *Cómo Diseñar y Construir Correctamente una
 * Cocina* (serie Cómo Hacer 17)
 * (https://arauco.com/archivos_bim/17_16486_pdf_sch_foll-web_muebleria_como_disenar_cocina_chile_11may_16-pdf_374_so1.pdf).
 * De ahí se toman los valores por omisión: 900 mm del piso a la cubierta,
 * 600 mm de profundidad total del módulo (= 580 mm de costado + 18 mm de puerta),
 * zócalo retranqueado con 100 a 150 mm libres bajo el módulo, retranqueo del
 * zócalo de 75 mm respecto del borde de las puertas, trasera de 3 mm y puertas
 * de 18 mm.
 *
 * Geometría (mm)
 * --------------
 * - ``alto`` es del piso a la cara superior de la cubierta; ``cubiertaEspesor``
 * se descuenta y el mesón no es una pieza de melamina del módulo (0 = sin mesón).
 * - ``fondo`` es la profundidad total: ``fondo - espesorPuerta`` es el costado.
 * - Cuerpo: 2 costados, base entre costados, travesaño frontal y trasero de
 * 100 mm de alto arriba (como los travesaños del fixture Cortecloud), trasera de
 * 3 mm y zócalo (frente y dos laterales).
 * - Frente: puertas cubrientes o, si ``cajones > 0``, frentes de cajón (no se
 * combinan puertas y cajones en el mismo módulo).
 * - Bisagras: cantidad por puerta con las mismas guías verificadas del clóset
 *   (``bisagrasPuerta()``: alto con Hettich *Sensys* y peso con Blum CLIP top).
 */

import { Accesorio, Modulo } from "./modulo.js";
import {
  ALTO_TRAVESAÑO_DEFAULT,
  CANTO_DEFAULT,
  JUEGO_DEFAULT,
  MATERIAL_DEFAULT,
  MATERIAL_TRASERA_DEFAULT,
  cajon,
  elegirCorredera,
  exigirPositivo,
  frentes,
  repartir,
} from "./common.js";
import {
  ALTO_MAXIMO_BISAGRAS,
  ANCHO_MAXIMO_GUIA_BISAGRAS,
  bisagrasPuerta,
  notasPesoBisagras,
} from "./bisagras.js";
import { Cantos, Pieza, ValueError } from "./parts.js";

export const CAMPOS: Record<string, string> = {
  ancho: "Ancho exterior, de costado a costado (mm)",
  alto: "Alto del piso a la cara superior de la cubierta (mm)",
  fondo: "Profundidad total del módulo, costado + puerta (mm)",
  zocalo: "Altura libre bajo el módulo / zócalo (mm)",
  retranqueo_zocalo: "Retranqueo del zócalo respecto del borde de las puertas (mm)",
  cubierta_espesor: "Espesor del mesón sobre el módulo (mm); 0 = sin mesón",
  puertas: "Cantidad de puertas cubrientes (0 si lleva cajones)",
  cajones: "Cantidad de cajones (0 si lleva puertas)",
  espesor: "Espesor del tablero del cuerpo (mm)",
  espesor_puerta: "Espesor del tablero de puertas (mm)",
  trasera_espesor: "Espesor de la trasera (mm); 0 = sin trasera",
  juego: "Holgura entre puertas o frentes (mm) — por revisar",
  juego_corredera: "Juego lateral total de la corredera (mm) — por revisar",
  margen_alto_cajon: "Diferencia de alto entre frente y caja del cajón (mm) — por revisar",
  juego_fondo: "Holgura entre el fondo de la caja y la trasera (mm)",
  material: "Texto del material del cuerpo (como en el despiece)",
  material_frente: "Texto del material de puertas; vacío = igual al cuerpo",
  material_trasera: "Texto del material de la trasera",
  canto: "Texto del canto de las aristas vistas del cuerpo",
  canto_frente: "Texto del canto de las puertas; vacío = igual al del cuerpo",
  nombre: "Nombre del módulo para el despiece",
};

export interface ParamsCocina {
  ancho?: number;
  alto?: number;
  fondo?: number;
  zocalo?: number;
  retranqueoZocalo?: number;
  cubiertaEspesor?: number;
  puertas?: number;
  cajones?: number;
  espesor?: number;
  espesorPuerta?: number;
  traseraEspesor?: number;
  juego?: number;
  juegoCorredera?: number;
  margenAltoCajon?: number;
  juegoFondo?: number;
  material?: string;
  materialFrente?: string;
  materialTrasera?: string;
  canto?: string;
  cantoFrente?: string;
  nombre?: string;
}

export const DEFAULTS_COCINA = {
  ancho: 600.0,
  alto: 900.0,
  fondo: 600.0,
  zocalo: 100.0,
  retranqueoZocalo: 75.0,
  cubiertaEspesor: 0.0,
  puertas: 2,
  cajones: 0,
  espesor: 18.0,
  espesorPuerta: 18.0,
  traseraEspesor: 3.0,
  juego: JUEGO_DEFAULT,
  juegoCorredera: 25.0,
  margenAltoCajon: 20.0,
  juegoFondo: 10.0,
  material: MATERIAL_DEFAULT,
  materialFrente: "",
  materialTrasera: MATERIAL_TRASERA_DEFAULT,
  canto: CANTO_DEFAULT,
  cantoFrente: "",
  nombre: "",
};

export function generar(params: ParamsCocina = {}): Modulo {
  const p = { ...DEFAULTS_COCINA, ...params };
  exigirPositivo({
    ancho: p.ancho,
    alto: p.alto,
    fondo: p.fondo,
    espesor: p.espesor,
    espesor_puerta: p.espesorPuerta,
  });
  if (p.zocalo < 0 || p.retranqueoZocalo < 0) {
    throw new ValueError("el zócalo y su retranqueo no pueden ser negativos");
  }
  if (p.cajones > 0 && p.puertas > 0) {
    throw new ValueError("este módulo lleva puertas o cajones, no ambos a la vez");
  }
  if (p.cajones < 0 || p.puertas < 0) {
    throw new ValueError("puertas y cajones no pueden ser negativos");
  }

  const [material, materialFrente, canto, cantoFrente] = frentes(
    p.material,
    p.materialFrente,
    p.canto,
    p.cantoFrente,
  );
  const nombre = p.nombre || `Mueble bajo cocina ${p.ancho.toFixed(0)}x${p.alto.toFixed(0)}`;
  const altoCarcasa = p.alto - p.zocalo - p.cubiertaEspesor;
  const fondoCostado = p.fondo - p.espesorPuerta;
  const anchoInterior = p.ancho - 2 * p.espesor;
  if (altoCarcasa <= 0) {
    throw new ValueError("el zócalo y la cubierta dejan alto de carcasa no positivo");
  }
  if (fondoCostado <= 0) {
    throw new ValueError("el espesor de puerta no deja profundidad de costado");
  }
  if (anchoInterior <= 0) {
    throw new ValueError("el ancho exterior no deja interior entre costados");
  }
  if (p.traseraEspesor >= fondoCostado) {
    throw new ValueError("la trasera no puede ocupar toda la profundidad del costado");
  }

  const comun = { espesor: p.espesor, material, modulo: nombre };
  const piezas: Pieza[] = [
    new Pieza({
      nombre: "Costado",
      largo: altoCarcasa,
      ancho: fondoCostado,
      cantidad: 2,
      rol: "costado",
      cantos: new Cantos(canto),
      funcion: "Costado — canto en la arista frontal",
      ...comun,
    }),
    new Pieza({
      nombre: "Base",
      largo: fondoCostado,
      ancho: anchoInterior,
      rol: "base",
      cantos: new Cantos(undefined, undefined, canto),
      funcion: "Base entre costados — canto en la arista frontal",
      ...comun,
    }),
    new Pieza({
      nombre: "Travesaño frontal",
      largo: anchoInterior,
      ancho: ALTO_TRAVESAÑO_DEFAULT,
      rol: "travesaño",
      funcion: "Barra de armar frontal, arriba entre costados",
      ...comun,
    }),
    new Pieza({
      nombre: "Travesaño trasero",
      largo: anchoInterior,
      ancho: ALTO_TRAVESAÑO_DEFAULT,
      rol: "travesaño",
      funcion: "Barra de armar trasera, arriba entre costados",
      ...comun,
    }),
  ];

  if (p.zocalo > 0) {
    const largoLateral = fondoCostado - p.retranqueoZocalo;
    if (largoLateral <= 0) {
      throw new ValueError("el retranqueo del zócalo es mayor que el fondo del costado");
    }
    piezas.push(
      new Pieza({
        nombre: "Zócalo frontal",
        largo: p.ancho,
        ancho: p.zocalo,
        rol: "zocalo",
        cantos: new Cantos(canto),
        funcion: "Zócalo frontal — canto en la arista superior",
        ...comun,
      }),
      new Pieza({
        nombre: "Zócalo lateral",
        largo: largoLateral,
        ancho: p.zocalo,
        cantidad: 2,
        rol: "zocalo",
        funcion: "Zócalo lateral, retranqueado al frente",
        ...comun,
      }),
    );
  }

  if (p.traseraEspesor > 0) {
    piezas.push(
      new Pieza({
        nombre: "Trasera",
        largo: altoCarcasa,
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

  const notas: string[] = [
    `Alto de carcasa ${altoCarcasa.toFixed(0)} mm: ${p.zocalo.toFixed(0)} mm de zócalo y ${p.cubiertaEspesor.toFixed(0)} mm de mesón.`,
    `Profundidad de costado ${fondoCostado.toFixed(0)} mm y ${p.espesorPuerta.toFixed(0)} mm de puerta (criterio de 600 mm totales de ARAUCO #17).`,
    `Zócalo retranqueado ${p.retranqueoZocalo.toFixed(0)} mm del borde de las puertas (ARAUCO #17 pide mínimo 75 mm).`,
    "El mesón y los artefactos no son piezas de este módulo.",
  ];
  const accesorios: Accesorio[] = [
    new Accesorio("Pata regulable", 4, "Cerradas por el zócalo"),
    new Accesorio("Tornillo 4 x 50 mm", 1, "Armado de costados, base y travesaños"),
  ];

  if (p.cajones > 0) {
    const anchoCaja = anchoInterior - p.juegoCorredera;
    if (anchoCaja <= 2 * p.espesor) {
      throw new ValueError("el juego de corredera no deja ancho útil en la caja del cajón");
    }
    const fondoUtil = fondoCostado - p.traseraEspesor - p.juegoFondo;
    const { largo: largoCorredera, esEstandar } = elegirCorredera(fondoUtil);
    if (!esEstandar) {
      notas.push(
        `Cajón de ${largoCorredera.toFixed(0)} mm de fondo: no calza ninguna corredera de 400/450/500 mm (ARAUCO #17); por revisar el catálogo.`,
      );
    }
    const alturas = repartir(altoCarcasa, p.cajones, p.juego);
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
          espesor: p.espesorPuerta,
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
    accesorios.push(
      new Accesorio("Corredera", p.cajones, `Un par por cajón, largo ${largoCorredera.toFixed(0)} mm`),
    );
    accesorios.push(new Accesorio("Tirador o manija", p.cajones));
  } else if (p.puertas > 0) {
    const altoPuerta = altoCarcasa - p.juego;
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
        funcion: "Puerta cubriente — canto en las 4 aristas",
        modulo: nombre,
      }),
    );
    const calculoBisagras = bisagrasPuerta(anchoPuerta, altoPuerta, p.espesorPuerta);
    accesorios.push(
      new Accesorio(
        "Bisagra",
        calculoBisagras.bisagras * p.puertas,
        `Guías de Hettich Sensys (por alto) y Blum (2 bisagras hasta 6 kg, 3 hasta 12 kg): ${calculoBisagras.bisagras} por puerta con ${calculoBisagras.pesoKg.toFixed(1)} kg`,
      ),
    );
    accesorios.push(new Accesorio("Tirador o manija", p.puertas));
    notas.push(
      `Puertas cubrientes de ${anchoPuerta.toFixed(1)} mm con ${p.juego.toFixed(0)} mm de holgura entre ellas (por revisar).`,
    );
    notas.push(...notasPesoBisagras(calculoBisagras));
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
  }

  return new Modulo(
    "cocina",
    nombre,
    {
      ancho: p.ancho,
      alto: p.alto,
      fondo: p.fondo,
      zocalo: p.zocalo,
      alto_carcasa: altoCarcasa,
      fondo_costado: fondoCostado,
      ancho_interior: anchoInterior,
    },
    piezas,
    accesorios,
    notas,
  );
}
