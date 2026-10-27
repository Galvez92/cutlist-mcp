/** Página de presentación del servidor MCP (sólo informativa, sin estado). */

import { catalogoFormatos } from './export';

const HERRAMIENTAS = [
  {
    nombre: 'crear_modulo',
    descripcion:
      'Medidas de un módulo (cajonera, clóset, cocina, librero) → lista de piezas con canto y veta, en milímetros.'
  },
  {
    nombre: 'listar_piezas',
    descripcion: 'Normaliza y revisa una lista de piezas: unidades, metros cuadrados por grupo y material.'
  },
  {
    nombre: 'optimizar_corte',
    descripcion:
      'Piezas + tableros en stock → layout por hoja, aprovechamiento y lista de piezas que no cupieron (guillotina o MaxRects).'
  },
  {
    nombre: 'exportar',
    descripcion:
      'Exporta a los formatos soportados (cortecloud, csv, svg, dxf) con su estado de verificación; sin `formato`, devuelve el catálogo.'
  }
] as const;

function escaparHtml(texto: string): string {
  return texto
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

export function paginaPresentacion(): string {
  const herramientas = HERRAMIENTAS.map(
    h => `      <li><code>${h.nombre}</code><p>${escaparHtml(h.descripcion)}</p></li>`
  ).join('\n');

  const formatos = catalogoFormatos()
    .map(
      f =>
        `        <tr><td><code>${f.id}</code></td><td>.${f.extension}</td>` +
        `<td${f.estado === 'por revisar' ? ' class="revisar"' : ''}>${f.estado}</td>` +
        `<td>${escaparHtml(f.nota)}</td></tr>`
    )
    .join('\n');

  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>cutlist-mcp · servidor MCP</title>
  <style>
    body { margin: 0; padding: 2rem 1.25rem 3rem; font-family: ui-sans-serif, system-ui, sans-serif; line-height: 1.5;
           background: #f6f7f9; color: #16181d; }
    main { max-width: 60rem; margin: 0 auto; }
    h1 { font-size: 1.7rem; margin: 0 0 .25rem; }
    p.lead { margin: 0 0 1.75rem; color: #4a4f5a; }
    h2 { font-size: .95rem; text-transform: uppercase; letter-spacing: .06em; color: #4a4f5a; margin: 2rem 0 .5rem; }
    ul { list-style: none; padding: 0; margin: 0; display: grid; gap: .75rem; }
    li { background: #fff; border: 1px solid #dfe2e8; border-radius: .5rem; padding: .85rem 1rem; }
    li p { margin: .35rem 0 0; color: #4a4f5a; font-size: .92rem; }
    code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
    pre { background: #16181d; color: #f6f7f9; padding: .9rem 1rem; border-radius: .5rem; overflow-x: auto; font-size: .85rem; }
    table { border-collapse: collapse; width: 100%; background: #fff; }
    th, td { border: 1px solid #dfe2e8; padding: .5rem .65rem; text-align: left; font-size: .88rem; vertical-align: top; }
    th { background: #eef1f5; }
    .revisar { color: #8a4b00; }
    @media (max-width: 40rem) { table, thead, tbody, tr, td, th { display: block; } th { display: none; } }
  </style>
</head>
<body>
<main>
  <h1>cutlist-mcp</h1>
  <p class="lead">Optimizador de corte de tableros pensado para agentes:
  módulos paramétricos → piezas → optimización → exportación. El mismo servidor MCP se expone por stdio y por HTTP.</p>

  <h2>Herramientas MCP</h2>
  <ul>
${herramientas}
  </ul>

  <h2>Cómo conectarse</h2>
  <pre>// stdio (clientes de escritorio) — ver docs/mcp-server.md
{ "command": "npx", "args": ["tsx", "src/stdio.ts"] }

// HTTP (Streamable HTTP, JSON-RPC)
POST http://localhost:3000/mcp</pre>

  <h2>Formatos de exportación</h2>
  <table>
    <thead><tr><th>Formato</th><th>Archivo</th><th>Estado</th><th>Nota</th></tr></thead>
    <tbody>
${formatos}
    </tbody>
  </table>
</main>
</body>
</html>
`;
}
