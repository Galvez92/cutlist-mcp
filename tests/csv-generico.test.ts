import { describe, it, expect } from "vitest";
import * as csvGenerico from "../src/formats/csv_generico.js";
import {
  FormatError,
  aBooleano,
  aNumero,
  detectarSeparador,
  mapearColumnas,
} from "../src/formats/base.js";
import { DataError, VERIFICADO } from "../src/formats/model.js";
import { fixture } from "./helpers/fixtures.js";

describe("Utilidades de tabla", () => {
  it("aNumero acepta separadores y unidades", () => {
    expect(aNumero("732")).toBe(732);
    expect(aNumero("98,5")).toBe(98.5);
    expect(aNumero("1.173,5")).toBe(1173.5);
    expect(aNumero("1,173.5")).toBe(1173.5);
    expect(aNumero("732 mm")).toBe(732);
    expect(aNumero("1173.5", ".")).toBe(1173.5);
    expect(() => aNumero("")).toThrow(DataError);
    expect(() => aNumero("sin dato")).toThrow(DataError);
  });

  it("aBooleano es y en", () => {
    expect(aBooleano("si")).toBe(true);
    expect(aBooleano("Sí")).toBe(true);
    expect(aBooleano("yes")).toBe(true);
    expect(aBooleano("nao")).toBe(false);
    expect(aBooleano("no")).toBe(false);
    expect(aBooleano("")).toBeNull();
    expect(aBooleano("quizás")).toBeNull();
  });

  it("detectar separador", () => {
    expect(detectarSeparador("a;b;c\n1;2;3")).toBe(";");
    expect(detectarSeparador("a,b,c\n1,2,3")).toBe(",");
    expect(detectarSeparador("a\tb\tc")).toBe("\t");
    expect(detectarSeparador("a b c")).toBe(" ");
    expect(detectarSeparador("")).toBe(";");
    expect(detectarSeparador("solo")).toBe(";");
  });

  it("mapear columnas con alias", () => {
    const mapa = mapearColumnas(["Designation", "Length", "Width", "Thickness", "Quantity"]);
    expect(mapa.nombre).toBe(0);
    expect(mapa.largo).toBe(1);
    expect(mapa.ancho).toBe(2);
    expect(mapa.espesor).toBe(3);
    expect(mapa.cantidad).toBe(4);
    expect(Object.keys(mapearColumnas(["columna rara"])).length).toBe(0);
  });
});

describe("CSV genérico", () => {
  const texto = fixture("csv_generico/piezas_basico.csv");

  it("lee las piezas del fixture", () => {
    const lista = csvGenerico.importar(texto);
    expect(lista.piezas.length).toBe(5);
    expect(lista.totalPiezas).toBe(1 + 1 + 2 + 1 + 4);
    const primera = lista.piezas[0];
    expect(primera.nombre).toBe("Pata costado exterior acento der");
    expect([primera.largo, primera.ancho]).toEqual([732, 600]);
    expect(primera.espesor).toBe(18);
    expect(primera.veta).toBe(true);
    expect(primera.grupo).toBe("D01");
    expect(primera.etiqueta).toBe("A");
    expect(primera.notas).toBe("doble 36");
    expect(primera.cantos.c1).toMatch(/^PVC 719L/);
    expect(primera.cantos.c2).toBeUndefined();
  });

  it("lee decimal coma y campos vacíos", () => {
    const lista = csvGenerico.importar(texto);
    const cubierta = lista.piezas.find((p) => p.nombre.startsWith("Cubierta"))!;
    expect(cubierta.ancho).toBe(98.5);
    expect(cubierta.espesor).toBeNull();
    expect(cubierta.veta).toBeNull();
    const lateral = lista.piezas.find((p) => p.nombre === "Lateral cajón")!;
    expect(lateral.cantidad).toBe(4);
    expect(lateral.veta).toBe(false);
  });

  it("ida y vuelta conserva los datos", () => {
    const original = csvGenerico.importar(texto);
    const salida = csvGenerico.exportar(original);
    const vuelta = csvGenerico.importar(salida);
    expect(vuelta.piezas.length).toBe(original.piezas.length);
    for (const [antes, despues] of original.piezas.map((p, i) => [p, vuelta.piezas[i]] as const)) {
      expect(antes.nombre).toBe(despues.nombre);
      expect([antes.largo, antes.ancho]).toEqual([despues.largo, despues.ancho]);
      expect(antes.cantidad).toBe(despues.cantidad);
      expect(antes.espesor).toBe(despues.espesor);
      expect(antes.material).toBe(despues.material);
      expect(antes.veta).toBe(despues.veta);
      expect(antes.grupo).toBe(despues.grupo);
      expect(antes.cantos).toStrictEqual(despues.cantos);
    }
  });

  it("exporta con separador coma y decimal punto", () => {
    const lista = csvGenerico.importar(texto);
    const salida = csvGenerico.exportar(lista, { separador: ",", decimal: "." });
    expect(salida.startsWith("nombre,largo,ancho,")).toBe(true);
    expect(salida).toContain("98.5");
    const vuelta = csvGenerico.importar(salida, { separador: ",", decimal: "." });
    expect(vuelta.piezas[3].ancho).toBe(98.5);
  });

  it("exporta encabezado con unidad opcional", () => {
    const lista = csvGenerico.importar(texto);
    const salida = csvGenerico.exportar(lista);
    expect(salida.split(/\r\n|\r|\n/)[0].startsWith("nombre;largo;ancho;cantidad")).toBe(true);
    const conUnidad = csvGenerico.exportar(lista, { unidad: true });
    expect(conUnidad.split(/\r\n|\r|\n/)[0]).toContain("largo_mm;ancho_mm");
    const vuelta = csvGenerico.importar(conUnidad);
    expect(vuelta.piezas.length).toBe(lista.piezas.length);
    expect([vuelta.piezas[0].largo, vuelta.piezas[0].ancho]).toEqual([732, 600]);
  });

  it("rechaza archivos sin encabezado o columnas obligatorias", () => {
    expect(() => csvGenerico.importar("")).toThrow(FormatError);
    expect(() => csvGenerico.importar("732;600\n1;2", { encabezado: false })).toThrow(FormatError);
    expect(() => csvGenerico.importar("nombre;largo\nPieza;732")).toThrow(FormatError);
    expect(() => csvGenerico.importar("nombre;largo;ancho\nPieza;732;sin dato")).toThrow(FormatError);
  });

  it("descriptor es verificado", () => {
    expect(csvGenerico.DESCRIPTOR.estado).toBe(VERIFICADO);
    expect(csvGenerico.DESCRIPTOR.porRevisar.length).toBe(0);
  });
});
