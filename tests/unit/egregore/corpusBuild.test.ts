import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import type {
  BlogFrontmatter,
  WorksFrontmatter,
} from '../../../src/schemas/content';
import {
  buildKnowledgeBase,
  canonicalSerialize,
  computeSourceHash,
  resolveSourceCommit,
  type AssistantSourceEntry,
} from '../../../src/features/egregore/corpus/build';
import { serializeSourcePayload } from '../../../src/features/egregore/sourcePayload';

const blogData: BlogFrontmatter = {
  title: 'Included guide',
  seoTitle: 'Included local retrieval guide',
  seoDescription: 'A compact local retrieval guide.',
  description: 'A guide about durable local retrieval.',
  summary: 'An invented summary of a durable local retrieval guide.',
  pubDate: new Date('2026-01-02T00:00:00.000Z'),
  updatedDate: new Date('2026-01-03T00:00:00.000Z'),
  author: 'Jet Sanchez',
  tags: ['local-first', 'retrieval'],
  status: 'published',
  assistant: true,
  image: {
    url: 'https://assets.public.blob.vercel-storage.com/images/blog/included-guide-a1b2c3d4.png',
    alt: 'A local retrieval diagram',
    width: 1920,
    height: 1080,
  },
};

const worksData: WorksFrontmatter = {
  title: 'Research project',
  seoTitle: 'Research Project',
  seoDescription: 'A compact research project summary.',
  description: 'A complete work fixture.',
  summary: 'An invented summary of a complete research project.',
  type: 'research',
  date: new Date('2025-08-27T00:00:00.000Z'),
  tags: ['AI', 'research'],
  status: 'published',
  assistant: true,
  image: {
    url: 'https://assets.public.blob.vercel-storage.com/images/works/research-project-e5f6a7b8.png',
    alt: 'A research illustration',
    width: 1920,
    height: 1080,
  },
  links: [{ label: 'View paper', url: 'https://example.com/paper' }],
  venue: 'Example venue',
  abstract: 'An abstract.',
  technologies: ['TypeScript'],
  repository: 'https://example.com/repository',
  demo: 'https://example.com/demo',
};

function blogEntry(
  overrides: Partial<AssistantSourceEntry> = {},
): AssistantSourceEntry {
  return {
    collection: 'blog',
    slug: 'included',
    sourcePath: 'src/data/blog/included.mdx',
    tracked: true,
    body: 'Introduction.\n\n## Retrieval\n\nRunning retrieval locally.',
    data: structuredClone(blogData),
    ...overrides,
  } as AssistantSourceEntry;
}

function worksEntry(
  overrides: Partial<AssistantSourceEntry> = {},
): AssistantSourceEntry {
  return {
    collection: 'works',
    slug: 'research-project',
    sourcePath: 'src/data/works/research-project.mdx',
    tracked: true,
    body: 'Research introduction.\n\n## Findings\n\nGrounded findings.',
    data: structuredClone(worksData),
    ...overrides,
  } as AssistantSourceEntry;
}

function profileEntry(
  overrides: Partial<AssistantSourceEntry> = {},
): AssistantSourceEntry {
  return {
    collection: 'profile',
    slug: 'jet-sanchez',
    sourcePath: 'src/data/profile/jet-sanchez.mdx',
    tracked: true,
    body: 'I work on applied AI.\n\n## Research\n\nAI systems and governance.',
    data: {
      title: 'Jet Sanchez',
      description: 'Canonical public profile.',
      date: new Date('2026-07-26T00:00:00.000Z'),
      author: 'Jet Sanchez',
      status: 'published',
      assistant: true,
      role: 'Marketing Engineer & AI Researcher',
      organization: 'Digital Squad',
      researchAreas: ['Artificial Intelligence'],
      technicalFocus: ['Marketing Engineering'],
      connectText: 'Connect about applied AI.',
    },
    ...overrides,
  } as AssistantSourceEntry;
}

