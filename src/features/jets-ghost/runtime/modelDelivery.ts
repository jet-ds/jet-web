import { createHash } from 'node:crypto';

export interface TrustedModelOrigin {
  hostname: string;
  allowSubdomains: boolean;
}

export interface ModelDeliveryConfig {
  url: string;
  bytes: number;
  sha256: string;
  maxRedirects: number;
  trustedOrigins: readonly TrustedModelOrigin[];
}

export type RuntimeLengthObservation =
  | { kind: 'unavailable' }
  | { kind: 'ambiguous'; bytes?: number }
  | { kind: 'range'; bytes: number }
  | { kind: 'encoded-transfer'; bytes: number }
  | { kind: 'cache-metadata'; bytes: number }
  | { kind: 'provider-declared-linked-size'; bytes: number }
  | { kind: 'complete-unencoded-artifact'; bytes: number };

export interface ModelDeliveryRequest {
  url: string;
  method: string;
  headers?: Record<string, string | readonly string[] | undefined>;
  credentials?: string;
  body?: unknown;
  [key: string]: unknown;
}

export interface ModelDeliveryResponse {
  status: number;
  location?: string;
  headers?: Record<string, string | readonly string[] | undefined>;
  runtimeLength?: RuntimeLengthObservation;
}

export interface ModelDeliveryHop {
  request: ModelDeliveryRequest;
  response: ModelDeliveryResponse;
}

export type ModelDeliveryRuleCode =
  | 'CHAIN_EMPTY'
  | 'INITIAL_URL_MISMATCH'
  | 'ORIGIN_NOT_TRUSTED'
  | 'REQUEST_METHOD_NOT_ALLOWED'
  | 'REQUEST_BODY_NOT_ALLOWED'
  | 'REQUEST_CREDENTIALS_NOT_ALLOWED'
  | 'REQUEST_HEADER_NOT_ALLOWED'
  | 'REQUEST_PRIVATE_DATA_PRESENT'
  | 'REDIRECT_LOCATION_REQUIRED'
  | 'REDIRECT_TARGET_INVALID'
  | 'REDIRECT_TARGET_MISMATCH'
  | 'REDIRECT_CHAIN_INCOMPLETE'
  | 'REDIRECT_LOOP'
  | 'REDIRECT_LIMIT_EXCEEDED'
  | 'UNEXPECTED_HOP_AFTER_TERMINAL'
  | 'TERMINAL_STATUS_UNSUCCESSFUL'
  | 'COMPLETE_LENGTH_MISMATCH'
  | 'ARTIFACT_BYTE_COUNT_MISMATCH'
  | 'ARTIFACT_SHA256_MISMATCH'
  | 'ARTIFACT_STREAM_CHUNK_INVALID'
  | 'NETWORK_ERROR';

export interface ModelDeliveryFailure {
  hopIndex: number;
  ruleCode: ModelDeliveryRuleCode;
}

export interface ModelDeliveryValidation {
  valid: boolean;
  initialUrlMatch: boolean;
  trustedHostnames: string[];
  redirectDepth: number;
  runtimeLength: 'unavailable' | {
    kind: 'complete-unencoded-artifact';
    bytes: number;
  };
  failures: ModelDeliveryFailure[];
}

export interface ModelArtifactVerification {
  valid: boolean;
  bytes: number;
  sha256: string;
  failures: ModelDeliveryFailure[];
}

export interface ModelDeliveryResult {
  mode: 'transport-only' | 'hash-artifact';
  validation: ModelDeliveryValidation;
  artifact?: ModelArtifactVerification;
  verifiedAt: string | Date;
  [key: string]: unknown;
}

export interface SanitizedModelDeliveryResult {
  mode: 'transport-only' | 'hash-artifact';
  initialUrlMatch: boolean;
  trustedHostnames: string[];
  redirectDepth: number;
  artifactBytes?: number;
  artifactSha256?: string;
  verifiedAt: string;
  ruleCodes: ModelDeliveryRuleCode[];
}

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);
const ALLOWED_REQUEST_KEYS = new Set([
  'url',
  'method',
  'headers',
  'credentials',
  'body',
]);

