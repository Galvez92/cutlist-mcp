/**
 * Anfitriones y orígenes que acepta el servidor HTTP en `/mcp`.
 *
 * Las guardas del SDK comparan el **nombre** del `Host` y el **nombre** del
 * `Origin` (sin esquema ni puerto), así que las listas son de nombres:
 *
 * - Por omisión solo pasa `localhost` (servidor local normal, sin cambios).
 * - `MCP_ANFITRIONES` añade los nombres con los que otra app llama al servidor,
 *   por ejemplo el dominio donde se despliegue este repo.
 * - `MCP_ORIGENES` añade los nombres de las páginas que pueden llamarlo desde el
 *   navegador. Una llamada servidor a servidor no manda `Origin` y no lo necesita.
 *
 * Se documenta en `docs/mcp-server.md` («Integración desde otra app»).
 */

/** Nombres locales que siempre se aceptan. */
export const ANFITRIONES_LOCALES = ['localhost', '127.0.0.1', '[::1]'];

/** Convierte una lista separada por comas en nombres limpios, sin vacíos. */
export function nombresDeLista(valor: string | undefined): string[] {
  return (valor ?? '')
    .split(',')
    .map(nombre => nombre.trim())
    .filter(nombre => nombre.length > 0);
}

/** Nombres aceptados en el `Host` de `/mcp`: los locales más `MCP_ANFITRIONES`. */
export function anfitrionesPermitidos(env: { MCP_ANFITRIONES?: string } = process.env): string[] {
  return [...ANFITRIONES_LOCALES, ...nombresDeLista(env.MCP_ANFITRIONES)];
}

/** Nombres aceptados en el `Origin` de `/mcp`: los locales más `MCP_ORIGENES`. */
export function origenesPermitidos(env: { MCP_ORIGENES?: string } = process.env): string[] {
  return [...ANFITRIONES_LOCALES, ...nombresDeLista(env.MCP_ORIGENES)];
}
