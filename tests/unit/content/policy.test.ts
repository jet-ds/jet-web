import { describe, expect, it } from 'vitest';
import { blogSchema } from '../../../src/schemas/content';
import { isAssistantEligible, isPublished } from '../../../src/content/policy';

const baseBlog = {
  title: 'Example',
  description: 'Example description',
  pubDate: '2026-07-11',
  tags: [],
};

describe('publication policy', () => {
  it('requires an explicit status', () => {
    expect(blogSchema.safeParse(baseBlog).success).toBe(false);
  });

  it('defaults assistant inclusion to false', () => {
    const parsed = blogSchema.parse({ ...baseBlog, status: 'published' });
    expect(parsed.assistant).toBe(false);
  });

  it('publishes only published entries', () => {
    expect(isPublished({ status: 'published', assistant: false })).toBe(true);
    expect(isPublished({ status: 'draft', assistant: true })).toBe(false);
  });

  it('requires both published and assistant enabled', () => {
    expect(isAssistantEligible({ status: 'published', assistant: true })).toBe(
      true,
    );
    expect(isAssistantEligible({ status: 'published', assistant: false })).toBe(
      false,
    );
    expect(isAssistantEligible({ status: 'draft', assistant: true })).toBe(
      false,
    );
  });
});

describe('blog review metadata', () => {
  const review = {
    itemType: 'movie' as const,
    itemName: 'Example Movie',
    ratingValue: 5,
    bestRating: 5 as const,
  };

  it('accepts an explicit movie rating on the five-star scale', () => {
    const parsed = blogSchema.parse({
      ...baseBlog,
      status: 'published',
      review,
    });

    expect(parsed.review).toEqual(review);
  });

  it.each([
    { name: 'unsupported item type', review: { ...review, itemType: 'book' } },
    { name: 'empty item name', review: { ...review, itemName: ' ' } },
    { name: 'rating below the scale', review: { ...review, ratingValue: 0 } },
    { name: 'rating above the scale', review: { ...review, ratingValue: 6 } },
    {
      name: 'unsupported rating increment',
      review: { ...review, ratingValue: 4.2 },
    },
    { name: 'different scale', review: { ...review, bestRating: 10 } },
  ])('rejects an invalid review contract: $name', ({ review: candidate }) => {
    expect(
      blogSchema.safeParse({
        ...baseBlog,
        status: 'published',
        review: candidate,
      }).success,
    ).toBe(false);
  });
});
