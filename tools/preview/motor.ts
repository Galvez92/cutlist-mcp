/**
 * Servidor de vista previa (solo desarrollo).
 *
 * Corre el motor sobre un pedido de EJEMPLO y muestra el plano en SVG, la
 * comparación de algoritmos y la lista de corte, con descargas en SVG/PDF/JSON.
 * No es la demo pública (esa va en su propia rama) ni parte de la API del
 * motor: es una herramienta para ver y verificar el resultado del motor.
 */

import { createServer } from "node:http";

import {
  type AlgorithmOption,
  type LayoutResult,
  type OptimizeRequest,
  type PartInput,
  type SheetInput,
  formatMm,
  formatPct,
  optimize,
  renderLayoutPdf,
  renderLayoutSvg,
} from "../../src/index.js";

const PORT = Number(process.env.PORT ?? 3000);
const HOST = process.env.HOST ?? "0.0.0.0";

/** Medidas de ejemplo de un clóset de 2 puertas (no es un pedido real). */
const MATERIAL = "Melamina blanca 18 mm";

const DEMO_PARTS_BASE: PartInput[] = [
  { code: "C1", label: "Costado", width: 560, height: 1800, qty: 2, grain: "vertical", edges: { left: 0.4, right: 0.4 } },
  { code: "P1", label: "Piso", width: 1180, height: 560, qty: 1, edges: { top: 0.4 } },
  { code: "T1", label: "Techo", width: 1180, height: 560, qty: 1 },
  { code: "E1", label: "Estante", width: 1180, height: 520, qty: 4, edges: { top: 0.4 } },
  { code: "PU1", label: "Puerta", width: 446, height: 1790, qty: 2, grain: "vertical", edges: { left: 0.4, right: 0.4, top: 0.4, bottom: 0.4 } },
  { code: "Z1", label: "Zócalo", width: 1180, height: 100, qty: 1 },
  { code: "TR1", label: "Travesaño", width: 1180, height: 80, qty: 2 },
];

const DEMO_PARTS: PartInput[] = DEMO_PARTS_BASE.map((part) => ({
  ...part,
  material: MATERIAL,
  thickness: 18,
}));

const DEMO_SHEETS: SheetInput[] = [
  {
    id: "melamina-18",
    label: "Melamina blanca 18 mm",
    width: 2500,
    height: 1830,
    thickness: 18,
    kerf: 3,
    qty: 10,
    material: MATERIAL,
  },
];

/** Kerf de ejemplo (3 mm): el kerf real depende de la sierra de cada taller. */
const DEMO_REQUEST: OptimizeRequest = {
  parts: DEMO_PARTS,
  sheets: DEMO_SHEETS,
  kerf: 3,
  algorithm: "auto",
};

