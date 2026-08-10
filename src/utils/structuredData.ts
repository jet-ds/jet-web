import { SITE } from '../config/site';

const SITE_ROOT_URL = new URL('/', SITE.siteUrl).toString();

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue =
  JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };
export type JsonLd = {
  '@context': 'https://schema.org';
  '@type': string;
  [key: string]: JsonValue;
};

type WebsiteProps = {
  type: 'website';
  url?: string;
  name?: string;
  description?: string;
};

type BlogPostingProps = {
  type: 'blogposting';
  id?: string;
  url?: string;
  name?: string;
  headline?: string;
  description?: string;
  image?: string;
  datePublished?: string;
  dateModified?: string;
  author?: string;
  tags?: readonly string[];
};

type ReviewProps = {
  type: 'review';
  id?: string;
  url?: string;
  name: string;
  itemType: 'Movie';
  itemName: string;
  ratingValue: number;
  bestRating: number;
  datePublished?: string;
  dateModified?: string;
  author?: string;
  isPartOfId: string;
};

type PersonProps = {
  type: 'person';
  id?: string;
  url?: string;
  pageUrl?: string;
  name?: string;
  givenName?: string;
  familyName?: string;
  alternateName?: readonly string[];
  email?: string;
  jobTitle?: string;
  sameAs?: readonly string[];
};

type NavigationProps = {
  type: 'navigation';
  name?: string;
  navigationElements?: readonly {
    readonly name: string;
    readonly url: string;
  }[];
};

type WebPageProps = {
  type: 'webpage';
  id?: string;
  url?: string;
  name?: string;
  description?: string;
  image?: string;
  mainEntityId?: string;
};

type SoftwareProps = {
  type: 'software';
  id?: string;
  url?: string;
  name?: string;
  description?: string;
  applicationCategory?: string;
  operatingSystem?: string;
  price?: string;
  priceCurrency?: string;
  creator?: string;
};

type ScholarlyArticleProps = {
  type: 'scholarlyarticle';
  id?: string;
  url?: string;
  name?: string;
  headline?: string;
  description?: string;
  abstract?: string;
  image?: string;
  datePublished?: string;
  dateModified?: string;
  author?: string;
  venue?: string;
  identifier?: string;
  sameAs?: readonly string[];
  tags?: readonly string[];
};

type CreativeWorkProps = {
  type: 'creativework';
  id?: string;
  url?: string;
  name?: string;
  description?: string;
  image?: string;
  datePublished?: string;
  dateCreated?: string;
  creator?: string;
  tags?: readonly string[];
};

export type StructuredDataProps =
  | WebsiteProps
  | BlogPostingProps
  | ReviewProps
  | PersonProps
  | NavigationProps
  | WebPageProps
  | SoftwareProps
  | ScholarlyArticleProps
  | CreativeWorkProps;

function buildWebsiteSchema(
  props: Extract<StructuredDataProps, { type: 'website' }>,
): JsonLd {
  const url = props.url ?? SITE_ROOT_URL;

  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${SITE.siteUrl}/#website`,
    name: props.name || SITE.title,
    description: props.description || SITE.description,
    url,
    inLanguage: 'en-US',
    publisher: {
      '@type': 'Person',
      '@id': `${SITE.siteUrl}/#person`,
      name: SITE.author,
    },
  };
}

function buildBlogPostingSchema(
  props: Extract<StructuredDataProps, { type: 'blogposting' }>,
): JsonLd {
  const url = props.url ?? SITE_ROOT_URL;
  const headline = props.headline || props.name;
  const dateModified = props.dateModified || props.datePublished;

  return {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    ...(props.id && { '@id': props.id }),
    url,
    ...(headline !== undefined && { headline }),
    ...(props.description !== undefined && { description: props.description }),
    ...(props.image && { image: props.image }),
    ...(props.datePublished !== undefined && {
      datePublished: props.datePublished,
    }),
    ...(dateModified !== undefined && { dateModified }),
    author: {
      '@type': 'Person',
      '@id': `${SITE.siteUrl}/#person`,
      name: props.author || SITE.author,
    },
    publisher: {
      '@type': 'Person',
      '@id': `${SITE.siteUrl}/#person`,
      name: SITE.author,
    },
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': `${url}#webpage`,
    },
    keywords: (props.tags ?? []).join(', '),
  };
}

function buildReviewSchema(
  props: Extract<StructuredDataProps, { type: 'review' }>,
): JsonLd {
  const url = props.url ?? SITE_ROOT_URL;
  const dateModified = props.dateModified || props.datePublished;

  return {
    '@context': 'https://schema.org',
    '@type': 'Review',
    ...(props.id && { '@id': props.id }),
    url,
    name: props.name,
    author: {
      '@type': 'Person',
      '@id': `${SITE.siteUrl}/#person`,
      name: props.author || SITE.author,
    },
    ...(props.datePublished && { datePublished: props.datePublished }),
    ...(dateModified && { dateModified }),
    reviewRating: {
      '@type': 'Rating',
      ratingValue: props.ratingValue,
      bestRating: props.bestRating,
      worstRating: 1,
    },
    itemReviewed: {
      '@type': props.itemType,
      name: props.itemName,
    },
    isPartOf: {
      '@id': props.isPartOfId,
    },
  };
}

