import { SITE } from '../config/site';

export interface SEOProps {
  title: string;
  description: string;
  image?: string;
  imageAlt?: string;
  canonicalURL?: string;
  type?: 'website' | 'article' | 'profile';
  publishedTime?: string;
  modifiedTime?: string;
  author?: string;
  tags?: string[];
}

/**
 * Get canonical URL for a given path
 * @param path - The path to convert to canonical URL (e.g., '/blog/my-post')
 * @returns Full canonical URL
 */
export function getCanonicalURL(path: string): string {
  const siteURL = new URL(SITE.siteUrl);
  const canonicalURL = new URL(path, `${siteURL.origin}/`);

  if (
    canonicalURL.origin !== siteURL.origin
    || canonicalURL.username !== ''
    || canonicalURL.password !== ''
  ) {
    throw new TypeError('Cross-origin canonical URL is not allowed');
  }

  canonicalURL.search = '';
  canonicalURL.hash = '';
  canonicalURL.pathname = canonicalURL.pathname.replace(/\/{2,}/gu, '/');

  const pathWithoutTrailingSlashes = canonicalURL.pathname.replace(/\/+$/u, '') || '/';
  const finalSegment = pathWithoutTrailingSlashes.split('/').at(-1) ?? '';
  const isMachineEndpoint = pathWithoutTrailingSlashes.startsWith('/api/')
    || finalSegment.includes('.');

  canonicalURL.pathname = pathWithoutTrailingSlashes === '/' || isMachineEndpoint
    ? pathWithoutTrailingSlashes
    : `${pathWithoutTrailingSlashes}/`;

  return canonicalURL.toString();
}

/**
 * Generate SEO props with defaults from site config
 * @param props - Custom SEO properties
 * @returns Complete SEO props with defaults
 */
export function generateSEOProps(props: Partial<SEOProps>): SEOProps {
  const canonicalURL = props.canonicalURL || getCanonicalURL(props.canonicalURL || '/');

  return {
    title: props.title || SITE.title,
    description: props.description || SITE.description,
    image: props.image || `${SITE.siteUrl}/images/og-default.jpg`,
    imageAlt: props.imageAlt,
    canonicalURL,
    type: props.type || 'website',
    publishedTime: props.publishedTime,
    modifiedTime: props.modifiedTime,
    author: props.author || SITE.author,
    tags: props.tags || [],
  };
}

/**
 * Format page title with site name
 * @param pageTitle - The page-specific title
 * @param includeSiteName - Whether to append site name (default: true)
 * @returns Formatted title string
 */
export function formatTitle(pageTitle: string, includeSiteName: boolean = true): string {
  if (!includeSiteName || pageTitle === SITE.title) {
    return pageTitle;
  }

  return `${pageTitle} | ${SITE.title}`;
}

/**
 * Truncate description to SEO-friendly length
 * @param description - The description text
 * @param maxLength - Maximum length (default: 160)
 * @returns Truncated description
 */
export function truncateDescription(description: string, maxLength: number = 160): string {
  if (description.length <= maxLength) {
    return description;
  }

  return description.slice(0, maxLength - 3) + '...';
}
