import { createHash } from 'node:crypto';
import { Readable } from 'node:stream';
import { describe, expect, it } from 'vitest';
import { EGREGORE_MODEL } from '../../../src/features/egregore/config';
import {
  isTrustedModelOrigin,
  sanitizeModelDeliveryResult,
  validateModelDeliveryChain,
  verifyModelArtifactStream,
  type ModelDeliveryHop,
} from '../../../src/features/egregore/runtime/modelDelivery';

const PINNED_URL = EGREGORE_MODEL.url;

function terminalHop(
  url: string = PINNED_URL,
  overrides: Partial<ModelDeliveryHop> = {},
): ModelDeliveryHop {
  return {
    request: {
      url,
      method: 'GET',
    },
    response: {
      status: 200,
    },
    ...overrides,
  };
}

function deliveryChain(redirects: number): ModelDeliveryHop[] {
  if (redirects === 0) {
    return [terminalHop()];
  }

  const urls = [
    PINNED_URL,
    ...Array.from({ length: redirects }, (_, index) => (
      `https://${index === 0 ? '' : `edge-${index}.`}cdn.hf.co/transient/${index}`
      + `?X-Amz-Signature=secret-${index}&Policy=policy-${index}`
    )),
  ];

  return urls.map((url, index) => {
    if (index === urls.length - 1) {
      return terminalHop(url, {
        response: {
          status: 206,
          headers: {
            etag: 'provider-metadata-must-not-qualify-the-artifact',
          },
        },
      });
    }

    return {
      request: {
        url,
        method: 'GET',
      },
      response: {
        status: index % 2 === 0 ? 302 : 307,
        location: urls[index + 1],
        headers: {
          'x-provider-policy': `private-policy-${index}`,
        },
      },
    };
  });
}

function failureCodes(chain: ModelDeliveryHop[]): string[] {
  return validateModelDeliveryChain(chain, EGREGORE_MODEL)
    .failures.map(({ ruleCode }) => ruleCode);
}

describe('model delivery origin policy', () => {
  it('accepts only HTTPS default-port origins on boundary-safe trusted hostnames', () => {
    const policy = EGREGORE_MODEL.trustedOrigins;

    expect(isTrustedModelOrigin('https://huggingface.co/model', policy)).toBe(true);
    expect(isTrustedModelOrigin('https://cdn.hf.co/model', policy)).toBe(true);
    expect(isTrustedModelOrigin('https://edge.cdn.hf.co:443/model', policy)).toBe(true);
    expect(isTrustedModelOrigin('http://cdn.hf.co/model', policy)).toBe(false);
    expect(isTrustedModelOrigin('https://cdn.hf.co:444/model', policy)).toBe(false);
    expect(isTrustedModelOrigin('https://user:password@cdn.hf.co/model', policy)).toBe(false);
    expect(isTrustedModelOrigin('https://cdn.hf.co.example.com/model', policy)).toBe(false);
    expect(isTrustedModelOrigin('https://evilcdn.hf.co/model', policy)).toBe(false);
    expect(isTrustedModelOrigin('not a URL', policy)).toBe(false);
  });

  it('accepts exact and boundary-safe Xet delivery origins', () => {
    const policy = EGREGORE_MODEL.trustedOrigins;

    expect(isTrustedModelOrigin('https://xethub.hf.co/model', policy)).toBe(true);
    expect(isTrustedModelOrigin('https://cas-bridge.xethub.hf.co/model', policy)).toBe(true);
  });

  it('rejects Xet delivery lookalikes', () => {
    const policy = EGREGORE_MODEL.trustedOrigins;

    expect(isTrustedModelOrigin('https://xethub.hf.co.example.com/model', policy)).toBe(false);
    expect(isTrustedModelOrigin('https://evilxethub.hf.co/model', policy)).toBe(false);
  });
});

