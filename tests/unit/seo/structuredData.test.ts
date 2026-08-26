import { describe, expect, expectTypeOf, it } from 'vitest';
import {
  buildStructuredData,
  type JsonLd,
  type StructuredDataProps,
} from '../../../src/utils/structuredData';
import { profileSchema } from '../../../src/schemas/content';

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
    name: 'movie review',
    props: {
      type: 'review',
      id: 'https://example.com/blog/movie-review/#review',
      url: 'https://example.com/blog/movie-review/',
      name: 'Example Movie review',
      itemType: 'Movie',
      itemName: 'Example Movie',
      ratingValue: 5,
      bestRating: 5,
      datePublished: '2026-08-01T00:00:00.000Z',
      dateModified: '2026-08-10T00:00:00.000Z',
      author: 'Example Author',
      isPartOfId: 'https://example.com/blog/movie-review/#blogposting',
    } satisfies Extract<StructuredDataProps, { type: 'review' }>,
    expectedType: 'Review',
    expectedSchema: {
      '@context': 'https://schema.org',
      '@type': 'Review',
      '@id': 'https://example.com/blog/movie-review/#review',
      url: 'https://example.com/blog/movie-review/',
      name: 'Example Movie review',
      author: {
        '@type': 'Person',
        '@id': 'https://jetsanchez.com/#person',
        name: 'Example Author',
      },
      datePublished: '2026-08-01T00:00:00.000Z',
      dateModified: '2026-08-10T00:00:00.000Z',
      reviewRating: {
        '@type': 'Rating',
        ratingValue: 5,
        bestRating: 5,
        worstRating: 1,
      },
      itemReviewed: {
        '@type': 'Movie',
        name: 'Example Movie',
      },
      isPartOf: {
        '@id': 'https://example.com/blog/movie-review/#blogposting',
      },
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
      worksFor: {
        name: 'Digital Squad',
        url: 'https://digitalsquad.com/',
      },
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
      worksFor: {
        '@type': 'Organization',
        '@id': 'https://digitalsquad.com/#organization',
        name: 'Digital Squad',
        url: 'https://digitalsquad.com/',
      },
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
  it('requires the canonical organization URL on profile data', () => {
    expect(
      profileSchema.parse({
        title: 'Example Person',
        description: 'An invented public profile.',
        date: '2026-08-25',
        author: 'Example Person',
        status: 'published',
        assistant: true,
        role: 'Researcher',
        organization: 'Digital Squad',
        organizationUrl: 'https://digitalsquad.com/',
        researchAreas: ['Artificial Intelligence'],
        technicalFocus: ['Systems Design'],
        connectText: 'An invented invitation to connect.',
      }).organizationUrl,
    ).toBe('https://digitalsquad.com/');
  });

  it('builds a finite ItemList from an ordered page collection', () => {
    const schema = buildStructuredData({
      type: 'itemlist',
      id: 'https://example.com/blog/#blog-posts',
      url: 'https://example.com/blog/',
      name: 'Example blog posts',
      items: [
        {
          url: 'https://example.com/blog/first-entry/',
          entityId: 'https://example.com/blog/first-entry/#blogposting',
        },
        {
          url: 'https://example.com/blog/second-entry/',
          entityId: 'https://example.com/blog/second-entry/#blogposting',
        },
      ],
    } satisfies Extract<StructuredDataProps, { type: 'itemlist' }>);

    expect(schema).toEqual({
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      '@id': 'https://example.com/blog/#blog-posts',
      url: 'https://example.com/blog/',
      name: 'Example blog posts',
      itemListElement: [
        {
          '@type': 'ListItem',
          position: 1,
          url: 'https://example.com/blog/first-entry/',
          item: {
            '@id': 'https://example.com/blog/first-entry/#blogposting',
          },
        },
        {
          '@type': 'ListItem',
          position: 2,
          url: 'https://example.com/blog/second-entry/',
          item: {
            '@id': 'https://example.com/blog/second-entry/#blogposting',
          },
        },
      ],
    });
  });

  it('preserves an empty ItemList and rejects duplicate item URLs', () => {
    expect(
      buildStructuredData({
        type: 'itemlist',
        id: 'https://example.com/works/#works-collection',
        url: 'https://example.com/works/',
        name: 'Example works',
        items: [],
      } satisfies Extract<StructuredDataProps, { type: 'itemlist' }>),
    ).toMatchObject({
      '@id': 'https://example.com/works/#works-collection',
      name: 'Example works',
      itemListElement: [],
    });

    expect(() =>
      buildStructuredData({
        type: 'itemlist',
        id: 'https://example.com/works/#works-collection',
        url: 'https://example.com/works/',
        name: 'Example works',
        items: [
          {
            url: 'https://example.com/works/repeated/',
            entityId: 'https://example.com/works/repeated/#creativework',
          },
          {
            url: 'https://example.com/works/repeated/',
            entityId: 'https://example.com/works/repeated/#creativework',
          },
        ],
      } satisfies Extract<StructuredDataProps, { type: 'itemlist' }>),
    ).toThrow(/duplicate item URL/iu);
  });

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
