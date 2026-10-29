import { describe, it, expect } from "vitest";
import * as opencutlist from "../src/formats/opencutlist.js";
import { FormatError } from "../src/formats/base.js";
import { PARCIAL } from "../src/formats/model.js";
import { fixture } from "./helpers/fixtures.js";

describe("OpenCutList", () => {
  const texto = fixture("opencutlist/parts_opencutlist.csv");

  it("lee los campos obligatorios y opcionales", () => {
    const lista = opencutlist.importar(texto);
    expect(lista.piezas.length).toBe(3);
    const primera = lista.piezas[0];
    expect(primera.nombre).toBe("Pata costado exterior acento der");
    expect([primera.largo, primera.ancho, primera.espesor]).toEqual([732, 600, 18]);
    expect(primera.cantidad).toBe(1);
    expect(primera.etiqueta).toBe("A");
    expect(primera.material).toMatch(/^Roble Americano/);
  });

  it("sin cantidad asume uno", () => {
    const lista = opencutlist.importar(texto);
    const cubierta = lista.piezas.find((p) => p.nombre === "Cubierta izquierda")!;
    expect(cubierta.cantidad).toBe(1);
  });

  it("exporta las columnas documentadas", () => {
    const lista = opencutlist.importar(texto);
    const salida = opencutlist.exportar(lista);
    expect(salida.split(/\r\n|\r|\n/)[0]).toBe(
      "Designation;Length;Width;Thickness;Quantity;Material;Tags",
    );
    const vuelta = opencutlist.importar(salida);
    expect(vuelta.piezas.map((p) => p.nombre)).toEqual(lista.piezas.map((p) => p.nombre));
    expect(vuelta.piezas.map((p) => p.cantidad)).toEqual(lista.piezas.map((p) => p.cantidad));
    expect(vuelta.piezas.map((p) => p.etiqueta)).toEqual(lista.piezas.map((p) => p.etiqueta));
  });

  it("exporta sin etiquetas cuando se pide", () => {
    const lista = opencutlist.importar(texto);
    const salida = opencutlist.exportar(lista, { incluirEtiquetas: false });
    expect(salida.split(/\r\n|\r|\n/)[0]).toBe(
      "Designation;Length;Width;Thickness;Quantity;Material",
    );
  });

  it("lee otros separadores y encabezados en español", () => {
    const texto2 = "Designación,Longitud,Anchura,Espesor,Cantidad\nCostado,732,564,18,2\n";
    const lista = opencutlist.importar(texto2, { separador: "," });
    expect(lista.piezas.length).toBe(1);
    expect(lista.piezas[0].cantidad).toBe(2);
    expect(lista.piezas[0].largo).toBe(732);
  });

  it("rechaza archivos sin los campos obligatorios", () => {
    expect(() => opencutlist.importar("Designation;Length;Width\nCostado;732;564\n")).toThrow(FormatError);
    expect(() => opencutlist.importar("")).toThrow(FormatError);
    expect(() => opencutlist.importar("Designation;Length;Width;Thickness\nCostado;732\n")).toThrow(FormatError);
  });

  it("marca por revisar y cita las fuentes", () => {
    const lista = opencutlist.importar(texto);
    const mensajes = lista.porRevisar().map((a) => a.mensaje.toLowerCase()).join(" ");
    expect(mensajes).toContain("unidad");
    expect(mensajes).toContain(".skp");
    const fuentes = opencutlist.DESCRIPTOR.fuentes.map((f) => f.url).join(" ");
    expect(fuentes).toContain("docs.opencutlist.org");
    expect(opencutlist.DESCRIPTOR.estado).toBe(PARCIAL);
  });
});
