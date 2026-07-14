import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      'astro:content': new URL('./tests/fixtures/astroContent.ts', import.meta.url).pathname,
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/{unit,integration}/**/*.test.{ts,tsx}'],
    coverage: {
      reporter: ['text', 'html'],
      include: ['src/**/*.{ts,tsx}'],
    },
  },
});
