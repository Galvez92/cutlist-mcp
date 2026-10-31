/**
 * Entrada HTTP: expone el mismo servidor MCP por Streamable HTTP en `/mcp`
 * y sirve la página informativa en `/`.
 *
 * Protecciones: se validan las cabeceras `Host` y `Origin` (anti DNS rebinding)
 * con las guardas del SDK. En el entorno de preview de Base44 el proxy reenvía un
 * `Host` por sandbox (`<puerto>-<id>.$BASE44_SANDBOX_HOST_DOMAIN`) y el navegador
 * manda un `Origin` público (`https://<puerto>-$BASE44_PUBLIC_HOST_SUFFIX`), así que
 * sólo con `BASE44_PREVIEW_MODE=1` se añaden esos dos nombres a la lista permitida.
 * Sin la variable, se comporta como un servidor local normal (localhost más lo que se
 * configure en `MCP_ANFITRIONES` / `MCP_ORIGENES` para otra app, ver `src/red.ts`).
 */

import { createServer as crearServidorHttp, type IncomingMessage, type ServerResponse } from 'node:http';

import { hostHeaderValidation, originValidation, toNodeHandler } from '@modelcontextprotocol/node';
import { createMcpHandler } from '@modelcontextprotocol/server';

import { paginaPresentacion } from './pagina.js';
import { anfitrionesPermitidos, origenesPermitidos } from './red.js';
import { crearServidor } from './servidor.js';

const puerto = Number(process.env.PORT ?? 3000);
const anfitrion = process.env.HOST ?? '0.0.0.0';
const enPreview = process.env.BASE44_PREVIEW_MODE === '1';
const sufijoPublico = process.env.BASE44_PUBLIC_HOST_SUFFIX?.trim();
const dominioSandbox = process.env.BASE44_SANDBOX_HOST_DOMAIN?.trim();

/** Nombres añadidos únicamente en el sandbox de preview. */
const anfitrionesPreview = enPreview && sufijoPublico ? [`${puerto}-${sufijoPublico}`] : [];
const sufijoPreview = enPreview && dominioSandbox ? `.${dominioSandbox}` : null;

// Listas base: locales + `MCP_ANFITRIONES` / `MCP_ORIGENES` (otra app que llama al
// servidor). Ver `src/red.ts` y `docs/mcp-server.md`.
const validarAnfitrionSdk = hostHeaderValidation([...anfitrionesPermitidos(), ...anfitrionesPreview]);
const validarOrigen = originValidation([...origenesPermitidos(), ...anfitrionesPreview]);

function hostnameDe(cabecera: string | undefined): string | null {
  if (!cabecera) return null;
  try {
    return new URL(`http://${cabecera}`).hostname;
  } catch {
    return null;
  }
}

function validarAnfitrion(req: IncomingMessage, res: ServerResponse): boolean {
  const hostname = hostnameDe(req.headers.host);
  if (sufijoPreview && hostname && hostname.endsWith(sufijoPreview)) return true;
  return validarAnfitrionSdk(req, res);
}

const manejadorMcp = createMcpHandler(() => crearServidor());
const mcp = toNodeHandler(manejadorMcp);

const servidor = crearServidorHttp((req, res) => {
  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);

  if (url.pathname === '/mcp') {
    if (!validarAnfitrion(req, res)) return;
    if (!validarOrigen(req, res)) return;
    void mcp(req, res);
    return;
  }

  if (req.method === 'GET' && url.pathname === '/favicon.ico') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/index.html')) {
    const cuerpo = paginaPresentacion();
    res.writeHead(200, {
      'content-type': 'text/html; charset=utf-8',
      'content-length': Buffer.byteLength(cuerpo)
    });
    res.end(cuerpo);
    return;
  }

  res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
  res.end('404');
});

servidor.listen(puerto, anfitrion, () => {
  console.error(`cutlist-mcp: MCP por HTTP en http://${anfitrion}:${puerto}/mcp (página en /)`);
});

async function apagar(senal: string): Promise<void> {
  console.error(`cutlist-mcp: cerrando por ${senal}`);
  servidor.close();
  await manejadorMcp.close();
  process.exit(0);
}

process.on('SIGINT', () => void apagar('SIGINT'));
process.on('SIGTERM', () => void apagar('SIGTERM'));
