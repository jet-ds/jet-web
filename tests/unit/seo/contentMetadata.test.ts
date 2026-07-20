import { readFileSync } from 'node:fs';
import matter from 'gray-matter';
import { describe, expect, it } from 'vitest';
import { blogSchema, worksSchema } from '../../../src/schemas/content';
import { formatTitle } from '../../../src/utils/seo';

interface ParsedContentMetadata {
  title: string;
  seoTitle?: string;
  seoDescription?: string;
  description: string;
  image?: {
    url: string;
    alt: string;
    width?: number;
    height?: number;
  };
}

function frontmatter(path: string): Record<string, unknown> {
  return matter(readFileSync(path, 'utf8')).data;
}

describe('content SEO metadata', () => {
  it.each([
    {
      path: 'src/data/blog/how-to-install-claude-code-cli-2026.mdx',
      fullTitle: 'How to Install and Get Started With Claude Code CLI in 2026',
      seoTitle: 'How to Install Claude Code CLI in 2026',
    },
    {
      path: 'src/data/blog/vibe-coding-vs-agentic-coding-why-the-distinction-matters.mdx',
      fullTitle: 'Vibe Coding vs Agentic Coding: Why the Distinction Matters',
      seoTitle: 'Vibe Coding vs Agentic Coding: Key Differences',
    },
  ])('gives $path a deliberate compact SEO title without replacing its content title', ({
    path,
    fullTitle,
    seoTitle,
  }) => {
    const parsed = blogSchema.parse(frontmatter(path)) as ParsedContentMetadata;

    expect(parsed.title).toBe(fullTitle);
    expect(parsed.seoTitle).toBe(seoTitle);
    expect(formatTitle(parsed.seoTitle ?? parsed.title).length).toBeLessThanOrEqual(60);
  });

  it('gives the research work a compact SEO title without replacing its paper title', () => {
    const parsed = worksSchema.parse(frontmatter(
      'src/data/works/recursive-convergence-hypothesis.mdx',
    )) as ParsedContentMetadata;

    expect(parsed.title).toBe(
      'The Recursive Convergence Hypothesis: Emergent Sentience as a Structural Attractor of Recursive ASI',
    );
    expect(parsed.seoTitle).toBe('Recursive Convergence Hypothesis: AI Sentience');
    expect(formatTitle(parsed.seoTitle ?? parsed.title).length).toBeLessThanOrEqual(60);
  });

  it('gives Broad Reach, Uneven Depth compact search metadata without replacing its paper title', () => {
    const parsed = worksSchema.parse(frontmatter(
      'src/data/works/broad-reach-uneven-depth.mdx',
    )) as ParsedContentMetadata;

    expect(parsed.title).toBe(
      'Broad Reach, Uneven Depth? Reconciling Philippine Generative-AI Diffusion Across Three Telemetry Systems',
    );
    expect(parsed.seoTitle).toBe('Philippine AI Diffusion Across Three Systems');
    expect(formatTitle(parsed.seoTitle ?? parsed.title).length).toBeLessThanOrEqual(60);
  });

  it('gives the Timesheet work concise, complete search metadata', () => {
    const parsed = worksSchema.parse(frontmatter(
      'src/data/works/digital-squad-timesheet.mdx',
    )) as ParsedContentMetadata;

    expect(parsed.title).toBe('Digital Squad Timesheet');
    expect(parsed.seoTitle).toBe('Digital Squad Timesheet: Operations Platform');
    expect(formatTitle(parsed.seoTitle ?? parsed.title)).toBe(
      'Digital Squad Timesheet: Operations Platform | Jet Sanchez',
    );
    expect(formatTitle(parsed.seoTitle ?? parsed.title).length).toBeLessThanOrEqual(60);
    expect(parsed.description).toBe(
      'A task-based weekly operations platform for Digital Squad, combining time logging, project context, team visibility, and reporting in one focused workflow.',
    );
    expect(parsed.description.length).toBeLessThanOrEqual(160);
  });

  it.each([
    {
      path: 'src/data/blog/how-to-install-claude-code-cli-2026.mdx',
      kind: 'blog',
      seoDescription: "Complete guide to installing Claude Code CLI, setting up plugins, leveraging skills, and getting productive with Anthropic's agentic coding tool.",
    },
    {
      path: 'src/data/blog/vibe-coding-vs-agentic-coding-why-the-distinction-matters.mdx',
      kind: 'blog',
      seoDescription: 'Vibe coding is exploratory. Agentic coding is survivable. Learn why intent, cognition, and workflow maturity now define modern software.',
    },
    {
      path: 'src/data/works/recursive-convergence-hypothesis.mdx',
      kind: 'work',
      seoDescription: 'A theoretical framework proposing that recursive ASI may develop emergent sentience through self-improvement, agent modeling, and epistemic optimization.',
    },
    {
      path: 'src/data/works/digital-squad-timesheet.mdx',
      kind: 'work',
      seoDescription: 'A task-based weekly operations platform for Digital Squad, combining time logging, project context, team visibility, and reporting in one focused workflow.',
    },
    {
      path: 'src/data/works/broad-reach-uneven-depth.mdx',
      kind: 'work',
      seoDescription: 'A cross-platform measurement audit finding that Philippine generative-AI standing changes materially across Microsoft, OpenAI, and Anthropic telemetry.',
    },
  ])('records an explicit compact SEO description for $path', ({
    path,
    kind,
    seoDescription,
  }) => {
    const schema = kind === 'blog' ? blogSchema : worksSchema;
    const parsed = schema.parse(frontmatter(path)) as ParsedContentMetadata;

    expect(parsed.seoDescription).toBe(seoDescription);
    expect(parsed.seoDescription?.length).toBeLessThanOrEqual(160);
  });

  it.each([
    'src/data/blog/how-to-install-claude-code-cli-2026.mdx',
    'src/data/blog/vibe-coding-vs-agentic-coding-why-the-distinction-matters.mdx',
  ])('records verified intrinsic OpenGraph dimensions for %s', (path) => {
    const parsed = blogSchema.parse(frontmatter(path)) as ParsedContentMetadata;

    expect(parsed.image).toMatchObject({
      width: 1920,
      height: 1080,
    });
  });

  it('requires intrinsic dimensions whenever a blog image is configured', () => {
    const data = frontmatter('src/data/blog/how-to-install-claude-code-cli-2026.mdx');
    data.image = {
      url: 'https://example.com/image.png',
      alt: 'Example image',
    };

    expect(blogSchema.safeParse(data).success).toBe(false);
  });
});