describe('knowledge-base generation', () => {
  it('includes only published assistant sources and emits a stable corpus digest', () => {
    const excluded = blogEntry({
      slug: 'excluded',
      sourcePath: 'src/data/blog/excluded.mdx',
      data: { ...structuredClone(blogData), assistant: false },
    });
    const input = [excluded, blogEntry()];
    const result = buildKnowledgeBase(input, 'abc');

    expect(result.content.documents.map((document) => document.id)).toEqual([
      'blog:included',
    ]);
    expect(result.manifest.corpusVersion).toMatch(/^[a-f0-9]{64}$/);
    expect(buildKnowledgeBase(input, 'abc').manifest.corpusVersion).toBe(
      buildKnowledgeBase(input, 'abc').manifest.corpusVersion,
    );
  });

  it('includes the eligible canonical profile once at the About URL', () => {
    const result = buildKnowledgeBase([blogEntry(), profileEntry()], 'abc');

    expect(
      result.content.documents.filter(
        (document) => document.id === 'profile:jet-sanchez',
      ),
    ).toEqual([
      expect.objectContaining({
        canonicalUrl: 'https://jetsanchez.com/about/',
        sourcePath: 'src/data/profile/jet-sanchez.mdx',
      }),
    ]);
    expect(
      result.content.documents.map((document) => document.canonicalUrl),
    ).not.toContain('https://jetsanchez.com/profile/jet-sanchez/');
  });

  it('rejects assistant-enabled drafts before filtering', () => {
    const draft = blogEntry({
      data: { ...structuredClone(blogData), status: 'draft', assistant: true },
    });

    expect(() => buildKnowledgeBase([draft], 'abc')).toThrow(
      /assistant.*published/i,
    );
  });

  it('rejects eligible untracked sources inside the generator', () => {
    expect(() =>
      buildKnowledgeBase([blogEntry({ tracked: false })], 'abc'),
    ).toThrow(/tracked/i);
  });

  it('sorts canonical arrays independently of source input order', () => {
    const first = buildKnowledgeBase([worksEntry(), blogEntry()], 'same-sha');
    const second = buildKnowledgeBase([blogEntry(), worksEntry()], 'same-sha');

    expect(canonicalSerialize(first)).toBe(canonicalSerialize(second));
    expect(
      first.content.documents.map(({ id, order }) => ({ id, order })),
    ).toEqual([
      { id: 'blog:included', order: 0 },
      { id: 'works:research-project', order: 1 },
    ]);
  });

  it('binds the full-corpus statistic to the canonical runtime source payload', () => {
    const first = buildKnowledgeBase([worksEntry(), blogEntry()], 'same-sha');
    const second = buildKnowledgeBase([blogEntry(), worksEntry()], 'same-sha');
    const documentsById = new Map(
      first.content.documents.map((document) => [document.id, document]),
    );
    const sectionsById = new Map(
      first.content.sections.map((section) => [section.id, section]),
    );
    const payload = first.content.chunks.map((chunk, index) => {
      const document = documentsById.get(chunk.documentId)!;
      const section = sectionsById.get(chunk.sectionId)!;
      return {
        citationId: `S${index + 1}` as const,
        documentId: document.id,
        sectionId: section.id,
        chunkId: chunk.id,
        title: document.title,
        canonicalUrl: document.canonicalUrl,
        heading: section.heading,
        text: chunk.text,
      };
    });
    const exactTokens = serializeSourcePayload(payload).estimatedTokens;

    expect(first.content.statistics.fullCorpusKnowledgeTokens).toBe(
      exactTokens,
    );
    expect(first.manifest.statistics.fullCorpusKnowledgeTokens).toBe(
      exactTokens,
    );
    expect(second.manifest.statistics.fullCorpusKnowledgeTokens).toBe(
      exactTokens,
    );
    expect(first.content.schemaVersion).toBe('1.0.0');
  });

  it('binds content provenance but excludes sourceCommit from corpusVersion', () => {
    const first = buildKnowledgeBase([blogEntry()], 'commit-a');
    const second = buildKnowledgeBase([blogEntry()], 'commit-b');

    expect(first.manifest.corpusVersion).toBe(second.manifest.corpusVersion);
    expect(first.manifest.contentSha256).not.toBe(
      second.manifest.contentSha256,
    );
    expect(first.content.sourceCommit).toBe('commit-a');
    expect(second.content.sourceCommit).toBe('commit-b');
  });

  it('propagates canonical provenance and explicit orders', () => {
    const result = buildKnowledgeBase([blogEntry()], 'commit-a');
    const document = result.content.documents[0];

    expect(document).toMatchObject({
      id: 'blog:included',
      order: 0,
      sourcePath: 'src/data/blog/included.mdx',
      canonicalUrl: 'https://jetsanchez.com/blog/included/',
      sourceHash: computeSourceHash(blogData, blogEntry().body),
    });
    expect(
      result.content.sections.every(
        (section, index) => section.order === index,
      ),
    ).toBe(true);
    expect(
      result.content.chunks.every((chunk, index) => chunk.order === index),
    ).toBe(true);
  });

  it('rejects duplicate final document and canonical URL identities', () => {
    expect(() =>
      buildKnowledgeBase(
        [blogEntry(), blogEntry({ sourcePath: 'src/data/blog/duplicate.mdx' })],
        'abc',
      ),
    ).toThrow(/duplicate.*(?:document|canonical)/i);
  });

  it('rejects distinct source identities that normalize to one canonical URL', () => {
    expect(() =>
      buildKnowledgeBase(
        [
          blogEntry({
            slug: 'same slug',
            sourcePath: 'src/data/blog/same-space.mdx',
          }),
          blogEntry({
            slug: 'same%20slug',
            sourcePath: 'src/data/blog/same-encoded.mdx',
          }),
        ],
        'abc',
      ),
    ).toThrow(/duplicate canonical url/i);
  });

  it('fails closed before NFC-equivalent identities can enter canonical output', () => {
    const nfc = blogEntry({
      slug: 'café',
      sourcePath: 'src/data/blog/cafe-nfc.mdx',
    });
    const nfd = blogEntry({
      slug: 'cafe\u0301',
      sourcePath: 'src/data/blog/cafe-nfd.mdx',
    });

    expect(() => buildKnowledgeBase([nfc, nfd], 'abc')).toThrow(
      /duplicate document id/i,
    );
  });

  it('normalizes heading and chunk identity inputs before hashing and serialization', () => {
    const result = buildKnowledgeBase(
      [
        blogEntry({
          body: '## Cafe\u0301\n\nCafe\u0301 evidence.',
        }),
      ],
      'abc',
    );
    const section = result.content.sections[1];
    const chunk = result.content.chunks[0];

    expect(section.heading).toBe('Café');
    expect(section.id).toContain('#cafe');
    expect(chunk.text).toBe('Café evidence.');
    expect(chunk.contentHash).toBe(
      createHash('sha256').update(chunk.text, 'utf8').digest('hex'),
    );
  });
});

