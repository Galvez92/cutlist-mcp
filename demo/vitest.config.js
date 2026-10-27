import { defineConfig } from 'vitest/config';
import { alias } from './aliases.js';

export default defineConfig({
  resolve: { alias },
  test: {
    environment: 'node', // las pruebas del DOM piden jsdom con @vitest-environment
    include: ['tests/**/*.test.js'],
  },
});
