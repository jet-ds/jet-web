import { SITE } from '../config/site';

export interface SEOProps {
  title: string;
  description: string;
  image?: string;
  imageAlt?: string;
  imageWidth?: number;
  imageHeight?: number;
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
  const usesDefaultImage = props.image === undefined;

  return {
    title: props.title || SITE.title,
    description: props.description || SITE.description,
    image: props.image || SITE.defaultOpenGraphImage.url,
    imageAlt: usesDefaultImage ? SITE.defaultOpenGraphImage.alt : props.imageAlt,
    imageWidth: usesDefaultImage ? SITE.defaultOpenGraphImage.width : props.imageWidth,
    imageHeight: usesDefaultImage ? SITE.defaultOpenGraphImage.height : props.imageHeight,
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

  if (maxLength <= 0) return '';
  if (maxLength === 1) return '…';

  const rawCandidate = description.slice(0, maxLength - 1);
  const endsAtWordBoundary = /\s$/u.test(rawCandidate)
    || /^\s/u.test(description.slice(maxLength - 1));
  let candidate = rawCandidate.trimEnd();

  if (!endsAtWordBoundary) {
    const finalWhitespace = candidate.search(/\s+\S*$/u);
    if (finalWhitespace > 0) candidate = candidate.slice(0, finalWhitespace);
  }

  return `${candidate}…`;
}