function buildPersonSchema(
  props: Extract<StructuredDataProps, { type: 'person' }>,
): JsonLd {
  const url = props.url ?? SITE_ROOT_URL;
  const alternateName = props.alternateName ?? [];
  const sameAs = props.sameAs ?? [];

  return {
    '@context': 'https://schema.org',
    '@type': 'Person',
    ...(props.id && { '@id': props.id }),
    name: props.name || SITE.author,
    ...(props.givenName && { givenName: props.givenName }),
    ...(props.familyName && { familyName: props.familyName }),
    ...(alternateName.length > 0 && { alternateName: [...alternateName] }),
    email: props.email || SITE.email,
    url,
    ...(props.jobTitle && { jobTitle: props.jobTitle }),
    ...(sameAs.length > 0 && { sameAs: [...sameAs] }),
    ...(props.pageUrl && {
      mainEntityOfPage: {
        '@type': 'WebPage',
        '@id': `${props.pageUrl}#webpage`,
      },
    }),
  };
}

function buildNavigationSchema(
  props: Extract<StructuredDataProps, { type: 'navigation' }>,
): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'SiteNavigationElement',
    name: props.name || `${SITE.title} Navigation`,
    hasPart: (props.navigationElements ?? []).map((element) => ({
      '@type': 'WebPage',
      name: element.name,
      url: element.url,
    })),
  };
}

function buildWebPageSchema(
  props: Extract<StructuredDataProps, { type: 'webpage' }>,
): JsonLd {
  const url = props.url ?? SITE_ROOT_URL;

  return {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    ...(props.id && { '@id': props.id }),
    name: props.name || SITE.title,
    description: props.description || SITE.description,
    url,
    inLanguage: 'en-US',
    isPartOf: {
      '@type': 'WebSite',
      '@id': `${SITE.siteUrl}/#website`,
      url: SITE_ROOT_URL,
      name: SITE.title,
    },
    ...(props.mainEntityId && { mainEntity: { '@id': props.mainEntityId } }),
    ...(props.image && { image: props.image }),
  };
}

function buildSoftwareSchema(
  props: Extract<StructuredDataProps, { type: 'software' }>,
): JsonLd {
  const url = props.url ?? SITE_ROOT_URL;

  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    ...(props.id && { '@id': props.id }),
    ...(props.name !== undefined && { name: props.name }),
    ...(props.description !== undefined && { description: props.description }),
    url,
    applicationCategory: props.applicationCategory || 'ChatApplication',
    operatingSystem: props.operatingSystem || 'Web Browser',
    offers: {
      '@type': 'Offer',
      price: props.price ?? '0',
      priceCurrency: props.priceCurrency ?? 'USD',
    },
    ...(props.creator && {
      creator: {
        '@type': 'Person',
        name: props.creator,
      },
    }),
  };
}

function buildScholarlyArticleSchema(
  props: Extract<StructuredDataProps, { type: 'scholarlyarticle' }>,
): JsonLd {
  const url = props.url ?? SITE_ROOT_URL;
  const headline = props.headline || props.name;
  const dateModified = props.dateModified || props.datePublished;
  const sameAs = props.sameAs ?? [];

  return {
    '@context': 'https://schema.org',
    '@type': 'ScholarlyArticle',
    ...(props.id && { '@id': props.id }),
    url,
    ...(headline !== undefined && { headline }),
    ...(props.description !== undefined && { description: props.description }),
    ...(props.abstract && { abstract: props.abstract }),
    ...(props.image && { image: props.image }),
    ...(props.datePublished !== undefined && {
      datePublished: props.datePublished,
    }),
    ...(dateModified !== undefined && { dateModified }),
    author: {
      '@type': 'Person',
      '@id': `${SITE.siteUrl}/#person`,
      name: props.author || SITE.author,
    },
    publisher: {
      '@type': 'Person',
      '@id': `${SITE.siteUrl}/#person`,
      name: SITE.author,
    },
    ...(props.venue && {
      publication: {
        '@type': 'Periodical',
        name: props.venue,
      },
    }),
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': `${url}#webpage`,
    },
    ...(props.identifier && { identifier: props.identifier }),
    ...(sameAs.length > 0 && { sameAs: [...sameAs] }),
    keywords: (props.tags ?? []).join(', '),
  };
}

function buildCreativeWorkSchema(
  props: Extract<StructuredDataProps, { type: 'creativework' }>,
): JsonLd {
  const url = props.url ?? SITE_ROOT_URL;
  const datePublished = props.datePublished || props.dateCreated;

  return {
    '@context': 'https://schema.org',
    '@type': 'CreativeWork',
    ...(props.id && { '@id': props.id }),
    ...(props.name !== undefined && { name: props.name }),
    ...(props.description !== undefined && { description: props.description }),
    ...(props.image && { image: props.image }),
    ...(datePublished !== undefined && { datePublished }),
    creator: props.creator
      ? {
          '@type': 'Person',
          name: props.creator,
        }
      : {
          '@type': 'Person',
          '@id': `${SITE.siteUrl}/#person`,
          name: SITE.author,
        },
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': `${url}#webpage`,
    },
    url,
    keywords: (props.tags ?? []).join(', '),
  };
}

function assertNever(value: never): never {
  throw new Error(`Unsupported structured-data type: ${String(value)}`);
}

export function buildStructuredData(props: StructuredDataProps): JsonLd {
  switch (props.type) {
    case 'website':
      return buildWebsiteSchema(props);
    case 'blogposting':
      return buildBlogPostingSchema(props);
    case 'review':
      return buildReviewSchema(props);
    case 'person':
      return buildPersonSchema(props);
    case 'navigation':
      return buildNavigationSchema(props);
    case 'webpage':
      return buildWebPageSchema(props);
    case 'software':
      return buildSoftwareSchema(props);
    case 'scholarlyarticle':
      return buildScholarlyArticleSchema(props);
    case 'creativework':
      return buildCreativeWorkSchema(props);
    default:
      return assertNever(props);
  }
}
