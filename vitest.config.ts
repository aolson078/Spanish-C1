import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    exclude: ['**/node_modules/**', '**/*.live.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['packages/**/*.ts'],
      exclude: ['packages/**/*.test.ts', 'packages/**/*.live.test.ts'],
    },
  },
});
