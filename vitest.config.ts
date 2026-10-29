import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

const engineDir = fileURLToPath(new URL('./src', import.meta.url));

export default defineConfig({
  resolve: {
    alias: { '@engine': engineDir },
  },
  test: {
    environment: 'node',
    include: [
      'tests/**/*.test.ts',
      'demo/tests/**/*.test.js',
    ],
    // Pruebas del servidor MCP: usan node:test y corren con `npm run test:mcp`.
    exclude: [
      'tests/modulos.test.ts',
      'tests/optimizar.test.ts',
      'tests/export.test.ts',
      'tests/servidor.test.ts',
      'tests/stdio.test.ts',
      '**/node_modules/**',
    ],
  },
});
