import { describe, expect, it } from 'vitest';
import { fixtureContentSchemas } from '../../fixtures/media';
const { worksSchema } = fixtureContentSchemas();

describe('theme-aware Works images', () => {
  it('preserves a dark-mode image and verified intrinsic dimensions', () => {
    const parsed = worksSchema.parse({
      title: 'Digital Squad Timesheet',
      description: 'A weekly operations platform.',
      summary: 'An invented summary of a weekly operations platform.',
      type: 'project',
      date: '2026-07-18',
      status: 'published',
      assistant: true,
      image: {
        asset: 'works/example',
        darkAsset: 'works/example-dark',
        alt: 'Digital Squad Timesheet weekly dashboard',
      },
    });

    expect(parsed.image).toMatchObject({
      asset: 'works/example',
      darkAsset: 'works/example-dark',
      width: 1920,
      height: 1080,
    });
    expect(parsed.image?.darkUrl).toContain('/works/example-dark/');
    expect(parsed.image?.social.url).toContain('/works/example/');
    expect(parsed.image?.darkSrcSet).toContain('480w');
  });
});
