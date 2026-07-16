export interface RequestShape {
  method(): string;
  resourceType(): string;
}

const PARTYTOWN_BLOB_PATH = /^\/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const PARTYTOWN_SANDBOX_SEARCH = /^\?\d{13}$/u;

export function isPartytownBlobScript(
  request: RequestShape,
  url: URL,
  applicationOrigin: string,
): boolean {
  if (
    url.protocol !== 'blob:'
    || url.search !== ''
    || url.hash !== ''
    || request.resourceType() !== 'script'
    || request.method() !== 'GET'
  ) return false;

  try {
    const embedded = new URL(url.pathname);
    return embedded.origin === applicationOrigin
      && embedded.search === ''
      && embedded.hash === ''
      && PARTYTOWN_BLOB_PATH.test(embedded.pathname);
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
    (url.protocol !== 'http:' && url.protocol !== 'https:')
    || url.origin !== applicationOrigin
    || url.pathname !== '/~partytown/partytown-sandbox-sw.html'
    || request.resourceType() !== 'document'
    || request.method() !== 'GET'
  ) return false;

  return PARTYTOWN_SANDBOX_SEARCH.test(url.search)
    && url.hash === '';
}
