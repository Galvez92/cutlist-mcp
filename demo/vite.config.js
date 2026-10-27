import { defineConfig } from 'vite';
import { alias, repoRoot } from './aliases.js';

export default defineConfig({
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    // El motor vive en ../core y el fixture real en ../tests/fixtures, fuera de demo/.
    fs: { allow: [repoRoot] },
  },
  resolve: { alias },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});
