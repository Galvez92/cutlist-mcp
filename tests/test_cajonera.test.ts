/** Pruebas del generador de cajonera. */

import { describe, expect, it } from "vitest";

import { generarModulo, obtener } from "../src/modules/index.js";
import { generar } from "../src/modules/cajonera.js";
import type { ParamsCajonera } from "../src/modules/cajonera.js";
import type { Modulo } from "../src/modules/modulo.js";
import type { Pieza } from "../src/modules/parts.js";
import { errores } from "../src/modules/profiles.js";
import { aprox } from "./helpers/aprox.js";

const MEDIDAS_CUERPO: Record<string, [number, number, number]> = {
  Costado: [800.0, 500.0, 2],
  Base: [500.0, 414.0, 1],
  Tapa: [500.0, 414.0, 1],
  "Travesaño trasero": [414.0, 100.0, 1],
  // Trasera encastrada en ranura: 800 - 36 + 18 y 450 - 36 + 18.
  Trasera: [782.0, 432.0, 1],
};

function buscar(modulo: Modulo, nombre: string): Pieza {
  for (const linea of modulo.resumen()) {
    if (linea.nombre === nombre) return linea;
  }
  throw new Error(`no se generó la pieza ${JSON.stringify(nombre)}`);
}

describe("cajonera · cuerpo", () => {
  it("medidas del cuerpo", () => {
    const modulo = generar();
    for (const [nombre, [largo, ancho, cantidad]] of Object.entries(MEDIDAS_CUERPO)) {
      const pieza = buscar(modulo, nombre);
      aprox(pieza.largo, largo);
      aprox(pieza.ancho, ancho);
      expect(pieza.cantidad).toBe(cantidad);
    }
    aprox(modulo.medidas["ancho_interior"], 414.0);
  });

  it("cantos del cuerpo", () => {
    const modulo = generar();
    expect(buscar(modulo, "Costado").cantos.porArista()).toEqual({ largo_a: "PVC 0.4 mm" });
    expect(buscar(modulo, "Base").cantos.porArista()).toEqual({ ancho_a: "PVC 0.4 mm" });
    expect(buscar(modulo, "Travesaño trasero").cantos.vacio()).toBe(true);
  });

  it("trasera con espesor menor y sin canto", () => {
    const trasera = buscar(generar(), "Trasera");
    expect(trasera.espesor).toBe(3.0);
    expect(trasera.material).toBe("MDF 3 mm");
    expect(trasera.veta).toBe("indiferente");
  });

  it("sin trasera cuando el espesor es cero", () => {
    const modulo = generar({ traseraEspesor: 0 });
    expect(modulo.resumen().some((l) => l.nombre === "Trasera")).toBe(false);
  });
});

describe("cajonera · cajones", () => {
  it("frentes cubrientes reparten el alto", () => {
    const params: ParamsCajonera = {};
    const modulo = generar(params);
    const frente = buscar(modulo, "Frente de cajón");
    expect(frente.cantidad).toBe(4);
    aprox(frente.ancho, 450.0);
    const juego = 3.0;
    aprox(frente.largo, (800.0 - 3 * juego) / 4);
    expect(frente.cantos.cantidad()).toBe(4);
    aprox(frente.largo * 4 + juego * 3, 800.0);
  });

  it("caja de cajón sigue el despiece del fixture", () => {
    const params: ParamsCajonera = {};
    const modulo = generar(params);
    const anchoCaja = 414.0 - 25.0;
    const largoCaja = 450.0;
    const altoCaja = (800.0 - 3 * 3.0) / 4 - 20.0;

    const laterales = buscar(modulo, "Lateral cajón");
    aprox(laterales.largo, largoCaja);
    aprox(laterales.ancho, altoCaja);
    expect(laterales.cantidad).toBe(8);
    expect(laterales.cantos.porArista()).toEqual({ largo_a: "PVC 0.4 mm" });

    const frenteInterior = buscar(modulo, "Frente interior cajón");
    aprox(frenteInterior.largo, anchoCaja - 2 * 18.0);
    aprox(frenteInterior.ancho, altoCaja);
    expect(frenteInterior.cantos.vacio()).toBe(true);

    const piso = buscar(modulo, "Piso cajón");
    aprox(piso.largo, largoCaja);
    aprox(piso.ancho, anchoCaja);
    expect(piso.cantos.vacio()).toBe(true);
  });

  it("accesorios: correderas y tiradores", () => {
    const modulo = generar({ cajones: 2 });
    const accesorios = new Map(modulo.accesorios.map((a) => [a.nombre, a]));
    expect(accesorios.get("Corredera")!.cantidad).toBe(2);
    expect(accesorios.get("Tirador o manija")!.cantidad).toBe(2);
    expect(accesorios.get("Corredera")!.nota).toContain("450");
  });

  it("alturas de frente explícitas", () => {
    const modulo = generar({ alto: 500.0, cajones: 2, alturasFrente: [110.0, 180.0] });
    const alturas = modulo
      .resumen()
      .filter((l) => l.nombre === "Frente de cajón")
      .map((l) => l.largo)
      .sort((a, b) => a - b);
    expect(alturas.length).toBe(2);
    aprox(alturas[0], 110.0);
    aprox(alturas[1], 180.0);
  });

  it("nota cuando la corredera no es estándar", () => {
    const modulo = generar({ fondo: 380.0, traseraEspesor: 0.0, juegoFondo: 10.0 });
    expect(modulo.notas.some((n) => n.includes("por revisar"))).toBe(true);
    aprox(modulo.medidas["largo_caja_cajon"], 370.0);
  });
});

describe("cajonera · validación y errores", () => {
  it("respeta el perfil Cortecloud/Madijal", () => {
    expect(errores(generar().validar())).toEqual([]);
  });

  it("medidas inválidas fallan", () => {
    expect(() => generar({ cajones: 0 })).toThrow(/al menos un cajón/);
    expect(() => generar({ ancho: 30.0 })).toThrow(/interior entre costados/);
    expect(() => generar({ cajones: 2, alturasFrente: [500.0, 500.0] })).toThrow(/no caben/);
    expect(() => generar({ cajones: 4, alturasFrente: [100.0, 100.0] })).toThrow(/alturas de frente/);
  });
});

describe("cajonera · registro", () => {
  it("generar_modulo desde el registro con valores JSON", () => {
    const modulo = generarModulo("cajonera", { ancho: 500, cajones: 3 });
    expect(modulo.tipo).toBe("cajonera");
    expect(buscar(modulo, "Frente de cajón").cantidad).toBe(3);
    aprox(buscar(modulo, "Base").ancho, 500.0 - 2 * 18.0);

    expect(() => generarModulo("cajonera", { inventado: 1 })).toThrow(/desconocido/);
  });

  it("el registro expone los campos", () => {
    const campos = obtener("cajonera").camposUi();
    expect(campos.some((c) => c.nombre === "ancho")).toBe(true);
    expect(campos.every((c) => c.descripcion.length > 0)).toBe(true);
  });
});
