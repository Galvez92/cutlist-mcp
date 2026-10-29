import { defineConfig } from 'vite';
import { alias, repoRoot } from './aliases.js';

export default defineConfig({
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    // El motor vive en ../src (TypeScript) y el fixture real en ../tests/fixtures.
    fs: { allow: [repoRoot] },
  },
  resolve: { alias },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});