describe('source hash contract', () => {
  function changedBlog(
    mutate: (value: BlogFrontmatter) => void,
  ): BlogFrontmatter {
    const value = structuredClone(blogData);
    mutate(value);
    return value;
  }

  function changedWorks(
    mutate: (value: WorksFrontmatter) => void,
  ): WorksFrontmatter {
    const value = structuredClone(worksData);
    mutate(value);
    return value;
  }

  const cases: Array<
    [
      string,
      BlogFrontmatter | WorksFrontmatter,
      BlogFrontmatter | WorksFrontmatter,
    ]
  > = [
    [
      'title',
      blogData,
      changedBlog((value) => {
        value.title = 'Changed';
      }),
    ],
    [
      'SEO title',
      blogData,
      changedBlog((value) => {
        value.seoTitle = 'Changed';
      }),
    ],
    [
      'SEO description',
      blogData,
      changedBlog((value) => {
        value.seoDescription = 'Changed';
      }),
    ],
    [
      'description',
      blogData,
      changedBlog((value) => {
        value.description = 'Changed';
      }),
    ],
    [
      'status',
      blogData,
      changedBlog((value) => {
        value.status = 'draft';
      }),
    ],
    [
      'assistant',
      blogData,
      changedBlog((value) => {
        value.assistant = false;
      }),
    ],
    [
      'pubDate',
      blogData,
      changedBlog((value) => {
        value.pubDate = new Date('2026-02-01');
      }),
    ],
    [
      'updatedDate',
      blogData,
      changedBlog((value) => {
        value.updatedDate = new Date('2026-02-02');
      }),
    ],
    [
      'author',
      blogData,
      changedBlog((value) => {
        value.author = 'Changed';
      }),
    ],
    [
      'tags',
      blogData,
      changedBlog((value) => {
        value.tags = [...value.tags].reverse();
      }),
    ],
    [
      'blog image URL',
      blogData,
      changedBlog((value) => {
        value.image!.url = 'https://example.com/changed.png';
      }),
    ],
    [
      'blog image alt',
      blogData,
      changedBlog((value) => {
        value.image!.alt = 'Changed';
      }),
    ],
    [
      'blog image width',
      blogData,
      changedBlog((value) => {
        value.image!.width = 1280;
      }),
    ],
    [
      'blog image height',
      blogData,
      changedBlog((value) => {
        value.image!.height = 720;
      }),
    ],
    [
      'type',
      worksData,
      changedWorks((value) => {
        value.type = 'project';
      }),
    ],
    [
      'date',
      worksData,
      changedWorks((value) => {
        value.date = new Date('2025-09-01');
      }),
    ],
    [
      'work image URL',
      worksData,
      changedWorks((value) => {
        value.image!.url = 'https://example.com/changed.png';
      }),
    ],
    [
      'work image alt',
      worksData,
      changedWorks((value) => {
        value.image!.alt = 'Changed';
      }),
    ],
    [
      'link label',
      worksData,
      changedWorks((value) => {
        value.links![0].label = 'Changed';
      }),
    ],
    [
      'link URL',
      worksData,
      changedWorks((value) => {
        value.links![0].url = 'https://example.com/changed';
      }),
    ],
    [
      'venue',
      worksData,
      changedWorks((value) => {
        value.venue = 'Changed';
      }),
    ],
    [
      'abstract',
      worksData,
      changedWorks((value) => {
        value.abstract = 'Changed';
      }),
    ],
    [
      'technologies',
      worksData,
      changedWorks((value) => {
        value.technologies = [...value.technologies!, 'WebGPU'];
      }),
    ],
    [
      'repository',
      worksData,
      changedWorks((value) => {
        value.repository = 'https://example.com/changed';
      }),
    ],
    [
      'demo',
      worksData,
      changedWorks((value) => {
        value.demo = 'https://example.com/changed';
      }),
    ],
  ];

  it.each(cases)(
    'hashes the complete validated %s metadata leaf',
    (_label, fixture, changed) => {
      expect(computeSourceHash(changed, 'Body.')).not.toBe(
        computeSourceHash(fixture, 'Body.'),
      );
    },
  );

  it('hashes the MDX body and preserves meaningful array order', () => {
    expect(computeSourceHash(blogData, 'Changed.')).not.toBe(
      computeSourceHash(blogData, 'Body.'),
    );
    expect(computeSourceHash(blogData, 'Body.')).not.toBe(
      computeSourceHash(
        { ...blogData, tags: [...blogData.tags].reverse() },
        'Body.',
      ),
    );
  });

  it('ignores object-key insertion order and normalizes dates and newlines', () => {
    const reordered = {
      image: {
        height: blogData.image!.height,
        alt: blogData.image!.alt,
        width: blogData.image!.width,
        url: blogData.image!.url,
      },
      assistant: blogData.assistant,
      status: blogData.status,
      tags: blogData.tags,
      author: blogData.author,
      updatedDate: new Date(blogData.updatedDate!.toISOString()),
      pubDate: new Date(blogData.pubDate.toISOString()),
      summary: blogData.summary,
      description: blogData.description,
      seoDescription: blogData.seoDescription,
      seoTitle: blogData.seoTitle,
      title: blogData.title,
    } satisfies BlogFrontmatter;

    expect(computeSourceHash(reordered, 'Body.\r\nNext.')).toBe(
      computeSourceHash(blogData, 'Body.\nNext.'),
    );
  });
});

describe('source commit resolution', () => {
  it('returns Git HEAD for every matching environment combination', () => {
    expect(resolveSourceCommit({ gitHead: 'abc' })).toBe('abc');
    expect(resolveSourceCommit({ gitHead: 'abc', vercelSha: 'abc' })).toBe(
      'abc',
    );
    expect(resolveSourceCommit({ gitHead: 'abc', githubSha: 'abc' })).toBe(
      'abc',
    );
    expect(
      resolveSourceCommit({
        gitHead: 'abc',
        vercelSha: 'abc',
        githubSha: 'abc',
      }),
    ).toBe('abc');
  });

  it('fails when supplied provenance disagrees or Git HEAD is unavailable', () => {
    expect(() =>
      resolveSourceCommit({ gitHead: 'abc', vercelSha: 'different' }),
    ).toThrow(/mismatch/i);
    expect(() => resolveSourceCommit({ gitHead: '' })).toThrow(/git head/i);
  });
});
