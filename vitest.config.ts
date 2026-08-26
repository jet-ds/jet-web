import { getViteConfig } from 'astro/config';

export default getViteConfig({
  resolve: {
    alias: {
      'astro:content': new URL(
        './tests/fixtures/astroContent.ts',
        import.meta.url,
      ).pathname,
    },
  },
  // @ts-expect-error Vitest extends Vite's config with this test boundary.
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