describe('model delivery chain validation', () => {
  it('requires the first request URL to equal the revision pin byte-for-byte', () => {
    const changedInitialUrl = terminalHop(`${PINNED_URL}?Policy=provider-change`);
    const result = validateModelDeliveryChain([changedInitialUrl], EGREGORE_MODEL);

    expect(result.valid).toBe(false);
    expect(result.initialUrlMatch).toBe(false);
    expect(result.failures).toEqual([
      { hopIndex: 0, ruleCode: 'INITIAL_URL_MISMATCH' },
    ]);
  });

  it('resolves relative redirect locations against the current trusted URL', () => {
    const relativeTarget = new URL('/signed/artifact?Key=changed&Signature=secret', PINNED_URL).href;
    const result = validateModelDeliveryChain([
      {
        request: { url: PINNED_URL, method: 'GET' },
        response: { status: 302, location: '/signed/artifact?Key=changed&Signature=secret' },
      },
      terminalHop(relativeTarget),
    ], EGREGORE_MODEL);

    expect(result.valid).toBe(true);
    expect(result.redirectDepth).toBe(1);
  });

  it('requires locations, rejects loops, and requires a successful terminal response', () => {
    expect(failureCodes([{
      request: { url: PINNED_URL, method: 'GET' },
      response: { status: 302 },
    }])).toContain('REDIRECT_LOCATION_REQUIRED');

    expect(failureCodes([
      {
        request: { url: PINNED_URL, method: 'GET' },
        response: { status: 302, location: PINNED_URL },
      },
    ])).toContain('REDIRECT_LOOP');

    expect(failureCodes([
      terminalHop(PINNED_URL, { response: { status: 503 } }),
    ])).toContain('TERMINAL_STATUS_UNSUCCESSFUL');
  });

  it('accepts zero through five redirects and rejects the sixth', () => {
    for (let redirectCount = 0; redirectCount <= EGREGORE_MODEL.maxRedirects; redirectCount += 1) {
      const result = validateModelDeliveryChain(deliveryChain(redirectCount), EGREGORE_MODEL);
      expect(result.valid, `${redirectCount} redirects`).toBe(true);
      expect(result.redirectDepth).toBe(redirectCount);
    }

    const result = validateModelDeliveryChain(deliveryChain(6), EGREGORE_MODEL);
    expect(result.valid).toBe(false);
    expect(result.failures).toContainEqual({
      hopIndex: 5,
      ruleCode: 'REDIRECT_LIMIT_EXCEEDED',
    });
  });

  it('allows provider delivery details to change within the approved boundary', () => {
    const first = validateModelDeliveryChain(deliveryChain(1), EGREGORE_MODEL);
    const changed = deliveryChain(3);
    changed[changed.length - 1] = terminalHop(
      'https://regional.edge-2.cdn.hf.co/another/transient/path?NewKey=new-secret',
      {
        response: {
          status: 200,
          headers: {
            'content-length': 'provider-claim-is-ignored',
            'x-linked-size': String(EGREGORE_MODEL.bytes),
          },
        },
      },
    );
    changed[changed.length - 2].response.location = changed[changed.length - 1].request.url;
    const second = validateModelDeliveryChain(changed, EGREGORE_MODEL);

    expect(first.valid).toBe(true);
    expect(second.valid).toBe(true);
  });

  it('accepts only bodyless GET or HEAD requests without application data', () => {
    for (const method of ['GET', 'HEAD'] as const) {
      const result = validateModelDeliveryChain([
        terminalHop(PINNED_URL, {
          request: {
            url: PINNED_URL,
            method,
            headers: method === 'GET' ? { Range: 'bytes=0-65535' } : undefined,
            credentials: 'omit',
          },
        }),
      ], EGREGORE_MODEL);
      expect(result.valid, method).toBe(true);
    }

    expect(failureCodes([
      terminalHop(PINNED_URL, {
        request: { url: PINNED_URL, method: 'POST' },
      }),
    ])).toContain('REQUEST_METHOD_NOT_ALLOWED');
    expect(failureCodes([
      terminalHop(PINNED_URL, {
        request: { url: PINNED_URL, method: 'GET', body: '' },
      }),
    ])).toContain('REQUEST_BODY_NOT_ALLOWED');
  });

  it.each([
    ['closed', 'Range', 'bytes=0-65535'],
    ['open-ended', 'range', 'bytes=65536-'],
    ['suffix', 'RANGE', 'bytes=-65536'],
  ])('accepts a valid %s browser byte range with a case-insensitive header name', (
    _label,
    headerName,
    headerValue,
  ) => {
    const result = validateModelDeliveryChain([
      terminalHop(PINNED_URL, {
        request: {
          url: PINNED_URL,
          method: 'GET',
          headers: { [headerName]: headerValue },
        },
      }),
    ], EGREGORE_MODEL);

    expect(result.valid).toBe(true);
    expect(result.failures).toEqual([]);
  });

  it.each([
    ['malformed', 'prompt-sentinel'],
    ['non-byte unit', 'items=0-65535'],
    ['empty', ''],
    ['missing both bounds', 'bytes=-'],
    ['reversed bounds', 'bytes=65535-0'],
    ['array-valued', ['bytes=0-1', 'array-sentinel'] as const],
    ['undefined-valued', undefined],
    ['newline/sentinel-bearing', 'bytes=0-1\r\nX-Prompt: newline-sentinel'],
  ])('rejects a %s Range value without retaining it in diagnostics', (
    _label,
    rangeValue,
  ) => {
    const validation = validateModelDeliveryChain([
      terminalHop(PINNED_URL, {
        request: {
          url: PINNED_URL,
          method: 'GET',
          headers: { Range: rangeValue },
        },
      }),
    ], EGREGORE_MODEL);
    const sanitized = sanitizeModelDeliveryResult({
      mode: 'transport-only',
      validation,
      verifiedAt: '2026-07-14T05:00:00Z',
    });

    expect(validation.valid).toBe(false);
    expect(validation.failures).toEqual([
      { hopIndex: 0, ruleCode: 'REQUEST_HEADER_NOT_ALLOWED' },
    ]);
    expect(sanitized.ruleCodes).toEqual(['REQUEST_HEADER_NOT_ALLOWED']);

    const diagnostics = JSON.stringify({ failures: validation.failures, sanitized });
    const rawValues = typeof rangeValue === 'string'
      ? [rangeValue]
      : (Array.isArray(rangeValue) ? rangeValue : []);
    for (const rawValue of rawValues) {
      if (rawValue.length > 0) {
        expect(diagnostics).not.toContain(rawValue);
      }
    }
  });

  it.each([
    { headers: { Authorization: 'Bearer authorization-secret' } },
    { headers: { Cookie: 'session=cookie-secret' } },
    { headers: { 'X-Application-Header': 'custom-secret' } },
    { credentials: 'include' },
    { prompt: 'prompt-sentinel' },
    { selectedContext: 'selected-context-sentinel' },
    { history: ['history-sentinel'] },
    { responseSentinel: 'response-sentinel' },
  ])('rejects private or application-defined request input %#', (injected) => {
    const request = {
      url: PINNED_URL,
      method: 'GET',
      ...injected,
    } as ModelDeliveryHop['request'];
    const result = validateModelDeliveryChain([
      terminalHop(PINNED_URL, { request }),
    ], EGREGORE_MODEL);

    expect(result.valid).toBe(false);
    expect(result.failures.every((failure) => (
      Object.keys(failure).sort().join(',') === 'hopIndex,ruleCode'
    ))).toBe(true);
    const serializedFailures = JSON.stringify(result.failures);
    for (const secret of [
      'authorization-secret',
      'cookie-secret',
      'custom-secret',
      'prompt-sentinel',
      'selected-context-sentinel',
      'history-sentinel',
      'response-sentinel',
    ]) {
      expect(serializedFailures).not.toContain(secret);
    }
  });

  it('uses only explicit complete-unencoded byte observations for size validation', () => {
    const unavailableKinds = [
      undefined,
      { kind: 'unavailable' as const },
      { kind: 'ambiguous' as const, bytes: 1 },
      { kind: 'range' as const, bytes: 1 },
      { kind: 'encoded-transfer' as const, bytes: 1 },
      { kind: 'cache-metadata' as const, bytes: 1 },
      { kind: 'provider-declared-linked-size' as const, bytes: 1 },
    ];

    for (const runtimeLength of unavailableKinds) {
      const result = validateModelDeliveryChain([
        terminalHop(PINNED_URL, {
          response: { status: 200, runtimeLength },
        }),
      ], EGREGORE_MODEL);
      expect(result.valid, runtimeLength?.kind ?? 'missing').toBe(true);
      expect(result.runtimeLength).toBe('unavailable');
    }

    const exact = validateModelDeliveryChain([
      terminalHop(PINNED_URL, {
        response: {
          status: 200,
          runtimeLength: {
            kind: 'complete-unencoded-artifact',
            bytes: EGREGORE_MODEL.bytes,
          },
        },
      }),
    ], EGREGORE_MODEL);
    expect(exact.valid).toBe(true);
    expect(exact.runtimeLength).toEqual({
      kind: 'complete-unencoded-artifact',
      bytes: EGREGORE_MODEL.bytes,
    });

    const mismatch = validateModelDeliveryChain([
      terminalHop(PINNED_URL, {
        response: {
          status: 200,
          runtimeLength: {
            kind: 'complete-unencoded-artifact',
            bytes: EGREGORE_MODEL.bytes - 1,
          },
        },
      }),
    ], EGREGORE_MODEL);
    expect(mismatch.failures).toContainEqual({
      hopIndex: 0,
      ruleCode: 'COMPLETE_LENGTH_MISMATCH',
    });
  });
});

