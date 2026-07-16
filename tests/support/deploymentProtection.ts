const DEPLOYMENT_PROTECTION_COOKIE_NAME = '_vercel_jwt';
const DEPLOYMENT_PROTECTION_COOKIE_VALUE = /^[A-Za-z0-9._~-]+$/u;
const DEPLOYMENT_PROTECTION_TIMEOUT_MS = 30_000;

interface BypassCookie {
  name: string;
  value: string;
  url: string;
  httpOnly: boolean;
  secure: boolean;
  sameSite: 'Lax';
}

export interface BypassBrowserContext {
  addCookies(cookies: BypassCookie[]): Promise<void>;
}

function validatedPreviewOrigin(origin: string): string {
  const url = new URL(origin);
  if (
    url.protocol !== 'https:'
    || url.port !== ''
    || !url.hostname.endsWith('.vercel.app')
    || url.origin !== origin
  ) {
    throw new Error('DEPLOYMENT_PROTECTION_ORIGIN_FORBIDDEN');
  }
  return url.origin;
}

function responseSetCookies(headers: Headers): string[] {
  const getSetCookie = (headers as Headers & {
    getSetCookie?: () => string[];
  }).getSetCookie;
  if (getSetCookie !== undefined) return getSetCookie.call(headers);
  const combined = headers.get('set-cookie');
  return combined === null ? [] : [combined];
}

function deploymentProtectionCookieValue(headers: Headers): string {
  const matches = responseSetCookies(headers)
    .map((header) => header.split(';', 1)[0])
    .filter((cookie) => cookie.startsWith(`${DEPLOYMENT_PROTECTION_COOKIE_NAME}=`));
  if (matches.length !== 1) {
    throw new Error('DEPLOYMENT_PROTECTION_COOKIE_MISSING');
  }
  const value = matches[0].slice(DEPLOYMENT_PROTECTION_COOKIE_NAME.length + 1);
  if (!DEPLOYMENT_PROTECTION_COOKIE_VALUE.test(value)) {
    throw new Error('DEPLOYMENT_PROTECTION_COOKIE_INVALID');
  }
  return value;
}

function validateManualRedirect(
  response: Response,
  requestUrl: string,
  previewOrigin: string,
): void {
  if (response.redirected) {
    throw new Error('DEPLOYMENT_PROTECTION_REDIRECT_FORBIDDEN');
  }
  if (response.status >= 200 && response.status < 300) return;
  if (response.status < 300 || response.status >= 400) {
    throw new Error('DEPLOYMENT_PROTECTION_RESPONSE_FAILED');
  }

  const location = response.headers.get('location');
  if (location === null) {
    throw new Error('DEPLOYMENT_PROTECTION_REDIRECT_FORBIDDEN');
  }
  const target = new URL(location, requestUrl);
  if (
    target.origin !== previewOrigin
    || target.pathname !== '/chatbot/'
    || target.search !== ''
    || target.hash !== ''
  ) {
    throw new Error('DEPLOYMENT_PROTECTION_REDIRECT_FORBIDDEN');
  }
}

export async function establishDeploymentProtectionBypass(
  context: BypassBrowserContext,
  origin: string,
  secret: string | undefined,
): Promise<void> {
  if (secret === undefined || secret.trim() === '') return;

  const previewOrigin = validatedPreviewOrigin(origin);
  const requestUrl = new URL('/chatbot/', previewOrigin).toString();
  let response: Response;
  try {
    response = await fetch(requestUrl, {
      headers: {
        'x-vercel-protection-bypass': secret,
        'x-vercel-set-bypass-cookie': 'true',
      },
      redirect: 'manual',
      signal: AbortSignal.timeout(DEPLOYMENT_PROTECTION_TIMEOUT_MS),
    });
  } catch {
    throw new Error('DEPLOYMENT_PROTECTION_REQUEST_FAILED');
  }

  validateManualRedirect(response, requestUrl, previewOrigin);
  const cookieValue = deploymentProtectionCookieValue(response.headers);
  try {
    await context.addCookies([{
      name: DEPLOYMENT_PROTECTION_COOKIE_NAME,
      value: cookieValue,
      url: previewOrigin,
      httpOnly: true,
      secure: true,
      sameSite: 'Lax',
    }]);
  } catch {
    throw new Error('DEPLOYMENT_PROTECTION_COOKIE_INSTALL_FAILED');
  }
}
