/**
 * Tolerancias de bisagras y juegos de herraje del clóset.
 *
 * Los valores esperados vienen de los catálogos de herraje, no del código:
 * - Hettich, *Sensys* (catálogo técnico), p. 14 «Number of hinges per door»:
 *   2 / 3 / 4 / 5 bisagras por puerta hasta 900 / 1600 / 2000 / 2400 mm de alto,
 *   para puertas de hasta 600 mm de ancho, y revelado total entre dos puertas de
 *   al menos dos veces el revelado mínimo.
 *   https://web.hettich.com/fileadmin/media/Sensys_Catalogue_11309_en.pdf
 * - Blum, CLIP top BLUMOTION (ficha técnica): copa Ø35 mm, distancia de copa
 *   3–7 mm y espesor de puerta 15–24 mm.
 *   https://d2.blum.com/services/BEC003/cliptopbmn_fl_dok_bus_$sen-us_$aof_$v1.pdf
 * - Blum, guía rápida de bisagras: revelado mínimo de 1.3 mm para puerta de 18 mm
 *   con distancia de barrenado de 3 mm (Hettich *Sensys*: 0.6–0.8 mm).
 *   https://downloads2.cabinetparts.com/54af8d4d-ea85-4fdd-a601-1a0a31dbcd92.pdf
 */

import { describe, expect, it } from "vitest";

import { ANCHO_MAXIMO_GUIA_BISAGRAS, bisagrasPorPuerta, generar } from "../src/modules/closet.js";
import type { Modulo } from "../src/modules/modulo.js";
import type { Pieza } from "../src/modules/parts.js";
import { aprox } from "./helpers/aprox.js";

/** Revelado mínimo por puerta de 18 mm con la copa a 3 mm (Blum, el mayor de los dos catálogos). */
const MINIMO_REVELADO_PUERTA_18 = 1.3;
/** Juego mínimo entre dos puertas: dos veces el revelado mínimo. */
const JUEGO_MINIMO_ENTRE_PUERTAS = 2 * MINIMO_REVELADO_PUERTA_18;
/** Guía de bisagras: alto máximo de puerta que cubre la tabla. */
const ALTO_MAXIMO_GUIA_BISAGRAS = 2400.0;
/** Espesor de puerta que admite la bisagra (Blum CLIP top / Hettich Sensys 110°). */
const ESPESOR_PUERTA_BISAGRA = { minimo: 15.0, maximo: 24.0 };

function buscar(modulo: Modulo, nombre: string): Pieza {
  for (const linea of modulo.resumen()) {
    if (linea.nombre === nombre) return linea;
  }
  throw new Error(`no se generó la pieza ${JSON.stringify(nombre)}`);
}

function notasCon(modulo: Modulo, texto: string): string[] {
  return modulo.notas.filter((nota) => nota.includes(texto));
}

describe("clóset · bisagras por alto de puerta", () => {
  it("sigue la tabla del fabricante en los límites de cada tramo", () => {
    const casos: [number, number][] = [
      [300.0, 2],
      [900.0, 2],
      [901.0, 3],
      [1600.0, 3],
      [1601.0, 4],
      [2000.0, 4],
      [2001.0, 5],
      [2400.0, 5],
    ];
    for (const [alto, esperado] of casos) {
      expect(bisagrasPorPuerta(alto), `alto ${alto}`).toBe(esperado);
    }
  });

  it("el clóset por omisión lleva cinco bisagras por hoja", () => {
    const modulo = generar();
    const puerta = buscar(modulo, "Puerta");
    aprox(puerta.largo, 2397.0);
    expect(bisagrasPorPuerta(puerta.largo)).toBe(5);
    const bisagra = modulo.accesorios.find((a) => a.nombre === "Bisagra")!;
    expect(bisagra.cantidad).toBe(5 * 2);
    expect(bisagra.nota).toContain("Hettich Sensys");
    expect(bisagra.nota).not.toContain("por revisar");
  });

  it("cambia de tramo con el alto del módulo", () => {
    const deDosMetros = generar({ alto: 2000.0 });
    aprox(buscar(deDosMetros, "Puerta").largo, 1997.0);
    expect(deDosMetros.accesorios.find((a) => a.nombre === "Bisagra")!.cantidad).toBe(4 * 2);

    // Clóset angosto: con hojas de 298 mm el peso no manda y el tramo es solo por alto.
    const bajo = generar({ alto: 900.0, ancho: 600.0, repisas: 0, barralAltura: null });
    aprox(buscar(bajo, "Puerta").largo, 897.0);
    expect(bajo.accesorios.find((a) => a.nombre === "Bisagra")!.cantidad).toBe(2 * 2);
  });
});

describe("clóset · revelado y juego entre puertas", () => {
  it("el juego reparte el ancho y cubre el revelado mínimo", () => {
    for (const puertas of [2, 3, 4]) {
      const modulo = generar({ puertas });
      const anchoPuerta = buscar(modulo, "Puerta").ancho;
      aprox(puertas * anchoPuerta + (puertas - 1) * 3.0, 1500.0);
      const juego = (1500.0 - puertas * anchoPuerta) / (puertas - 1);
      aprox(juego, 3.0);
      expect(juego / 2, `${puertas} puertas`).toBeGreaterThanOrEqual(MINIMO_REVELADO_PUERTA_18);
      expect(juego).toBeGreaterThanOrEqual(JUEGO_MINIMO_ENTRE_PUERTAS);
    }
  });

  it("el alto de la puerta deja la holgura dentro del módulo", () => {
    for (const alto of [900.0, 1600.0, 2000.0, 2400.0]) {
      const modulo = generar({ alto, repisas: 0, barralAltura: alto > 1700.0 ? 1700.0 : null });
      aprox(buscar(modulo, "Puerta").largo + 3.0, alto);
    }
  });

  it("avisa cuando la holgura no alcanza el revelado mínimo", () => {
    const modulo = generar({ juego: 1.0 });
    expect(notasCon(modulo, "bajo el revelado mínimo").length).toBe(1);
    const anchoPuerta = buscar(modulo, "Puerta").ancho;
    aprox(2 * anchoPuerta + 1.0, 1500.0);
  });

  it("no avisa con el juego por omisión", () => {
    expect(notasCon(generar(), "bajo el revelado mínimo")).toEqual([]);
  });

  it("avisa cuando las puertas superan la guía de bisagras", () => {
    const alto = generar({ alto: 2600.0 });
    expect(notasCon(alto, `la guía de bisagras llega a ${ALTO_MAXIMO_GUIA_BISAGRAS}`).length).toBe(1);

    const anchas = generar({ puertas: 2 });
    aprox(buscar(anchas, "Puerta").ancho, 748.5);
    expect(notasCon(anchas, "hasta 600 mm por hoja").length).toBe(1);

    const angostas = generar({ puertas: 4 });
    expect(buscar(angostas, "Puerta").ancho).toBeLessThanOrEqual(ANCHO_MAXIMO_GUIA_BISAGRAS);
    expect(notasCon(angostas, "hasta 600 mm por hoja")).toEqual([]);
  });

  it("el espesor de puerta cae en el rango de la bisagra", () => {
    const puerta = buscar(generar(), "Puerta");
    expect(puerta.espesor).toBeGreaterThanOrEqual(ESPESOR_PUERTA_BISAGRA.minimo);
    expect(puerta.espesor).toBeLessThanOrEqual(ESPESOR_PUERTA_BISAGRA.maximo);
  });
});