describe('model artifact stream qualification', () => {
  const artifact = Buffer.from('independently-hashed-model-artifact');
  const expected = {
    bytes: artifact.byteLength,
    sha256: createHash('sha256').update(artifact).digest('hex'),
  };

  it('passes only the independently counted and hashed complete stream', async () => {
    const result = await verifyModelArtifactStream(
      Readable.from([artifact.subarray(0, 7), artifact.subarray(7)]),
      expected,
    );

    expect(result).toEqual({
      valid: true,
      bytes: artifact.byteLength,
      sha256: expected.sha256,
      failures: [],
    });
  });

  it.each([
    ['truncated', artifact.subarray(0, -1)],
    ['extended', Buffer.concat([artifact, Buffer.of(0)])],
    ['mutated', Buffer.concat([Buffer.of(artifact[0] ^ 1), artifact.subarray(1)])],
  ])('rejects a %s stream regardless of provider metadata', async (_label, bytes) => {
    const result = await verifyModelArtifactStream(Readable.from([bytes]), {
      ...expected,
      providerDeclaredBytes: expected.bytes,
      providerDeclaredSha256: expected.sha256,
    });

    expect(result.valid).toBe(false);
    expect(result.failures.length).toBeGreaterThan(0);
    expect(JSON.stringify(result.failures)).not.toContain(expected.sha256);
  });
});

