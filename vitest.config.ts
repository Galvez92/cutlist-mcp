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
  },
});
