/**
 * Vista previa de desarrollo de los módulos paramétricos (puerto 3000).
 *
 * Servidor HTTP de Node (sin dependencias más allá de tsx): solo sirve para ver
 * y probar los generadores desde el navegador. La demo web pública del
 * proyecto es otra tarea (`docs/memoria/tareas/demo-web-docs.md`); esto es el
 * punto de entrada del entorno de desarrollo.
 *
 * Rutas
 * -----
 * ``GET  /``                  página de la vista previa
 * ``GET  /api/modulos``       módulos registrados con sus parámetros
 * ``GET  /api/perfil``        perfil de restricciones por omisión
 * ``POST /api/previsualizar`` ``{"tipo": "cajonera", "params": {...}}``
 * ``POST /api/idea``          ``{"texto": "cajonera ancho=450 cajones=3"}``
 */

import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { MODULOS, generarModulo } from "../../src/modules/index.js";
import { PERFIL_CORTECLOUD_MADIJAL } from "../../src/modules/profiles.js";
import { construirDesdeTexto, parsear } from "../../src/modules/spec.js";
import { ValueError } from "../../src/modules/parts.js";

const AQUI = dirname(fileURLToPath(import.meta.url));
const PAGINA = join(AQUI, "preview.html");
const PUERTO = Number(process.env.PORT ?? 3000);
const HOST = process.env.HOST ?? "0.0.0.0";

function modulos() {
  return {
    modulos: Object.values(MODULOS).map((registro) => ({
      tipo: registro.tipo,
      titulo: registro.titulo,
      descripcion: registro.descripcion,
      campos: registro.camposUi(),
    })),
  };
}

function perfil() {
  const p = PERFIL_CORTECLOUD_MADIJAL;
  return {
    nombre: p.nombre,
    fuente: p.fuente,
    pieza_min_corte: p.piezaMinCorte,
    pieza_min_recomendada: p.piezaMinRecomendada,
    pieza_min_terminada: p.piezaMinTerminada,
    pieza_mecanizada_min_largo: p.piezaMecanizadaMinLargo,
    pieza_max: [p.piezaMaxLargo, p.piezaMaxAncho],
    tablero: [p.tableroLargo, p.tableroAncho, p.tableroEspesor],
    ranuras_permitidas: [...p.ranurasPermitidas],
    barrenos_horizontales: [...p.barrenosHorizontales],
    barrenos_verticales: [...p.barrenosVerticales],
  };
}

function previsualizar(datos: Record<string, unknown>): Record<string, unknown> {
  const tipo = datos["tipo"];
  if (!tipo) throw new ValueError("falta el tipo de módulo");
  const modulo = generarModulo(String(tipo), (datos["params"] as Record<string, unknown>) ?? {});
  return modulo.toDictConPerfil();
}

function previsualizarIdea(datos: Record<string, unknown>): Record<string, unknown> {
  const texto = String(datos["texto"] ?? "");
  const { tipo, valores } = parsear(texto);
  return previsualizar({ tipo, params: valores });
}

function responder(res: ServerResponse, estado: number, cuerpo: Buffer, tipo: string): void {
  res.writeHead(estado, {
    "Content-Type": tipo,
    "Content-Length": String(cuerpo.length),
    "Cache-Control": "no-store",
  });
  res.end(cuerpo);
}

function json(res: ServerResponse, estado: number, datos: unknown): void {
  const cuerpo = Buffer.from(JSON.stringify(datos, null, 2), "utf-8");
  responder(res, estado, cuerpo, "application/json; charset=utf-8");
}

function errorJson(res: ServerResponse, estado: number, mensaje: string): void {
  json(res, estado, { error: mensaje });
}

async function leerCuerpo(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString("utf-8");
}

export function createPreviewServer(): Server {
  return createServer(async (req, res) => {
    const ruta = new URL(req.url ?? "/", "http://localhost").pathname;
    try {
      if (req.method === "GET") {
        if (ruta === "/" || ruta === "/index.html") {
          responder(res, 200, readFileSync(PAGINA), "text/html; charset=utf-8");
          return;
        }
        if (ruta === "/api/modulos") {
          json(res, 200, modulos());
          return;
        }
        if (ruta === "/api/perfil") {
          json(res, 200, perfil());
          return;
        }
        errorJson(res, 404, `ruta desconocida: ${ruta}`);
        return;
      }
      if (req.method === "POST") {
        const manejadores: Record<string, (d: Record<string, unknown>) => Record<string, unknown>> = {
          "/api/previsualizar": previsualizar,
          "/api/idea": previsualizarIdea,
        };
        if (!(ruta in manejadores)) {
          errorJson(res, 404, `ruta desconocida: ${ruta}`);
          return;
        }
        const crudo = (await leerCuerpo(req)) || "{}";
        let datos: unknown;
        try {
          datos = JSON.parse(crudo || "{}");
        } catch {
          errorJson(res, 400, "JSON inválido: no se pudo parsear el cuerpo");
          return;
        }
        if (typeof datos !== "object" || datos === null || Array.isArray(datos)) {
          errorJson(res, 400, "el cuerpo debe ser un objeto JSON");
          return;
        }
        json(res, 200, manejadores[ruta](datos as Record<string, unknown>));
        return;
      }
      errorJson(res, 404, `ruta desconocida: ${ruta}`);
    } catch (e) {
      if (e instanceof ValueError) {
        errorJson(res, 400, e.message);
      } else {
        // No exponer detalles internos (stack/mensajes) al cliente.
        console.error("error interno en el preview:", e);
        errorJson(res, 500, "error interno del servidor");
      }
    }
  });
}

export function main(): void {
  const servidor = createPreviewServer();
  servidor.listen(PUERTO, HOST, () => {
    console.log(`Vista previa de módulos paramétricos en http://${HOST}:${PUERTO}`);
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
