import { readFileSync } from 'node:fs';
import matter from 'gray-matter';
import { describe, expect, it } from 'vitest';
import { worksSchema } from '../../../src/schemas/content';

function workFrontmatter(path: string) {
  return worksSchema.parse(matter(readFileSync(path, 'utf8')).data);
}

describe('research Works metadata', () => {
  it('keeps Broad Reach, Uneven Depth unpublished until its paper URL exists', () => {
    const work = workFrontmatter('src/data/works/broad-reach-uneven-depth.mdx');

    expect(work).toMatchObject({
      title:
        'Broad Reach, Uneven Depth? Reconciling Philippine Generative-AI Diffusion Across Three Telemetry Systems',
      shortTitle: 'Broad Reach, Uneven Depth?',
      summary:
        'A cross-platform audit showing how Philippine generative-AI standing shifts across three telemetry systems.',
      type: 'research',
      status: 'draft',
      assistant: false,
      featured: false,
      venue: 'SSRN Working Paper',
      image: {
        alt: 'A luminous network stretching across a dark landscape with bright streams descending to uneven depths',
        width: 1920,
        height: 1080,
      },
    });
    expect(work.date.getUTCFullYear()).toBe(2026);
    expect(work.date.getUTCMonth()).toBe(6);
    expect(work.image?.url).toMatch(
      /^https:\/\/[^/]+\.public\.blob\.vercel-storage\.com\/images\/works\/broad-reach-uneven-depth-[a-f0-9]{8}\.webp$/u,
    );
    expect(work.links).toBeUndefined();
    expect(work.repository).toBeUndefined();
    expect(work.demo).toBeUndefined();
  });

  it('records the Recursive Convergence Hypothesis cover with intrinsic dimensions', () => {
    const work = workFrontmatter(
      'src/data/works/recursive-convergence-hypothesis.mdx',
    );

    expect(work.image).toMatchObject({
      alt: 'Blue and gold human silhouettes spiraling toward a shared luminous convergence point',
      width: 1920,
      height: 1080,
    });
    expect(work.image?.url).toMatch(
      /^https:\/\/[^/]+\.public\.blob\.vercel-storage\.com\/images\/works\/recursive-convergence-hypothesis-[a-f0-9]{8}\.webp$/u,
    );
    expect(work.shortTitle).toBe('The Recursive Convergence Hypothesis');
    expect(work.summary).toBe(
      'A framework for how ASI may converge on synthetic sentience through recursive self-improvement.',
    );
  });
});