function parseTrustedModelUrl(
  value: string,
  policy: readonly TrustedModelOrigin[],
): URL | undefined {
  let url: URL;

  try {
    url = new URL(value);
  } catch {
    return undefined;
  }

  if (
    url.protocol !== 'https:'
    || url.port !== ''
    || url.username !== ''
    || url.password !== ''
  ) {
    return undefined;
  }

  const trusted = policy.some(({ hostname, allowSubdomains }) => (
    url.hostname === hostname
    || (allowSubdomains && url.hostname.endsWith(`.${hostname}`))
  ));

  return trusted ? url : undefined;
}

export function isTrustedModelOrigin(
  value: string,
  policy: readonly TrustedModelOrigin[],
): boolean {
  return parseTrustedModelUrl(value, policy) !== undefined;
}

function hasOnlyAllowedHeaders(headers: ModelDeliveryRequest['headers']): boolean {
  if (!headers) {
    return true;
  }

  return Object.keys(headers).every((header) => header.toLowerCase() === 'range');
}

export function validateModelDeliveryChain(
  chain: readonly ModelDeliveryHop[],
  config: ModelDeliveryConfig,
): ModelDeliveryValidation {
  const failures: ModelDeliveryFailure[] = [];
  const failureKeys = new Set<string>();
  const trustedHostnames: string[] = [];
  const trustedHostnameSet = new Set<string>();
  const visitedUrls = new Set<string>();
  let redirectDepth = 0;
  let runtimeLength: ModelDeliveryValidation['runtimeLength'] = 'unavailable';

  const addFailure = (hopIndex: number, ruleCode: ModelDeliveryRuleCode): void => {
    const key = `${hopIndex}:${ruleCode}`;
    if (!failureKeys.has(key)) {
      failureKeys.add(key);
      failures.push({ hopIndex, ruleCode });
    }
  };

  const initialUrlMatch = chain[0]?.request.url === config.url;

  if (chain.length === 0) {
    addFailure(0, 'CHAIN_EMPTY');
  } else if (!initialUrlMatch) {
    addFailure(0, 'INITIAL_URL_MISMATCH');
  }

  chain.forEach((hop, hopIndex) => {
    const trustedUrl = parseTrustedModelUrl(hop.request.url, config.trustedOrigins);

    if (!trustedUrl) {
      addFailure(hopIndex, 'ORIGIN_NOT_TRUSTED');
    } else {
      visitedUrls.add(trustedUrl.href);
      if (!trustedHostnameSet.has(trustedUrl.hostname)) {
        trustedHostnameSet.add(trustedUrl.hostname);
        trustedHostnames.push(trustedUrl.hostname);
      }
    }

    if (hop.request.method !== 'GET' && hop.request.method !== 'HEAD') {
      addFailure(hopIndex, 'REQUEST_METHOD_NOT_ALLOWED');
    }

    if (hop.request.body !== undefined && hop.request.body !== null) {
      addFailure(hopIndex, 'REQUEST_BODY_NOT_ALLOWED');
    }

    if (
      hop.request.credentials !== undefined
      && hop.request.credentials !== 'omit'
      && hop.request.credentials !== 'same-origin'
    ) {
      addFailure(hopIndex, 'REQUEST_CREDENTIALS_NOT_ALLOWED');
    }

    if (!hasOnlyAllowedHeaders(hop.request.headers)) {
      addFailure(hopIndex, 'REQUEST_HEADER_NOT_ALLOWED');
    }

    if (Object.keys(hop.request).some((key) => !ALLOWED_REQUEST_KEYS.has(key))) {
      addFailure(hopIndex, 'REQUEST_PRIVATE_DATA_PRESENT');
    }

    const lengthObservation = hop.response.runtimeLength;
    if (lengthObservation?.kind === 'complete-unencoded-artifact') {
      runtimeLength = lengthObservation;
      if (lengthObservation.bytes !== config.bytes) {
        addFailure(hopIndex, 'COMPLETE_LENGTH_MISMATCH');
      }
    }

    if (REDIRECT_STATUSES.has(hop.response.status)) {
      redirectDepth += 1;
      if (redirectDepth > config.maxRedirects) {
        addFailure(hopIndex, 'REDIRECT_LIMIT_EXCEEDED');
      }

      if (!hop.response.location) {
        addFailure(hopIndex, 'REDIRECT_LOCATION_REQUIRED');
        return;
      }

      let targetUrl: URL;
      try {
        targetUrl = new URL(hop.response.location, hop.request.url);
      } catch {
        addFailure(hopIndex, 'REDIRECT_TARGET_INVALID');
        return;
      }

      if (!isTrustedModelOrigin(targetUrl.href, config.trustedOrigins)) {
        addFailure(hopIndex + 1, 'ORIGIN_NOT_TRUSTED');
      }

      if (visitedUrls.has(targetUrl.href)) {
        addFailure(hopIndex, 'REDIRECT_LOOP');
      }

      const nextHop = chain[hopIndex + 1];
      if (!nextHop) {
        addFailure(hopIndex, 'REDIRECT_CHAIN_INCOMPLETE');
      } else if (nextHop.request.url !== targetUrl.href) {
        addFailure(hopIndex + 1, 'REDIRECT_TARGET_MISMATCH');
      }
      return;
    }

    if (hop.response.status < 200 || hop.response.status >= 300) {
      addFailure(hopIndex, 'TERMINAL_STATUS_UNSUCCESSFUL');
    }

    if (hopIndex < chain.length - 1) {
      addFailure(hopIndex + 1, 'UNEXPECTED_HOP_AFTER_TERMINAL');
    }
  });

  return {
    valid: failures.length === 0,
    initialUrlMatch,
    trustedHostnames,
    redirectDepth,
    runtimeLength,
    failures,
  };
}

