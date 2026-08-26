import { describe, expect, it } from 'vitest';
import { validateRoutingMiddlewareArtifact } from '../../../scripts/verify-routing-middleware-artifact';

const validArtifact = {
  config: {
    version: 3,
    framework: { slug: 'astro', version: '7.2.6' },
    routes: [
      {
        middlewarePath: 'middleware',
        middlewareRawSrc: ['/', '/blog/:path*'],
      },
    ],
  },
  functionDirectories: ['middleware.func'],
  staticFiles: ['index.html', 'blog/index.html'],
};

describe('Vercel routing middleware artifact', () => {
  it('accepts static Astro output with only the routing middleware function', () => {
    expect(validateRoutingMiddlewareArtifact(validArtifact)).toEqual([]);
  });

  it.each([
    {
      name: 'missing middleware route',
      artifact: {
        ...validArtifact,
        config: { ...validArtifact.config, routes: [] },
      },
    },
    {
      name: 'hosted page function',
      artifact: {
        ...validArtifact,
        functionDirectories: ['middleware.func', 'index.func'],
      },
    },
    {
      name: 'missing static document',
      artifact: { ...validArtifact, staticFiles: ['blog/index.html'] },
    },
  ])('rejects $name', ({ artifact }) => {
    expect(validateRoutingMiddlewareArtifact(artifact)).not.toEqual([]);
  });
});