function compute(algorithm: AlgorithmOption = "auto"): LayoutResult {
  return optimize({ ...DEMO_REQUEST, algorithm });
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function metricsBlock(layout: LayoutResult): string {
  const rows: [string, string][] = [
    ["Piezas colocadas", `${layout.metrics.placed} / ${layout.metrics.partInstances}`],
    ["Sin colocar", `${layout.metrics.unplaced}`],
    ["Hojas usadas", `${layout.metrics.sheetsUsed}`],
    ["Aprovechamiento", formatPct(layout.metrics.yieldPct)],
    ["Algoritmo", `${layout.algorithm} · orden ${layout.ordering}`],
  ];
  return `<dl class="metrics">${rows
    .map(
      ([label, value]) =>
        `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`,
    )
    .join("")}</dl>`;
}

function attemptsTable(layout: LayoutResult): string {
  const rows = layout.attempts
    .map(
      (attempt) =>
        `<tr><td>${escapeHtml(attempt.algorithm)}</td><td>${escapeHtml(attempt.ordering)}</td><td>${attempt.sheetsUsed}</td><td>${formatPct(attempt.yieldPct)}</td><td>${attempt.unplacedQuantity}</td></tr>`,
    )
    .join("");
  return `<div class="table-wrap"><table><thead><tr><th>Algoritmo</th><th>Orden</th><th>Hojas</th><th>Aprovechamiento</th><th>Sin colocar</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

function cutListTable(layout: LayoutResult): string {
  const rows = layout.cutList
    .map(
      (row) =>
        `<tr><td>${escapeHtml(row.code)}</td><td>${escapeHtml(row.label)}</td><td>${row.quantity}</td><td>${formatMm(row.cutWidth)} × ${formatMm(row.cutHeight)}</td><td>${escapeHtml(row.edgeSummary || "—")}</td><td>${row.sheets.length ? row.sheets.join(", ") : "sin colocar"}</td></tr>`,
    )
    .join("");
  return `<div class="table-wrap"><table><thead><tr><th>Código</th><th>Pieza</th><th>Cant.</th><th>Corte (mm)</th><th>Cantos</th><th>Hojas</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

function page(algorithm: AlgorithmOption): string {
  const layout = compute(algorithm);
  const unplaced = layout.unplaced.length
    ? `<h2>Piezas sin colocar</h2><ul>${layout.unplaced
        .map(
          (entry) =>
            `<li>${escapeHtml(entry.code)} ×${entry.quantity} — ${escapeHtml(entry.detail)}</li>`,
        )
        .join("")}</ul>`
    : "";

  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>cutlist-mcp · motor de corte</title>
<style>
  :root { color-scheme: light; }
  body { margin: 0; padding: 24px; font-family: system-ui, -apple-system, "Segoe UI", sans-serif; background: #f4f5f7; color: #1a202c; }
  main { max-width: 1080px; margin: 0 auto; background: #fff; padding: 24px; border-radius: 10px; }
  h1 { font-size: 20px; margin: 0 0 4px; }
  h2 { font-size: 15px; margin: 24px 0 8px; }
  p.lead { margin: 0 0 16px; color: #4a5568; font-size: 13px; }
  .metrics { display: flex; flex-wrap: wrap; gap: 8px; margin: 0; }
  .metrics div { background: #f0f4f8; border-radius: 6px; padding: 8px 12px; min-width: 140px; }
  .metrics dt { font-size: 11px; text-transform: uppercase; letter-spacing: .04em; color: #4a5568; }
  .metrics dd { margin: 2px 0 0; font-size: 16px; font-weight: 600; }
  .table-wrap { overflow-x: auto; max-width: 100%; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  @media (max-width: 640px) { body { padding: 12px; } main { padding: 16px; } }
  th, td { text-align: left; padding: 6px 8px; border-bottom: 1px solid #e2e8f0; }
  th { font-size: 11px; text-transform: uppercase; letter-spacing: .04em; color: #4a5568; }
  .plan svg { max-width: 100%; height: auto; }
  .links a { margin-right: 12px; }
  .links { font-size: 13px; }
</style>
</head>
<body>
<main>
  <h1>cutlist-mcp · motor de corte de tableros</h1>
  <p class="lead">Vista de desarrollo con un pedido de ejemplo (clóset de 2 puertas, melamina 18 mm, tablero 2500 × 1830 mm, kerf 3 mm). Los datos son un ejemplo, no un pedido real.</p>
  ${metricsBlock(layout)}
  <h2>Plan de corte</h2>
  <div class="plan">${renderLayoutSvg(layout, { widthPx: 820 })}</div>
  ${unplaced}
  <h2>Intentos probados (mejor primero)</h2>
  ${attemptsTable(layout)}
  <h2>Lista de corte</h2>
  ${cutListTable(layout)}
  <h2>Salidas</h2>
  <p class="links"><a href="/layout.svg?algorithm=${algorithm}">Plano SVG</a><a href="/layout.pdf?algorithm=${algorithm}">Plano PDF</a><a href="/layout.json?algorithm=${algorithm}">Layout JSON</a></p>
</main>
</body>
</html>`;
}

function readAlgorithm(url: URL): AlgorithmOption {
  const value = url.searchParams.get("algorithm");
  return value === "guillotine" || value === "maxrects" || value === "auto"
    ? value
    : "auto";
}

const server = createServer((request, response) => {
  try {
    const url = new URL(request.url ?? "/", "http://localhost");

    if (url.pathname === "/health") {
      const layout = compute("auto");
      response.writeHead(200, { "content-type": "application/json; charset=utf-8" });
      response.end(
        JSON.stringify({
          status: "ok",
          placed: layout.metrics.placed,
          sheets: layout.metrics.sheetsUsed,
          yieldPct: layout.metrics.yieldPct,
        }),
      );
      return;
    }

    if (url.pathname === "/" || url.pathname === "/index.html") {
      response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      response.end(page(readAlgorithm(url)));
      return;
    }

    if (url.pathname === "/layout.svg") {
      const layout = compute(readAlgorithm(url));
      response.writeHead(200, { "content-type": "image/svg+xml; charset=utf-8" });
      response.end(renderLayoutSvg(layout, { widthPx: 900 }));
      return;
    }

    if (url.pathname === "/layout.pdf") {
      const layout = compute(readAlgorithm(url));
      const pdf = renderLayoutPdf(layout);
      response.writeHead(200, {
        "content-type": "application/pdf",
        "content-disposition": 'attachment; filename="plan-de-corte.pdf"',
        "content-length": pdf.byteLength,
      });
      response.end(Buffer.from(pdf));
      return;
    }

    if (url.pathname === "/layout.json") {
      const layout = compute(readAlgorithm(url));
      response.writeHead(200, { "content-type": "application/json; charset=utf-8" });
      response.end(JSON.stringify(layout, null, 2));
      return;
    }

    response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    response.end("No encontrado. Rutas: /, /health, /layout.svg, /layout.pdf, /layout.json");
  } catch (error) {
    response.writeHead(500, { "content-type": "text/plain; charset=utf-8" });
    response.end(
      `Error del motor: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
});

server.listen(PORT, HOST, () => {
  console.log(`cutlist-mcp · vista de desarrollo en http://${HOST}:${PORT}`);
});
