export type GoogleAnalyticsRequestKind =
  'library' | 'collection' | 'other-analytics';

function isGoogleAnalyticsHost(hostname: string): boolean {
  return (
    hostname === 'www.googletagmanager.com' ||
    hostname === 'analytics.google.com' ||
    hostname === 'google-analytics.com' ||
    hostname.endsWith('.google-analytics.com') ||
    hostname === 'stats.g.doubleclick.net'
  );
}

export function classifyGoogleAnalyticsRequest(
  rawUrl: string | URL,
): GoogleAnalyticsRequestKind | null {
  const url = rawUrl instanceof URL ? rawUrl : new URL(rawUrl);
  if (!isGoogleAnalyticsHost(url.hostname)) return null;
  if (
    url.hostname === 'www.googletagmanager.com' &&
    url.pathname === '/gtag/js'
  ) {
    return 'library';
  }
  if (
    url.hostname !== 'www.googletagmanager.com' &&
    /^\/(?:g\/)?collect$/u.test(url.pathname)
  ) {
    return 'collection';
  }
  return 'other-analytics';
}
