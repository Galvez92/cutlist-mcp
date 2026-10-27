import { fileURLToPath } from 'node:url';

/** Raíz del repo (un nivel arriba de demo/). */
export const repoRoot = fileURLToPath(new URL('..', import.meta.url));

/** Motor compartido: código en ../core/src y fixture real en ../tests/fixtures. */
export const coreDir = fileURLToPath(new URL('../core', import.meta.url));

/** Alias usado por Vite (dev/build) y por Vitest (pruebas). */
export const alias = { '@core': fileURLToPath(new URL('../core/src', import.meta.url)) };
