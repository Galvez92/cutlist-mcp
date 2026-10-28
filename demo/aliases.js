import { fileURLToPath } from 'node:url';

/** Raíz del repo (un nivel arriba de demo/). */
export const repoRoot = fileURLToPath(new URL('..', import.meta.url));

/** Motor (optimizer-engine): código en ../src y fixture real en ../tests/fixtures. */
export const engineDir = fileURLToPath(new URL('../src', import.meta.url));

/** Alias usado por Vite (dev/build) y por Vitest (pruebas). */
export const alias = { '@engine': engineDir };