describe('model delivery diagnostics', () => {
  it('retains only the sanitized qualification projection', async () => {
    const signedUrl = 'https://cdn.hf.co/transient/private?Signature=signature-sentinel&Policy=policy-sentinel';
    const validation = validateModelDeliveryChain([
      {
        request: { url: PINNED_URL, method: 'GET' },
        response: {
          status: 302,
          location: signedUrl,
          headers: { 'set-cookie': 'raw-header-sentinel' },
        },
      },
      terminalHop(signedUrl, {
        request: {
          url: signedUrl,
          method: 'GET',
          headers: { Authorization: 'authorization-sentinel' },
        },
      }),
    ], EGREGORE_MODEL);
    const artifact = Buffer.from('qualified');
    const artifactResult = await verifyModelArtifactStream(Readable.from([artifact]), {
      bytes: artifact.byteLength,
      sha256: createHash('sha256').update(artifact).digest('hex'),
    });

    const sanitized = sanitizeModelDeliveryResult({
      mode: 'hash-artifact',
      validation,
      artifact: artifactResult,
      verifiedAt: '2026-07-14T05:00:00+08:00',
      completeRedirectedUrl: signedUrl,
      rawHeaders: { cookie: 'cookie-sentinel' },
      prompt: 'prompt-sentinel',
      selectedContext: 'context-sentinel',
      history: 'history-sentinel',
      response: 'response-sentinel',
    });

    expect(sanitized).toEqual({
      mode: 'hash-artifact',
      initialUrlMatch: true,
      trustedHostnames: ['huggingface.co', 'cdn.hf.co'],
      redirectDepth: 1,
      artifactBytes: artifact.byteLength,
      artifactSha256: artifactResult.sha256,
      verifiedAt: '2026-07-13T21:00:00.000Z',
      ruleCodes: ['REQUEST_HEADER_NOT_ALLOWED'],
    });
    expect(Object.keys(sanitized).sort()).toEqual([
      'artifactBytes',
      'artifactSha256',
      'initialUrlMatch',
      'mode',
      'redirectDepth',
      'ruleCodes',
      'trustedHostnames',
      'verifiedAt',
    ]);

    const serialized = JSON.stringify(sanitized);
    for (const secret of [
      signedUrl,
      'signature-sentinel',
      'policy-sentinel',
      'raw-header-sentinel',
      'authorization-sentinel',
      'cookie-sentinel',
      'prompt-sentinel',
      'context-sentinel',
      'history-sentinel',
      'response-sentinel',
    ]) {
      expect(serialized).not.toContain(secret);
    }
  });
});
