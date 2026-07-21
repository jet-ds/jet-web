import { describe, expect, it } from 'vitest';
import { worksSchema } from '../../../src/schemas/content';

describe('theme-aware Works images', () => {
  it('preserves a dark-mode image and verified intrinsic dimensions', () => {
    const parsed = worksSchema.parse({
      title: 'Digital Squad Timesheet',
      description: 'A weekly operations platform.',
      type: 'project',
      date: '2026-07-18',
      status: 'published',
      assistant: true,
      image: {
        url: 'https://example.com/timesheet-light.png',
        darkUrl: 'https://example.com/timesheet-dark.png',
        alt: 'Digital Squad Timesheet weekly dashboard',
        width: 1920,
        height: 1080,
      },
    });

    expect(parsed.image).toEqual({
      url: 'https://example.com/timesheet-light.png',
      darkUrl: 'https://example.com/timesheet-dark.png',
      alt: 'Digital Squad Timesheet weekly dashboard',
      width: 1920,
      height: 1080,
    });
  });
});
