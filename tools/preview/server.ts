/**
 * Servidor de vista previa (solo desarrollo).
 *
 * Sirve estáticamente el directorio `docs/` en el puerto 3000 para el preview,
 * igual que hacía el `python -m http.server` anterior. No es la demo web final
 * (esa va en su propia rama): es sólo para ver la documentación del proyecto.
 * `/health` responde 200 para el healthcheck del contenedor.
 */

import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, extname, join, normalize, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const DOCS = join(ROOT, "docs");
const PORT = Number(process.env.PORT ?? 3000);
const HOST = process.env.HOST ?? "0.0.0.0";

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".csv": "text/csv; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".dxf": "text/plain; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&")
    .replace(/</g, "<")
    .replace(/>/g, ">");
}

function directoryListing(rel: string, names: string[]): string {
  const items = names
    .map((name) => {
      const href = encodeURI(join(rel === "/" ? "/" : rel + "/", name));
      return `<li><a href="${href}">${escapeHtml(name)}</a></li>`;
    })
    .join("\n");
  return `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8">
<title>Directory listing for ${escapeHtml(rel)}</title></head>
<body><h1>Directory listing for ${escapeHtml(rel)}</h1><hr><ul>
${items}
</ul><hr></body></html>`;
}

createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://${HOST}:${PORT}`);
  if (url.pathname === "/health") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ status: "ok" }));
    return;
  }

  const safe = normalize(decodeURIComponent(url.pathname));
  const target = join(DOCS, safe);
  if (!target.startsWith(DOCS + sep) && target !== DOCS) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  try {
    const info = await stat(target);
    if (info.isDirectory()) {
      const { readdir } = await import("node:fs/promises");
      const names = await readdir(target);
      const rel = safe === "." ? "/" : safe.replace(/\\/g, "/");
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      res.end(directoryListing(rel.endsWith("/") ? rel : rel + "/", names));
      return;
    }
    const data = await readFile(target);
    res.writeHead(200, { "content-type": MIME[extname(target)] ?? "application/octet-stream" });
    res.end(data);
  } catch {
    if (existsSync(DOCS)) {
      res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
      res.end("Not found");
    } else {
      res.writeHead(200, { "content-type": "text/plain; charset=utf-8" });
      res.end("cutlist-mcp · formatos (TypeScript). La documentación se sirve desde docs/.");
    }
  }
}).listen(PORT, HOST, () => {
  // eslint-disable-next-line no-console
  console.log(`docs preview en http://${HOST}:${PORT} (sirviendo ${DOCS})`);
});
