import { describe, expect, expectTypeOf, it } from 'vitest';
import {
  buildStructuredData,
  type JsonLd,
  type StructuredDataProps,
} from '../../../src/utils/structuredData';

interface StructuredDataFixture {
  name: string;
  props: StructuredDataProps;
  expectedType: string;
  expectedSchema: JsonLd;
}

const fixtures = [
  {
    name: 'website',
    props: {
      type: 'website',
      url: 'https://example.com',
      name: 'Example Site',
      description: 'Example site description',
    } satisfies Extract<StructuredDataProps, { type: 'website' }>,
    expectedType: 'WebSite',
    expectedSchema: {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      '@id': 'https://jetsanchez.com/#website',
      name: 'Example Site',
      description: 'Example site description',
      url: 'https://example.com',
      inLanguage: 'en-US',
      publisher: {
        '@type': 'Person',
        '@id': 'https://jetsanchez.com/#person',
        name: 'Jet Sanchez',
      },
    },
  },
  {
    name: 'blog posting',
    props: {
      type: 'blogposting',
      id: 'https://example.com/blog/typed-metadata#blogposting',
      url: 'https://example.com/blog/typed-metadata',
      name: 'Typed metadata fallback title',
      headline: 'Typed metadata',
      description: 'A complete blog-post fixture',
      image: 'https://example.com/blog/typed-metadata.jpg',
      datePublished: '2026-07-01T00:00:00.000Z',
      dateModified: '2026-07-02T00:00:00.000Z',
      author: 'Example Author',
      tags: ['Astro', 'SEO'],
    } satisfies Extract<StructuredDataProps, { type: 'blogposting' }>,
    expectedType: 'BlogPosting',
    expectedSchema: {
      '@context': 'https://schema.org',
      '@type': 'BlogPosting',
      '@id': 'https://example.com/blog/typed-metadata#blogposting',
      url: 'https://example.com/blog/typed-metadata',
      headline: 'Typed metadata',
      description: 'A complete blog-post fixture',
      image: 'https://example.com/blog/typed-metadata.jpg',
      datePublished: '2026-07-01T00:00:00.000Z',
      dateModified: '2026-07-02T00:00:00.000Z',
      author: {
        '@type': 'Person',
        '@id': 'https://jetsanchez.com/#person',
        name: 'Example Author',
      },
      publisher: {
        '@type': 'Person',
        '@id': 'https://jetsanchez.com/#person',
        name: 'Jet Sanchez',
      },
      mainEntityOfPage: {
        '@type': 'WebPage',
        '@id': 'https://example.com/blog/typed-metadata#webpage',
      },
      keywords: 'Astro, SEO',
    },
  },
  {
    name: 'person',
    props: {
      type: 'person',
      id: 'https://example.com/#person',
      url: 'https://example.com',
      pageUrl: 'https://example.com/about',
      name: 'Example Person',
      givenName: 'Example',
      familyName: 'Person',
      alternateName: ['E. Person', 'Example P.'],
      email: 'person@example.com',
      jobTitle: 'Researcher',
      sameAs: ['https://social.example.com/example'],
    } satisfies Extract<StructuredDataProps, { type: 'person' }>,
    expectedType: 'Person',
    expectedSchema: {
      '@context': 'https://schema.org',
      '@type': 'Person',
      '@id': 'https://example.com/#person',
      name: 'Example Person',
      givenName: 'Example',
      familyName: 'Person',
      alternateName: ['E. Person', 'Example P.'],
      email: 'person@example.com',
      url: 'https://example.com',
      jobTitle: 'Researcher',
      sameAs: ['https://social.example.com/example'],
      mainEntityOfPage: {
        '@type': 'WebPage',
        '@id': 'https://example.com/about#webpage',
      },
    },
  },
  {
    name: 'navigation',
    props: {
      type: 'navigation',
      name: 'Example Navigation',
      navigationElements: [
        { name: 'Home', url: 'https://example.com/' },
        { name: 'About', url: 'https://example.com/about' },
      ],
    } satisfies Extract<StructuredDataProps, { type: 'navigation' }>,
    expectedType: 'SiteNavigationElement',
    expectedSchema: {
      '@context': 'https://schema.org',
      '@type': 'SiteNavigationElement',
      name: 'Example Navigation',
      hasPart: [
        {
          '@type': 'WebPage',
          name: 'Home',
          url: 'https://example.com/',
        },
        {
          '@type': 'WebPage',
          name: 'About',
          url: 'https://example.com/about',
        },
      ],
    },
  },
  {
    name: 'webpage',
    props: {
      type: 'webpage',
      id: 'https://example.com/page#webpage',
      url: 'https://example.com/page',
      name: 'Example Page',
      description: 'A complete webpage fixture',
      image: 'https://example.com/page.jpg',
      mainEntityId: 'https://example.com/page#creativework',
    } satisfies Extract<StructuredDataProps, { type: 'webpage' }>,
    expectedType: 'WebPage',
    expectedSchema: {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      '@id': 'https://example.com/page#webpage',
      name: 'Example Page',
      description: 'A complete webpage fixture',
      url: 'https://example.com/page',
      inLanguage: 'en-US',
      isPartOf: {
        '@type': 'WebSite',
        '@id': 'https://jetsanchez.com/#website',
        url: 'https://jetsanchez.com/',
        name: 'Jet Sanchez',
      },
      mainEntity: {
        '@id': 'https://example.com/page#creativework',
      },
      image: 'https://example.com/page.jpg',
    },
  },
  {
    name: 'software application',
    props: {
      type: 'software',
      id: 'https://example.com/tools/chat#software',
      url: 'https://example.com/tools/chat',
      name: 'Example Chat',
      description: 'A complete software fixture',
      applicationCategory: 'ResearchApplication',
      operatingSystem: 'Web Browser',
      price: '10',
      priceCurrency: 'PHP',
      creator: 'Example Creator',
    } satisfies Extract<StructuredDataProps, { type: 'software' }>,
    expectedType: 'SoftwareApplication',
    expectedSchema: {
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      '@id': 'https://example.com/tools/chat#software',
      name: 'Example Chat',
      description: 'A complete software fixture',
      url: 'https://example.com/tools/chat',
      applicationCategory: 'ResearchApplication',
      operatingSystem: 'Web Browser',
      offers: {
        '@type': 'Offer',
        price: '10',
        priceCurrency: 'PHP',
      },
      creator: {
        '@type': 'Person',
        name: 'Example Creator',
      },
    },
  },
  {
    name: 'scholarly article',
    props: {
      type: 'scholarlyarticle',
      id: 'https://example.com/works/research#scholarlyarticle',
      url: 'https://example.com/works/research',
      name: 'Research fallback title',
      headline: 'Example Research',
      description: 'A complete scholarly-article fixture',
      abstract: 'An example abstract.',
      image: 'https://example.com/works/research.jpg',
      datePublished: '2026-06-01T00:00:00.000Z',
      dateModified: '2026-06-02T00:00:00.000Z',
      author: 'Example Researcher',
      venue: 'Example Journal',
      identifier: 'https://doi.org/10.1234/example',
      sameAs: ['https://doi.org/10.1234/example'],
      tags: ['AI', 'Systems'],
    } satisfies Extract<StructuredDataProps, { type: 'scholarlyarticle' }>,
    expectedType: 'ScholarlyArticle',
    expectedSchema: {
      '@context': 'https://schema.org',
      '@type': 'ScholarlyArticle',
      '@id': 'https://example.com/works/research#scholarlyarticle',
      url: 'https://example.com/works/research',
      headline: 'Example Research',
      description: 'A complete scholarly-article fixture',
      abstract: 'An example abstract.',
      image: 'https://example.com/works/research.jpg',
      datePublished: '2026-06-01T00:00:00.000Z',
      dateModified: '2026-06-02T00:00:00.000Z',
      author: {
        '@type': 'Person',
        '@id': 'https://jetsanchez.com/#person',
        name: 'Example Researcher',
      },
      publisher: {
        '@type': 'Person',
        '@id': 'https://jetsanchez.com/#person',
        name: 'Jet Sanchez',
      },
      publication: {
        '@type': 'Periodical',
        name: 'Example Journal',
      },
      mainEntityOfPage: {
        '@type': 'WebPage',
        '@id': 'https://example.com/works/research#webpage',
      },
      identifier: 'https://doi.org/10.1234/example',
      sameAs: ['https://doi.org/10.1234/example'],
      keywords: 'AI, Systems',
    },
  },
  {
    name: 'creative work',
    props: {
      type: 'creativework',
      id: 'https://example.com/works/project#creativework',
      url: 'https://example.com/works/project',
      name: 'Example Project',
      description: 'A complete creative-work fixture',
      image: 'https://example.com/works/project.jpg',
      datePublished: '2026-05-01T00:00:00.000Z',
      dateCreated: '2026-04-01T00:00:00.000Z',
      creator: 'Example Maker',
      tags: ['Astro', 'TypeScript'],
    } satisfies Extract<StructuredDataProps, { type: 'creativework' }>,
    expectedType: 'CreativeWork',
    expectedSchema: {
      '@context': 'https://schema.org',
      '@type': 'CreativeWork',
      '@id': 'https://example.com/works/project#creativework',
      name: 'Example Project',
      description: 'A complete creative-work fixture',
      image: 'https://example.com/works/project.jpg',
      datePublished: '2026-05-01T00:00:00.000Z',
      creator: {
        '@type': 'Person',
        name: 'Example Maker',
      },
      mainEntityOfPage: {
        '@type': 'WebPage',
        '@id': 'https://example.com/works/project#webpage',
      },
      url: 'https://example.com/works/project',
      keywords: 'Astro, TypeScript',
    },
  },
] satisfies readonly StructuredDataFixture[];

describe('structured data', () => {
  it('uses the slashful root identity for default schemas and the About Person', () => {
    expect(buildStructuredData({ type: 'person' }).url).toBe(
      'https://jetsanchez.com/',
    );
    expect(
      buildStructuredData({
        type: 'webpage',
        url: 'https://jetsanchez.com/about/',
      }).isPartOf,
    ).toMatchObject({
      '@id': 'https://jetsanchez.com/#website',
      url: 'https://jetsanchez.com/',
    });
  });

  it.each(fixtures)(
    'preserves the complete $name JSON shape',
    ({ props, expectedType, expectedSchema }) => {
      const schema = buildStructuredData(props);
      const serialized = JSON.stringify(schema);
      const parsed: unknown = JSON.parse(serialized);

      expectTypeOf(schema).toEqualTypeOf<JsonLd>();
      expectTypeOf(parsed).toEqualTypeOf<unknown>();
      expect(schema['@type']).toBe(expectedType);
      expect(schema).toEqual(expectedSchema);
      expect(parsed).toEqual(expectedSchema);
    },
  );
});
