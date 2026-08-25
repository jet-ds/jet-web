import { describe, expect, it } from 'vitest';
import { blogSchema, worksSchema } from '../../../src/schemas/content';
import {
  assertGeneratedAssistantSources,
  type ContentPolicyError,
  type ContentValidationRecord,
  validateContentRecords,
} from '../../../src/content/validation';

function record(
  overrides: Partial<ContentValidationRecord> = {},
): ContentValidationRecord {
  return {
    path: 'src/data/blog/example.mdx',
    tracked: true,
    canonicalId: 'blog:example',
    canonicalUrl: 'https://jetsanchez.com/blog/example',
    status: 'published',
    assistant: false,
    links: [],
    ...overrides,
  };
}

function expectRule(
  errors: ContentPolicyError[],
  code: ContentPolicyError['code'],
  path: string,
): void {
  expect(errors).toContainEqual(expect.objectContaining({ code, path }));
}

describe('content validation', () => {
  const immutableBlogImage = {
    url: 'https://assets.public.blob.vercel-storage.com/images/blog/invented-post-a1b2c3d4.webp',
    alt: 'An invented editorial illustration',
    width: 1920,
    height: 1080,
  } as const;

  const immutableWorkImage = {
    url: 'https://assets.public.blob.vercel-storage.com/images/works/invented-work-a1b2c3d4.png',
    darkUrl:
      'https://assets.public.blob.vercel-storage.com/images/works/invented-work-dark-e5f6a7b8.png',
    alt: 'An invented project interface in light and dark themes',
    width: 1920,
    height: 1080,
  } as const;

  const publishedBlog = {
    title: 'Invented post',
    description: 'A full description for an invented post.',
    summary: 'A complete summary for an invented post.',
    pubDate: '2026-08-20',
    status: 'published',
    assistant: false,
    image: immutableBlogImage,
  } as const;

  const publishedWork = {
    title: 'Invented work',
    description: 'A full description for an invented work.',
    summary: 'A complete summary for an invented work.',
    type: 'project',
    date: '2026-08-20',
    status: 'published',
    assistant: false,
    image: immutableWorkImage,
  } as const;

  it('allows incomplete Blog and Work drafts but requires published summaries and images', () => {
    expect(
      blogSchema.safeParse({
        title: 'Draft post',
        description: 'Draft description.',
        pubDate: '2026-08-20',
        status: 'draft',
        assistant: false,
      }).success,
    ).toBe(true);
    expect(
      worksSchema.safeParse({
        title: 'Draft work',
        description: 'Draft description.',
        type: 'project',
        date: '2026-08-20',
        status: 'draft',
        assistant: false,
      }).success,
    ).toBe(true);

    const incompleteBlog = blogSchema.safeParse({
      ...publishedBlog,
      summary: undefined,
      image: undefined,
    });
    const incompleteWork = worksSchema.safeParse({
      ...publishedWork,
      summary: undefined,
      image: undefined,
    });

    expect(incompleteBlog.success).toBe(false);
    expect(incompleteWork.success).toBe(false);
    if (!incompleteBlog.success && !incompleteWork.success) {
      expect(incompleteBlog.error.issues.map(({ path }) => path)).toEqual([
        ['summary'],
        ['image'],
      ]);
      expect(incompleteWork.error.issues.map(({ path }) => path)).toEqual([
        ['summary'],
        ['image'],
      ]);
    }
  });

  it.each([
    {
      name: 'mutable Blog URL',
      schema: blogSchema,
      input: {
        ...publishedBlog,
        image: {
          ...immutableBlogImage,
          url: 'https://example.com/images/blog/invented-post.webp',
        },
      },
      path: ['image', 'url'],
    },
    {
      name: 'non-HTTPS Blog Blob URL',
      schema: blogSchema,
      input: {
        ...publishedBlog,
        image: {
          ...immutableBlogImage,
          url: 'http://assets.public.blob.vercel-storage.com/images/blog/invented-post-a1b2c3d4.webp',
        },
      },
      path: ['image', 'url'],
    },
    {
      name: 'query-bearing Blog Blob URL',
      schema: blogSchema,
      input: {
        ...publishedBlog,
        image: {
          ...immutableBlogImage,
          url: `${immutableBlogImage.url}?version=2`,
        },
      },
      path: ['image', 'url'],
    },
    {
      name: 'mutable Work dark URL',
      schema: worksSchema,
      input: {
        ...publishedWork,
        image: {
          ...immutableWorkImage,
          darkUrl: 'https://example.com/images/works/invented-work-dark.png',
        },
      },
      path: ['image', 'darkUrl'],
    },
    {
      name: 'empty Blog alt text',
      schema: blogSchema,
      input: {
        ...publishedBlog,
        image: { ...immutableBlogImage, alt: '   ' },
      },
      path: ['image', 'alt'],
    },
    {
      name: 'wrong Blog width',
      schema: blogSchema,
      input: {
        ...publishedBlog,
        image: { ...immutableBlogImage, width: 1280 },
      },
      path: ['image', 'width'],
    },
    {
      name: 'wrong Work height',
      schema: worksSchema,
      input: {
        ...publishedWork,
        image: { ...immutableWorkImage, height: 720 },
      },
      path: ['image', 'height'],
    },
  ])('rejects a published record with $name', ({ schema, input, path }) => {
    const result = schema.safeParse(input);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toContainEqual(
        expect.objectContaining({ path }),
      );
    }
  });

  it('requires declared dimensions whenever draft image frontmatter exists', () => {
    const result = worksSchema.safeParse({
      title: 'Draft work',
      description: 'Draft description.',
      type: 'project',
      date: '2026-08-20',
      status: 'draft',
      assistant: false,
      image: {
        url: 'https://draft.invalid/image.png',
        alt: 'Draft image',
      },
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.map(({ path }) => path)).toEqual([
        ['image', 'width'],
        ['image', 'height'],
      ]);
    }
  });

  it.each([0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])(
    'rejects invalid homepagePriority %s',
    (homepagePriority) => {
      expect(
        worksSchema.safeParse({
          ...publishedWork,
          homepagePriority,
        }).success,
      ).toBe(false);
    },
  );

  it('accepts a positive integer homepagePriority while retaining featured compatibility', () => {
    const result = worksSchema.safeParse({
      ...publishedWork,
      homepagePriority: 2,
      featured: true,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.homepagePriority).toBe(2);
      expect(result.data.featured).toBe(true);
    }
  });

  it.each([
    {
      name: 'missing status',
      overrides: { status: undefined },
      code: 'missing-status',
    },
    {
      name: 'unsupported status',
      overrides: { status: 'archived' },
      code: 'unsupported-status',
    },
    {
      name: 'non-boolean explicit assistant flag',
      overrides: { assistant: 'true' },
      code: 'invalid-assistant-flag',
    },
    {
      name: 'assistant-enabled draft',
      overrides: { status: 'draft', assistant: true },
      code: 'assistant-not-published',
    },
    {
      name: 'untracked published entry',
      overrides: { tracked: false },
      code: 'published-untracked',
    },
    {
      name: 'HTTP canonical URL',
      overrides: { canonicalUrl: 'http://jetsanchez.com/blog/example' },
      code: 'invalid-canonical-url',
    },
    {
      name: 'relative canonical URL',
      overrides: { canonicalUrl: '/blog/example' },
      code: 'invalid-canonical-url',
    },
    {
      name: 'malformed canonical URL',
      overrides: { canonicalUrl: 'not a URL' },
      code: 'invalid-canonical-url',
    },
    {
      name: 'HTTP published link URL',
      overrides: {
        links: [{ label: 'Reference', url: 'http://example.com/reference' }],
      },
      code: 'invalid-link-url',
    },
    {
      name: 'relative published link URL',
      overrides: { links: [{ label: 'Reference', url: '/reference' }] },
      code: 'invalid-link-url',
    },
    {
      name: 'non-string published link URL',
      overrides: { links: [{ label: 'Reference', url: 42 }] },
      code: 'invalid-link-url',
    },
  ] satisfies Array<{
    name: string;
    overrides: Partial<ContentValidationRecord>;
    code: ContentPolicyError['code'];
  }>)(
    'reports $name with a stable path-qualified rule',
    ({ overrides, code }) => {
      const input = record(overrides);
      expectRule(validateContentRecords([input]), code, input.path);
    },
  );

  it('does not apply publication predicates after invalid raw fields', () => {
    const input = record({
      tracked: false,
      status: 'archived',
      assistant: true,
    });

    expect(validateContentRecords([input])).toEqual([
      expect.objectContaining({
        code: 'unsupported-status',
        path: input.path,
      }),
    ]);
  });

  it('allows omitted assistant because the shared schema defaults it to false', () => {
    expect(validateContentRecords([record({ assistant: undefined })])).toEqual(
      [],
    );
  });

  it('validates published links but leaves draft links for authoring', () => {
    expect(
      validateContentRecords([
        record({
          status: 'draft',
          assistant: false,
          links: [{ label: 'Work in progress', url: '#' }],
        }),
      ]),
    ).toEqual([]);
  });

  it('detects canonical IDs that normalize to the same Unicode value', () => {
    const first = record({ canonicalId: 'blog:caf\u00e9' });
    const duplicate = record({
      path: 'src/data/blog/cafe-combining.mdx',
      canonicalId: 'blog:cafe\u0301',
      canonicalUrl: 'https://jetsanchez.com/blog/cafe-combining',
    });

    expectRule(
      validateContentRecords([first, duplicate]),
      'duplicate-canonical-id',
      duplicate.path,
    );
  });

  it('detects canonical URLs that are equal after URL normalization', () => {
    const first = record({
      canonicalUrl: 'https://JETsanchez.com:443/blog/example',
    });
    const duplicate = record({
      path: 'src/data/blog/duplicate-url.mdx',
      canonicalId: 'blog:duplicate-url',
      canonicalUrl: 'https://jetsanchez.com/blog/example',
    });

    expectRule(
      validateContentRecords([first, duplicate]),
      'duplicate-canonical-url',
      duplicate.path,
    );
  });

  it.each([
    {
      name: 'missing',
      records: [record()],
      generatedId: 'blog:missing',
      path: 'generated:blog:missing',
    },
    {
      name: 'ineligible',
      records: [record({ status: 'draft', assistant: false })],
      generatedId: 'blog:example',
      path: 'src/data/blog/example.mdx',
    },
    {
      name: 'untracked',
      records: [record({ tracked: false, assistant: true })],
      generatedId: 'blog:example',
      path: 'src/data/blog/example.mdx',
    },
  ])(
    'rejects a $name generated assistant source',
    ({ records, generatedId, path }) => {
      expectRule(
        assertGeneratedAssistantSources(records, [generatedId]),
        'generated-source-ineligible',
        path,
      );
    },
  );

  it('accepts an untracked disabled draft without making it a generated source', () => {
    const draft = record({ tracked: false, status: 'draft', assistant: false });

    expect(validateContentRecords([draft])).toEqual([]);
    expect(assertGeneratedAssistantSources([draft], [])).toEqual([]);
    expectRule(
      assertGeneratedAssistantSources([draft], [draft.canonicalId]),
      'generated-source-ineligible',
      draft.path,
    );
  });

  it.each([
    {
      name: 'requires explicit publication status',
      overrides: { status: undefined },
      code: 'missing-status',
    },
    {
      name: 'rejects assistant-enabled drafts',
      overrides: { status: 'draft', assistant: true },
      code: 'assistant-not-published',
    },
  ] satisfies Array<{
    name: string;
    overrides: Partial<ContentValidationRecord>;
    code: ContentPolicyError['code'];
  }>)(
    'applies $name to the canonical profile record',
    ({ overrides, code }) => {
      const profile = record({
        path: 'src/data/profile/jet-sanchez.mdx',
        canonicalId: 'profile:jet-sanchez',
        canonicalUrl: 'https://jetsanchez.com/about/',
        assistant: true,
        ...overrides,
      });

      expectRule(validateContentRecords([profile]), code, profile.path);
    },
  );
});
