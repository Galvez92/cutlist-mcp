import { describe, it, expect } from "vitest";
import * as polyboard from "../src/formats/polyboard.js";
import * as promob from "../src/formats/promob.js";
import * as pro100 from "../src/formats/pro100.js";
import { FormatError } from "../src/formats/base.js";
import { PARCIAL, POR_REVISAR } from "../src/formats/model.js";
import { fixture } from "./helpers/fixtures.js";

describe("PolyBoard", () => {
  it("lee con las columnas por defecto y avisa", () => {
    const lista = polyboard.importar(fixture("polyboard/lista_corte.csv"));
    expect(lista.piezas.length).toBe(3);
    expect(lista.totalPiezas).toBe(6);
    const primera = lista.piezas[0];
    expect(primera.nombre).toBe("Pata costado exterior acento der");
    expect([primera.largo, primera.ancho]).toEqual([732, 600]);
    expect(primera.espesor).toBe(18);
    expect(lista.piezas[2].cantidad).toBe(4);
    const mensajes = lista.porRevisar().map((a) => a.mensaje.toLowerCase()).join(" ");
    expect(mensajes).toContain("columnas declaradas");
  });

  it("lee con columnas declaradas por el usuario", () => {
    const lista = polyboard.importar("732;600;Pata costado;2\n", {
      columnas: ["largo", "ancho", "nombre", "cantidad"],
    });
    expect(lista.piezas[0].nombre).toBe("Pata costado");
    expect(lista.piezas[0].cantidad).toBe(2);
    expect(lista.porRevisar().some((a) => a.mensaje.includes("declaradas por defecto"))).toBe(false);
  });

  it("lee con encabezado real", () => {
    const lista = polyboard.importar("Nombre;Largo;Ancho;Espesor\nEstante;300;200;18\n", {
      encabezado: true,
    });
    expect(lista.piezas[0].nombre).toBe("Estante");
    expect(lista.piezas[0].largo).toBe(300);
    expect(lista.piezas[0].espesor).toBe(18);
  });

  it("las columnas desconocidas no desalinean los datos", () => {
    const lista = polyboard.importar("Nombre;Rareza;Largo;Ancho\nEstante;xx;300;200\n", {
      encabezado: true,
    });
    expect(lista.piezas[0].nombre).toBe("Estante");
    expect([lista.piezas[0].largo, lista.piezas[0].ancho]).toEqual([300, 200]);
  });

  it("errores de columnas y de datos", () => {
    expect(() => polyboard.importar("1;2;3", { columnas: ["largo", "ancho", "espesor"] })).toThrow(FormatError);
    expect(() => polyboard.importar("Pieza;sin dato;600")).toThrow(FormatError);
    expect(() => polyboard.importar("")).toThrow(FormatError);
  });

  it("descriptor de solo lectura", () => {
    expect(polyboard.DESCRIPTOR.estado).toBe(PARCIAL);
    expect(polyboard.DESCRIPTOR.permiteImportar).toBe(true);
    expect(polyboard.DESCRIPTOR.permiteExportar).toBe(false);
    expect("exportar" in polyboard).toBe(false);
    const fuentes = polyboard.DESCRIPTOR.fuentes.map((f) => f.url).join(" ");
    expect(fuentes).toContain("wooddesigner.org");
  });
});

describe("Promob", () => {
  it("lee con las columnas por defecto y avisa", () => {
    const lista = promob.importar(fixture("promob/listagem.txt"));
    expect(lista.piezas.length).toBe(3);
    const primera = lista.piezas[0];
    expect(primera.nombre).toBe("Costado interior izq");
    expect([primera.largo, primera.ancho, primera.espesor]).toEqual([732, 564, 18]);
    expect(primera.grupo).toBe("D02");
    expect(primera.veta).toBe(true);
    expect(primera.cantos.c1).toMatch(/^PVC 771L/);
    expect(lista.piezas[1].veta).toBe(false);
    expect(lista.piezas[2].cantidad).toBe(2);
    expect(lista.porRevisar().some((a) => a.mensaje.includes("por optimizador"))).toBe(true);
  });

  it("lee con columnas declaradas", () => {
    const lista = promob.importar("732;564;Costado interior izq\n", {
      columnas: ["largo", "ancho", "nombre"],
    });
    expect(lista.piezas[0].nombre).toBe("Costado interior izq");
    expect(lista.porRevisar().some((a) => a.mensaje.includes("declaradas por defecto"))).toBe(false);
  });

  it("lee con encabezado y separador coma", () => {
    const lista = promob.importar("Nome,Quantidade,Comprimento,Largura\nCostado,2,732,564\n", {
      encabezado: true,
    });
    expect(lista.piezas[0].cantidad).toBe(2);
    expect(lista.piezas[0].largo).toBe(732);
  });

  it("errores", () => {
    expect(() => promob.importar("")).toThrow(FormatError);
    expect(() => promob.importar("Costado;no es numero;564")).toThrow(FormatError);
  });

  it("descriptor por revisar con fuentes", () => {
    expect(promob.DESCRIPTOR.estado).toBe(POR_REVISAR);
    expect(promob.DESCRIPTOR.porRevisar.length).toBeGreaterThan(0);
    expect(promob.DESCRIPTOR.permiteExportar).toBe(false);
    const fuentes = promob.DESCRIPTOR.fuentes.map((f) => f.url).join(" ");
    expect(fuentes).toContain("suporte.promob.com");
    expect(fuentes).toContain("cutplanning");
  });
});

describe("PRO100", () => {
  it("lee el listado con tabuladores", () => {
    const lista = pro100.importar(fixture("pro100/listado_detalles.txt"));
    expect(lista.piezas.length).toBe(4);
    expect(lista.piezas[0].nombre).toBe("Pata costado exterior acento der");
    expect([lista.piezas[0].largo, lista.piezas[0].ancho]).toEqual([732, 600]);
    expect(lista.piezas[0].espesor).toBe(18);
    expect(lista.piezas[2].cantidad).toBe(4);
    expect(lista.porRevisar().some((a) => a.mensaje.includes("no publicado"))).toBe(true);
  });

  it("lee con columnas declaradas", () => {
    const lista = pro100.importar("Estante;300;200\n", {
      columnas: ["nombre", "ancho", "largo"],
    });
    expect([lista.piezas[0].largo, lista.piezas[0].ancho]).toEqual([200, 300]);
  });

  it("errores", () => {
    expect(() => pro100.importar("")).toThrow(FormatError);
    expect(() => pro100.importar("Estante;1;sin dato;200;18")).toThrow(FormatError);
  });

  it("descriptor por revisar con fuentes", () => {
    expect(pro100.DESCRIPTOR.estado).toBe(POR_REVISAR);
    const fuentes = pro100.DESCRIPTOR.fuentes.map((f) => f.url).join(" ");
    expect(fuentes).toContain("cutlistplus.com");
    expect(fuentes).toContain("sovetpro100");
    expect(pro100.DESCRIPTOR.permiteExportar).toBe(false);
  });
});