export async function verifyModelArtifactStream(
  stream: AsyncIterable<unknown>,
  expected: {
    bytes: number;
    sha256: string;
    hopIndex?: number;
    [key: string]: unknown;
  },
): Promise<ModelArtifactVerification> {
  const hash = createHash('sha256');
  const failures: ModelDeliveryFailure[] = [];
  let bytes = 0;

  for await (const chunk of stream) {
    let data: Uint8Array;

    if (typeof chunk === 'string') {
      data = Buffer.from(chunk);
    } else if (Buffer.isBuffer(chunk)) {
      data = chunk;
    } else if (chunk instanceof Uint8Array) {
      data = chunk;
    } else {
      failures.push({
        hopIndex: expected.hopIndex ?? 0,
        ruleCode: 'ARTIFACT_STREAM_CHUNK_INVALID',
      });
      continue;
    }

    bytes += data.byteLength;
    hash.update(data);
  }

  const sha256 = hash.digest('hex');
  const hopIndex = expected.hopIndex ?? 0;

  if (bytes !== expected.bytes) {
    failures.push({ hopIndex, ruleCode: 'ARTIFACT_BYTE_COUNT_MISMATCH' });
  }
  if (sha256 !== expected.sha256) {
    failures.push({ hopIndex, ruleCode: 'ARTIFACT_SHA256_MISMATCH' });
  }

  return {
    valid: failures.length === 0,
    bytes,
    sha256,
    failures,
  };
}

export function sanitizeModelDeliveryResult(
  result: ModelDeliveryResult,
): SanitizedModelDeliveryResult {
  const ruleCodes = [
    ...result.validation.failures.map(({ ruleCode }) => ruleCode),
    ...(result.artifact?.failures.map(({ ruleCode }) => ruleCode) ?? []),
  ].filter((ruleCode, index, codes) => codes.indexOf(ruleCode) === index);
  const sanitized: SanitizedModelDeliveryResult = {
    mode: result.mode,
    initialUrlMatch: result.validation.initialUrlMatch,
    trustedHostnames: [...result.validation.trustedHostnames],
    redirectDepth: result.validation.redirectDepth,
    verifiedAt: new Date(result.verifiedAt).toISOString(),
    ruleCodes,
  };

  if (result.artifact) {
    sanitized.artifactBytes = result.artifact.bytes;
    sanitized.artifactSha256 = result.artifact.sha256;
  }

  return sanitized;
}
