import { describe, expect, it } from 'vitest';
import {
  isAllowedDeploymentProtectionCookie,
  isPartytownBlobScript,
  isPartytownSandboxDocument,
} from '../../manual/requestPrivacy';

function requestShape(method: string, resourceType: string) {
  return {
    method: () => method,
    resourceType: () => resourceType,
  };
}

describe('real-model Partytown privacy classifiers', () => {
  const origin = 'https://jetsanchez.com';
  const uuid = '123e4567-e89b-42d3-a456-426614174000';

  it('accepts only a query-free and hash-free same-origin UUID-v4 blob script', () => {
    const scriptRequest = requestShape('GET', 'script');
    const webKitScriptRequest = requestShape('GET', 'xhr');

    expect(
      isPartytownBlobScript(
        scriptRequest,
        new URL(`blob:${origin}/${uuid}`),
        origin,
      ),
    ).toBe(true);
    expect(
      isPartytownBlobScript(
        webKitScriptRequest,
        new URL(`blob:${origin}/${uuid}`),
        origin,
      ),
    ).toBe(true);
    expect(
      isPartytownBlobScript(
        scriptRequest,
        new URL(`blob:${origin}/${uuid}?unexpected`),
        origin,
      ),
    ).toBe(false);
    expect(
      isPartytownBlobScript(
        scriptRequest,
        new URL(`blob:${origin}/${uuid}#unexpected`),
        origin,
      ),
    ).toBe(false);
    expect(
      isPartytownBlobScript(
        scriptRequest,
        new URL(`blob:https://example.com/${uuid}`),
        origin,
      ),
    ).toBe(false);
    expect(
      isPartytownBlobScript(
        requestShape('POST', 'script'),
        new URL(`blob:${origin}/${uuid}`),
        origin,
      ),
    ).toBe(false);
    expect(
      isPartytownBlobScript(
        requestShape('GET', 'fetch'),
        new URL(`blob:${origin}/${uuid}`),
        origin,
      ),
    ).toBe(false);
  });

  it('accepts only the fixed timestamped same-origin sandbox document', () => {
    const documentRequest = requestShape('GET', 'document');
    const valid = `${origin}/~partytown/partytown-sandbox-sw.html?1721157600000`;

    expect(
      isPartytownSandboxDocument(documentRequest, new URL(valid), origin),
    ).toBe(true);
    expect(
      isPartytownSandboxDocument(
        documentRequest,
        new URL(`${valid}&extra=1`),
        origin,
      ),
    ).toBe(false);
    expect(
      isPartytownSandboxDocument(
        documentRequest,
        new URL(`${origin}/~partytown/other.html?1721157600000`),
        origin,
      ),
    ).toBe(false);
    expect(
      isPartytownSandboxDocument(
        requestShape('GET', 'script'),
        new URL(valid),
        origin,
      ),
    ).toBe(false);
  });

  it('allows only the infrastructure bypass cookie during protected Preview smoke', () => {
    expect(isAllowedDeploymentProtectionCookie(undefined, false)).toBe(true);
    expect(
      isAllowedDeploymentProtectionCookie(
        '_vercel_jwt=header.payload.signature',
        true,
      ),
    ).toBe(true);
    expect(
      isAllowedDeploymentProtectionCookie(
        '_vercel_jwt=header.payload.signature',
        false,
      ),
    ).toBe(false);
    expect(
      isAllowedDeploymentProtectionCookie(
        '_vercel_jwt=header.payload.signature; other=value',
        true,
      ),
    ).toBe(false);
    expect(isAllowedDeploymentProtectionCookie('other=value', true)).toBe(
      false,
    );
  });
});
