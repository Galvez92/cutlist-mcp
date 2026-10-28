/** Pruebas del punto de entrada HTTP de la vista previa (tools/preview/server.ts). */

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createPreviewServer } from "../tools/preview/server.js";
import type { Server } from "node:http";

let server: Server;
let base: string;

beforeAll(async () => {
  server = createPreviewServer();
  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      if (addr && typeof addr === "object") {
        base = `http://127.0.0.1:${addr.port}`;
      }
      resolve();
    });
  });
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

async function pedir(ruta: string, datos?: unknown): Promise<{ estado: number; cuerpo: string }> {
  const respuesta = await fetch(`${base}${ruta}`, {
    method: datos === undefined ? "GET" : "POST",
    headers: datos === undefined ? undefined : { "Content-Type": "application/json" },
    body: datos === undefined ? undefined : JSON.stringify(datos),
  });
  return { estado: respuesta.status, cuerpo: await respuesta.text() };
}

async function pedirCrudo(ruta: string, body: string, headers: Record<string, string> = {}) {
  const respuesta = await fetch(`${base}${ruta}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body,
  });
  return { estado: respuesta.status, cuerpo: await respuesta.text() };
}

describe("vista previa · rutas GET", () => {
  it("página de la vista previa", async () => {
    const { estado, cuerpo } = await pedir("/");
    expect(estado).toBe(200);
    expect(cuerpo).toContain("Módulos paramétricos");
  });

  it("api de módulos lista los seis", async () => {
    const { estado, cuerpo } = await pedir("/api/modulos");
    expect(estado).toBe(200);
    const datos = JSON.parse(cuerpo);
    expect(datos.modulos.map((m: { tipo: string }) => m.tipo)).toEqual([
      "cajon",
      "cajonera",
      "closet",
      "cocina",
      "escritorio",
      "librero",
    ]);
    const cajonera = datos.modulos.find((m: { tipo: string }) => m.tipo === "cajonera");
    const campos = new Set(cajonera.campos.map((c: { nombre: string }) => c.nombre));
    expect(["ancho", "alto", "fondo", "cajones"].every((c) => campos.has(c))).toBe(true);
  });

  it("api de perfil expone el perfil por omisión", async () => {
    const { estado, cuerpo } = await pedir("/api/perfil");
    expect(estado).toBe(200);
    const datos = JSON.parse(cuerpo);
    expect(datos.nombre).toBe("cortecloud_madijal");
    expect(datos.pieza_min_corte).toBe(65.0);
    expect(datos.pieza_max).toEqual([2480.0, 1810.0]);
  });
});

describe("vista previa · previsualizar", () => {
  it("devuelve piezas y hallazgos", async () => {
    const { estado, cuerpo } = await pedir("/api/previsualizar", { tipo: "cajonera", params: {} });
    expect(estado).toBe(200);
    const datos = JSON.parse(cuerpo);
    expect(datos.tipo).toBe("cajonera");
    expect(datos.totales.unidades).toBe(30);
    expect(datos.hallazgos.errores).toBe(0);
    expect(datos.piezas.some((p: { nombre: string }) => p.nombre === "Costado")).toBe(true);
    expect(datos.piezas[0].cantos).toBeTruthy();
  });

  it("parámetros y errores 400", async () => {
    const ok = await pedir("/api/previsualizar", {
      tipo: "cocina",
      params: { ancho: 800, cajones: 3, puertas: 0 },
    });
    expect(ok.estado).toBe(200);
    expect(JSON.parse(ok.cuerpo).medidas.ancho).toBe(800.0);

    const malo = await pedir("/api/previsualizar", { tipo: "cocina", params: { alto: 50 } });
    expect(malo.estado).toBe(400);
    expect(JSON.parse(malo.cuerpo).error).toContain("carcasa");

    const sinTipo = await pedir("/api/previsualizar", { params: {} });
    expect(sinTipo.estado).toBe(400);
  });
});

describe("vista previa · idea escrita", () => {
  it("idea válida", async () => {
    const { estado, cuerpo } = await pedir("/api/idea", {
      texto: "librero ancho=900 alto=1800 fondo=300 repisas=4",
    });
    expect(estado).toBe(200);
    const datos = JSON.parse(cuerpo);
    expect(datos.tipo).toBe("librero");
    expect(datos.medidas.repisas).toBe(4);
  });

  it("idea desconocida 400", async () => {
    const { estado, cuerpo } = await pedir("/api/idea", { texto: "sillon ancho=500" });
    expect(estado).toBe(400);
    expect(JSON.parse(cuerpo).error).toContain("desconocido");
  });
});

describe("vista previa · rutas y JSON inválidos", () => {
  it("ruta inexistente 404", async () => {
    const { estado } = await pedir("/no-existe");
    expect(estado).toBe(404);
  });

  it("GET a ruta POST 404", async () => {
    const { estado } = await pedir("/api/previsualizar");
    expect(estado).toBe(404);
  });

  it("JSON inválido 400", async () => {
    const { estado, cuerpo } = await pedirCrudo("/api/idea", "{no es json");
    expect(estado).toBe(400);
    expect(cuerpo).toContain("JSON");
  });
});
