export interface RequestShape {
  method(): string;
  resourceType(): string;
}

const PARTYTOWN_BLOB_PATH =
  /^\/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const PARTYTOWN_SANDBOX_SEARCH = /^\?\d{13}$/u;
const DEPLOYMENT_PROTECTION_COOKIE = /^_vercel_jwt=[A-Za-z0-9._~-]+$/u;

export function isAllowedDeploymentProtectionCookie(
  cookieHeader: string | undefined,
  bypassEnabled: boolean,
): boolean {
  if (cookieHeader === undefined) return true;
  return bypassEnabled && DEPLOYMENT_PROTECTION_COOKIE.test(cookieHeader);
}

export function isPartytownBlobScript(
  request: RequestShape,
  url: URL,
  applicationOrigin: string,
): boolean {
  if (
    url.protocol !== 'blob:' ||
    url.search !== '' ||
    url.hash !== '' ||
    !['script', 'xhr'].includes(request.resourceType()) ||
    request.method() !== 'GET'
  )
    return false;

  try {
    const embedded = new URL(url.pathname);
    return (
      embedded.origin === applicationOrigin &&
      embedded.search === '' &&
      embedded.hash === '' &&
      PARTYTOWN_BLOB_PATH.test(embedded.pathname)
    );
  } catch {
    return false;
  }
}

export function isPartytownSandboxDocument(
  request: RequestShape,
  url: URL,
  applicationOrigin: string,
): boolean {
  if (
    (url.protocol !== 'http:' && url.protocol !== 'https:') ||
    url.origin !== applicationOrigin ||
    url.pathname !== '/~partytown/partytown-sandbox-sw.html' ||
    request.resourceType() !== 'document' ||
    request.method() !== 'GET'
  )
    return false;

  return PARTYTOWN_SANDBOX_SEARCH.test(url.search) && url.hash === '';
}
