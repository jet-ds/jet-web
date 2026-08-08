import {
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

type JsonObject = Record<string, unknown>;

export type SafeBlobInventoryEntry = {
  pathname: string;
  url: string;
  size: number;
  uploadedAt: string;
};

const KNOWN_BLOB_HOST = 'vyge4wbmw8jgd8rh.public.blob.vercel-storage.com';
const SANITIZING_MODES = new Set([
  'sanitize-inspect',
  'sanitize-deployment',
  'sanitize-env',
  'sanitize-openrouter-revocation',
]);
const ALLOWED_SCOPES = new Set(['production', 'preview', 'development']);
const CREDENTIAL_PATTERN =
  /(?:\bBearer\s+|\bBasic\s+|\bsk[-_](?:or[-_])?(?:v\d[-_])?|\b(?:ghp|gho|github_pat|vercel)[-_][A-Za-z0-9_-]{12,}|\beyJ[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]{8,}\.)/i;
const SENSITIVE_COMPONENT_PATTERN =
  /(?:access[-_]?token|api[-_]?key|authorization|password|secret|cookie|token\s*=|sk[-_](?:or[-_])?(?:v\d[-_])?)/i;

class EvidenceError extends Error {
  constructor(readonly rule: string) {
    super(rule);
  }
}

function fail(rule: string): never {
  throw new EvidenceError(rule);
}

function isObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requireObject(value: unknown, rule = 'INVALID_OBJECT'): JsonObject {
  if (!isObject(value)) fail(rule);
  return value;
}

function requireString(value: unknown, rule: string, maxLength = 512): string {
  if (
    typeof value !== 'string' ||
    value.length === 0 ||
    value.length > maxLength ||
    // eslint-disable-next-line no-control-regex -- This security boundary intentionally rejects ASCII control bytes.
    /[\u0000-\u001f\u007f]/u.test(value)
  ) {
    fail(rule);
  }
  return value;
}

function requireNullableTarget(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const target = requireString(value, 'INVALID_TARGET', 64);
  if (!/^[a-z][a-z0-9-]*$/u.test(target)) fail('INVALID_TARGET');
  return target;
}

function requireReadyState(value: unknown): string {
  const readyState = requireString(value, 'INVALID_READY_STATE', 64);
  if (!/^[A-Z][A-Z0-9_]*$/u.test(readyState)) fail('INVALID_READY_STATE');
  return readyState;
}

function requireIdentifier(value: unknown, rule: string): string {
  const identifier = requireString(value, rule, 256);
  if (
    !/^[A-Za-z0-9][A-Za-z0-9_.:@/-]*$/u.test(identifier) ||
    CREDENTIAL_PATTERN.test(identifier)
  ) {
    fail(rule);
  }
  return identifier;
}

function requireSha(value: unknown): string {
  const sha = requireString(value, 'INVALID_GIT_SHA', 40).toLowerCase();
  if (!/^[a-f0-9]{40}$/u.test(sha)) fail('INVALID_GIT_SHA');
  return sha;
}

function requireUtcTimestamp(value: unknown, rule: string): string {
  const timestamp = requireString(value, rule, 64);
  if (!timestamp.endsWith('Z')) fail(rule);
  const parsed = new Date(timestamp);
  if (Number.isNaN(parsed.getTime())) fail(rule);
  return parsed.toISOString();
}

function requireCreatedAt(value: unknown): number | string {
  if (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0)
    return value;
  return requireUtcTimestamp(value, 'INVALID_CREATED_AT');
}

function repeatedlyDecode(value: string): string[] {
  const values = [value];
  for (let index = 0; index < 4; index += 1) {
    try {
      const decoded = decodeURIComponent(values.at(-1)!);
      if (decoded === values.at(-1)) break;
      values.push(decoded);
    } catch {
      fail('INVALID_URL_ENCODING');
    }
  }
  return values;
}

function assertSafeUrlText(value: string): void {
  for (const decoded of repeatedlyDecode(value)) {
    if (
      // eslint-disable-next-line no-control-regex -- URL evidence must reject encoded ASCII control bytes after decoding.
      /[\u0000-\u001f\u007f]/u.test(decoded) ||
      CREDENTIAL_PATTERN.test(decoded) ||
      SENSITIVE_COMPONENT_PATTERN.test(decoded) ||
      looksHighEntropy(decoded)
    ) {
      fail('UNSAFE_URL_COMPONENT');
    }
  }
}

function parseHttpsUrl(value: unknown, allowBareHost: boolean): URL {
  const raw = requireString(value, 'INVALID_URL', 2_048);
  assertSafeUrlText(raw);
  const candidate =
    allowBareHost && !raw.includes('://') ? `https://${raw}` : raw;
  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch {
    fail('INVALID_URL');
  }
  if (
    parsed.protocol !== 'https:' ||
    parsed.username !== '' ||
    parsed.password !== '' ||
    (parsed.port !== '' && parsed.port !== '443')
  ) {
    fail('INVALID_URL_AUTHORITY');
  }
  assertSafeUrlText(parsed.hostname);
  assertSafeUrlText(parsed.pathname);
  assertSafeUrlText(parsed.search);
  assertSafeUrlText(parsed.hash);
  return parsed;
}

function requireRootOnly(parsed: URL): void {
  if (
    (parsed.pathname !== '' && parsed.pathname !== '/') ||
    parsed.search !== '' ||
    parsed.hash !== ''
  ) {
    fail('INVALID_HOST_URL_SHAPE');
  }
}

function requireVercelDeploymentHost(value: unknown): string {
  const parsed = parseHttpsUrl(value, true);
  requireRootOnly(parsed);
  if (
    parsed.hostname === 'vercel.app' ||
    !parsed.hostname.endsWith('.vercel.app')
  ) {
    fail('INVALID_DEPLOYMENT_HOST');
  }
  return parsed.hostname;
}

function requireAliasHost(value: unknown): string {
  const parsed = parseHttpsUrl(value, true);
  requireRootOnly(parsed);
  const hostname = parsed.hostname;
  if (
    hostname !== 'jetsanchez.com' &&
    hostname !== 'www.jetsanchez.com' &&
    (hostname === 'vercel.app' || !hostname.endsWith('.vercel.app'))
  ) {
    fail('INVALID_ALIAS_HOST');
  }
  return hostname;
}

function requireBlobUrl(value: unknown): string {
  const parsed = parseHttpsUrl(value, false);
  if (
    parsed.hostname !== KNOWN_BLOB_HOST ||
    parsed.search !== '' ||
    parsed.hash !== '' ||
    parsed.pathname === '/'
  ) {
    fail('INVALID_BLOB_URL');
  }
  return parsed.toString();
}

function requireSiteDestination(value: unknown): string {
  const parsed = parseHttpsUrl(value, false);
  if (
    !['jetsanchez.com', 'www.jetsanchez.com'].includes(parsed.hostname) ||
    parsed.search !== '' ||
    parsed.hash !== ''
  ) {
    fail('INVALID_DESTINATION_URL');
  }
  return parsed.toString();
}

function exactKeys(object: JsonObject, keys: string[], rule: string): void {
  const actual = Object.keys(object).sort();
  const expected = [...keys].sort();
  if (JSON.stringify(actual) !== JSON.stringify(expected)) fail(rule);
}

function compareText(left: string, right: string): number {
  if (left === right) return 0;
  return left < right ? -1 : 1;
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!isObject(value)) return value;
  return Object.fromEntries(
    Object.entries(value)
      .sort(([left], [right]) => compareText(left, right))
      .map(([key, child]) => [key, canonicalize(child)]),
  );
}

function canonicalJson(value: unknown): string {
  return `${JSON.stringify(canonicalize(value), null, 2)}\n`;
}

export { canonicalJson as canonicalEvidenceJson };

function projectInspect(input: unknown): JsonObject {
  const object = requireObject(input, 'INVALID_INSPECT_INPUT');
  const aliasInput = object.aliases ?? object.alias;
  if (!Array.isArray(aliasInput)) fail('INVALID_ALIASES');
  const aliases = aliasInput.map(requireAliasHost).sort();
  if (new Set(aliases).size !== aliases.length) fail('DUPLICATE_ALIAS');
  return {
    id: requireIdentifier(object.id, 'INVALID_DEPLOYMENT_ID'),
    name: requireIdentifier(object.name, 'INVALID_PROJECT_NAME'),
    url: requireVercelDeploymentHost(object.url),
    target: requireNullableTarget(object.target),
    readyState: requireReadyState(object.readyState ?? object.state),
    aliases,
  };
}

function projectDeployment(input: unknown): JsonObject {
  const object = requireObject(input, 'INVALID_DEPLOYMENT_INPUT');
  const gitSource = requireObject(object.gitSource, 'INVALID_GIT_SOURCE');
  const nestedProject = isObject(object.project) ? object.project : undefined;
  const projectId = nestedProject?.id ?? object.projectId;
  const projectName = nestedProject?.name ?? object.name;
  return {
    id: requireIdentifier(object.id, 'INVALID_DEPLOYMENT_ID'),
    url: requireVercelDeploymentHost(object.url),
    target: requireNullableTarget(object.target),
    readyState: requireReadyState(object.readyState ?? object.state),
    createdAt: requireCreatedAt(object.createdAt),
    gitSource: {
      type: requireIdentifier(gitSource.type, 'INVALID_GIT_SOURCE_TYPE'),
      ref: requireString(gitSource.ref, 'INVALID_GIT_REF', 512),
      sha: requireSha(gitSource.sha),
    },
    project: {
      id: requireIdentifier(projectId, 'INVALID_PROJECT_ID'),
      name: requireIdentifier(projectName, 'INVALID_PROJECT_NAME'),
    },
  };
}

function requireEnvironmentTarget(value: unknown): string | string[] {
  if (typeof value === 'string') {
    const target = requireString(value, 'INVALID_ENV_TARGET', 64);
    if (!ALLOWED_SCOPES.has(target)) fail('INVALID_ENV_TARGET');
    return target;
  }
  if (!Array.isArray(value) || value.length === 0) fail('INVALID_ENV_TARGET');
  const targets = value
    .map((target) => {
      const normalized = requireString(target, 'INVALID_ENV_TARGET', 64);
      if (!ALLOWED_SCOPES.has(normalized)) fail('INVALID_ENV_TARGET');
      return normalized;
    })
    .sort();
  if (new Set(targets).size !== targets.length) fail('DUPLICATE_ENV_TARGET');
  return targets;
}

function projectEnvironment(input: unknown, scopeValue: unknown): JsonObject {
  const scope = requireString(scopeValue, 'INVALID_ENV_SCOPE', 64);
  if (!ALLOWED_SCOPES.has(scope)) fail('INVALID_ENV_SCOPE');
  const rows = Array.isArray(input)
    ? input
    : requireObject(input, 'INVALID_ENV_INPUT').envs;
  if (!Array.isArray(rows)) fail('INVALID_ENV_ROWS');

  const envs = rows.map((row): JsonObject => {
    const object = requireObject(row, 'INVALID_ENV_ROW');
    const key = requireString(object.key, 'INVALID_ENV_KEY', 256);
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/u.test(key)) fail('INVALID_ENV_KEY');
    const projected: JsonObject = {
      key,
      type: requireIdentifier(object.type, 'INVALID_ENV_TYPE'),
      target: requireEnvironmentTarget(object.target),
    };
    if (object.gitBranch !== undefined && object.gitBranch !== null) {
      projected.gitBranch = requireString(
        object.gitBranch,
        'INVALID_GIT_BRANCH',
        512,
      );
    }
    return projected;
  });

  envs.sort((left, right) =>
    compareText(canonicalJson(left), canonicalJson(right)),
  );
  return { scope, envs };
}

function requireKeyRecord(value: unknown): string {
  const keyRecord = requireString(value, 'INVALID_KEY_RECORD', 128);
  const isDecimalRecordId = /^[0-9]{1,128}$/u.test(keyRecord);
  const isUuidRecordId =
    /^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/iu.test(
      keyRecord,
    );
  const isLabelledRecordId = /^record:[A-Za-z0-9][A-Za-z0-9._:-]{0,119}$/u.test(
    keyRecord,
  );
  const isBareRecordId = /^[A-Za-z][A-Za-z0-9._:-]{4,127}$/u.test(keyRecord);
  const isFinalFour = /^final-four:[ ]?[A-Za-z0-9]{4}$/u.test(keyRecord);
  if (
    (!isDecimalRecordId &&
      !isUuidRecordId &&
      !isLabelledRecordId &&
      !isBareRecordId &&
      !isFinalFour) ||
    CREDENTIAL_PATTERN.test(keyRecord) ||
    SENSITIVE_COMPONENT_PATTERN.test(keyRecord) ||
    looksHighEntropy(keyRecord)
  ) {
    fail('INVALID_KEY_RECORD');
  }
  return keyRecord;
}

function projectOpenRouterRevocation(input: unknown): JsonObject {
  const object = requireObject(input, 'INVALID_REVOCATION_INPUT');
  exactKeys(
    object,
    ['provider', 'keyRecord', 'status', 'revokedAt', 'verifiedAt'],
    'UNKNOWN_REVOCATION_FIELD',
  );
  if (object.provider !== 'OpenRouter') fail('INVALID_REVOCATION_PROVIDER');
  if (object.status !== 'revoked' && object.status !== 'disabled')
    fail('INVALID_REVOCATION_STATUS');
  return {
    provider: 'OpenRouter',
    keyRecord: requireKeyRecord(object.keyRecord),
    status: object.status,
    revokedAt: requireUtcTimestamp(object.revokedAt, 'INVALID_REVOKED_AT'),
    verifiedAt: requireUtcTimestamp(object.verifiedAt, 'INVALID_VERIFIED_AT'),
  };
}

function isApprovedHighEntropyPath(path: string[]): boolean {
  const key = path.at(-1);
  return (
    key === 'id' ||
    key === 'sha' ||
    key === 'gitSha' ||
    key === 'keyRecord' ||
    (key === 'key' && path.includes('envs'))
  );
}

function looksHighEntropy(value: string): boolean {
  const longHexCandidates = value.match(/[A-Fa-f0-9]{48,}/gu) ?? [];
  if (
    longHexCandidates.some(
      (candidate) =>
        /[A-Fa-f]/u.test(candidate) &&
        /[0-9]/u.test(candidate) &&
        new Set(candidate.toLowerCase()).size >= 8,
    )
  ) {
    return true;
  }

  const candidates = value.match(/[A-Za-z0-9+/_=-]{48,}/gu) ?? [];
  return candidates.some((candidate) => {
    if (!/[A-Za-z]/u.test(candidate) || !/[0-9]/u.test(candidate)) return false;
    const counts = new Map<string, number>();
    for (const character of candidate) {
      counts.set(character, (counts.get(character) ?? 0) + 1);
    }
    let entropy = 0;
    for (const count of counts.values()) {
      const probability = count / candidate.length;
      entropy -= probability * Math.log2(probability);
    }
    return entropy >= 4.5;
  });
}

function assertNoSensitiveContent(value: unknown, path: string[] = []): void {
  if (Array.isArray(value)) {
    value.forEach((child, index) =>
      assertNoSensitiveContent(child, [...path, String(index)]),
    );
    return;
  }
  if (isObject(value)) {
    for (const [key, child] of Object.entries(value)) {
      const normalizedKey = key.toLowerCase().replace(/[^a-z0-9]/gu, '');
      if (
        normalizedKey === 'value' ||
        normalizedKey === 'values' ||
        normalizedKey.includes('secret') ||
        normalizedKey.includes('token') ||
        normalizedKey.includes('password') ||
        normalizedKey === 'auth' ||
        normalizedKey.includes('authorization') ||
        normalizedKey.includes('cookie') ||
        normalizedKey.includes('header') ||
        normalizedKey === 'raw' ||
        normalizedKey.includes('buildenv') ||
        normalizedKey.includes('encryptedvalue') ||
        normalizedKey.includes('environmentvalue')
      ) {
        fail('SENSITIVE_PROPERTY_NAME');
      }
      assertNoSensitiveContent(child, [...path, key]);
    }
    return;
  }
  if (typeof value === 'string') {
    if (CREDENTIAL_PATTERN.test(value)) fail('CREDENTIAL_LIKE_VALUE');
    if (looksHighEntropy(value) && !isApprovedHighEntropyPath(path))
      fail('HIGH_ENTROPY_VALUE');
  }
}

function validateInspect(value: unknown): void {
  const object = requireObject(value);
  exactKeys(
    object,
    ['id', 'name', 'url', 'target', 'readyState', 'aliases'],
    'UNKNOWN_INSPECT_FIELD',
  );
  projectInspect(object);
}

function validateDeployment(value: unknown): void {
  const object = requireObject(value);
  exactKeys(
    object,
    ['id', 'url', 'target', 'readyState', 'createdAt', 'gitSource', 'project'],
    'UNKNOWN_DEPLOYMENT_FIELD',
  );
  const gitSource = requireObject(object.gitSource);
  exactKeys(gitSource, ['type', 'ref', 'sha'], 'UNKNOWN_GIT_SOURCE_FIELD');
  const project = requireObject(object.project);
  exactKeys(project, ['id', 'name'], 'UNKNOWN_PROJECT_FIELD');
  projectDeployment(object);
}

function validateEnvironment(value: unknown): void {
  const object = requireObject(value);
  exactKeys(object, ['scope', 'envs'], 'UNKNOWN_ENV_FIELD');
  if (!Array.isArray(object.envs)) fail('INVALID_ENV_ROWS');
  for (const row of object.envs) {
    const env = requireObject(row);
    const keys = Object.keys(env);
    if (
      !keys.every((key) => ['key', 'type', 'target', 'gitBranch'].includes(key))
    ) {
      fail('UNKNOWN_ENV_ROW_FIELD');
    }
    if (!['key', 'type', 'target'].every((key) => keys.includes(key)))
      fail('MISSING_ENV_ROW_FIELD');
  }
  projectEnvironment(object, object.scope);
}

function validateRevocation(value: unknown): void {
  projectOpenRouterRevocation(value);
}

function validateBlobInventory(value: unknown[]): void {
  for (const row of value) {
    const object = requireObject(row, 'INVALID_BLOB_ROW');
    exactKeys(
      object,
      ['pathname', 'url', 'size', 'uploadedAt'],
      'UNKNOWN_BLOB_FIELD',
    );
    const pathname = requireString(object.pathname, 'INVALID_BLOB_PATH', 2_048);
    assertSafeUrlText(pathname);
    if (pathname.startsWith('/') || pathname.includes('..'))
      fail('INVALID_BLOB_PATH');
    requireBlobUrl(object.url);
    if (!Number.isSafeInteger(object.size) || (object.size as number) < 0)
      fail('INVALID_BLOB_SIZE');
    requireUtcTimestamp(object.uploadedAt, 'INVALID_BLOB_UPLOAD_TIME');
  }
}

function validateContainmentResult(value: unknown): void {
  const object = requireObject(value);
  exactKeys(
    object,
    [
      'deployment',
      'routes',
      'blobs',
      'credentialRevoked',
      'environmentNameAbsent',
      'verifiedAt',
    ],
    'UNKNOWN_RESULT_FIELD',
  );
  const deployment = requireObject(object.deployment);
  exactKeys(
    deployment,
    ['id', 'gitSha', 'readyState', 'target'],
    'UNKNOWN_RESULT_DEPLOYMENT_FIELD',
  );
  requireIdentifier(deployment.id, 'INVALID_DEPLOYMENT_ID');
  requireSha(deployment.gitSha);
  requireReadyState(deployment.readyState);
  requireNullableTarget(deployment.target);

  if (!Array.isArray(object.routes)) fail('INVALID_RESULT_ROUTES');
  for (const row of object.routes) {
    const route = requireObject(row);
    const keys = Object.keys(route);
    if (!keys.every((key) => ['path', 'status', 'destination'].includes(key)))
      fail('UNKNOWN_ROUTE_FIELD');
    if (!keys.includes('path') || !keys.includes('status'))
      fail('MISSING_ROUTE_FIELD');
    const path = requireString(route.path, 'INVALID_ROUTE_PATH', 2_048);
    if (!path.startsWith('/') || path.includes('..'))
      fail('INVALID_ROUTE_PATH');
    if (
      !Number.isSafeInteger(route.status) ||
      (route.status as number) < 100 ||
      (route.status as number) > 599
    ) {
      fail('INVALID_ROUTE_STATUS');
    }
    if (route.destination !== undefined)
      requireSiteDestination(route.destination);
  }

  const blobs = requireObject(object.blobs);
  exactKeys(
    blobs,
    ['beforeCount', 'afterCount', 'probes'],
    'UNKNOWN_RESULT_BLOBS_FIELD',
  );
  for (const count of [blobs.beforeCount, blobs.afterCount]) {
    if (!Number.isSafeInteger(count) || (count as number) < 0)
      fail('INVALID_BLOB_COUNT');
  }
  if (!Array.isArray(blobs.probes)) fail('INVALID_BLOB_PROBES');
  for (const row of blobs.probes) {
    const probe = requireObject(row);
    exactKeys(probe, ['pathname', 'status'], 'UNKNOWN_BLOB_PROBE_FIELD');
    const pathname = requireString(probe.pathname, 'INVALID_BLOB_PATH', 2_048);
    assertSafeUrlText(pathname);
    if (
      !Number.isSafeInteger(probe.status) ||
      (probe.status as number) < 100 ||
      (probe.status as number) > 599
    ) {
      fail('INVALID_BLOB_STATUS');
    }
  }

  if (object.credentialRevoked !== true)
    fail('INVALID_CREDENTIAL_REVOCATION_RESULT');
  const absence = requireObject(object.environmentNameAbsent);
  exactKeys(
    absence,
    ['production', 'preview', 'development'],
    'UNKNOWN_ENV_ABSENCE_FIELD',
  );
  if (!Object.values(absence).every((entry) => typeof entry === 'boolean'))
    fail('INVALID_ENV_ABSENCE_RESULT');
  requireUtcTimestamp(object.verifiedAt, 'INVALID_VERIFIED_AT');
}

export function assertSafeBlobInventory(
  value: unknown,
): asserts value is SafeBlobInventoryEntry[] {
  assertNoSensitiveContent(value);
  if (!Array.isArray(value)) fail('INVALID_BLOB_INVENTORY');
  validateBlobInventory(value);
}

export function assertSafeEvidence(value: unknown): void {
  if (Array.isArray(value)) {
    assertSafeBlobInventory(value);
    return;
  }
  assertNoSensitiveContent(value);
  const object = requireObject(value);
  if ('aliases' in object) {
    validateInspect(object);
  } else if ('gitSource' in object && 'project' in object) {
    validateDeployment(object);
  } else if ('scope' in object && 'envs' in object) {
    validateEnvironment(object);
  } else if (object.provider === 'OpenRouter') {
    validateRevocation(object);
  } else if (
    'deployment' in object &&
    'routes' in object &&
    'blobs' in object
  ) {
    validateContainmentResult(object);
  } else {
    fail('UNKNOWN_EVIDENCE_SCHEMA');
  }
}

function parseArguments(arguments_: string[]): {
  mode: string;
  options: Map<string, string>;
} {
  const [mode, ...optionArguments] = arguments_;
  if (!mode || (!SANITIZING_MODES.has(mode) && mode !== 'verify-safe'))
    fail('INVALID_MODE');
  const options = new Map<string, string>();
  for (const argument of optionArguments) {
    const match = /^--([a-z-]+)=(.+)$/u.exec(argument);
    if (!match || options.has(match[1])) fail('INVALID_ARGUMENT');
    options.set(match[1], match[2]);
  }
  const allowed =
    mode === 'sanitize-env'
      ? new Set(['input', 'output', 'scope'])
      : mode === 'verify-safe'
        ? new Set(['input'])
        : new Set(['input', 'output']);
  if ([...options.keys()].some((key) => !allowed.has(key)))
    fail('INVALID_ARGUMENT');
  if (!options.has('input')) fail('MISSING_INPUT');
  if (SANITIZING_MODES.has(mode) && !options.has('output'))
    fail('MISSING_OUTPUT');
  if (mode === 'sanitize-env' && !options.has('scope')) fail('MISSING_SCOPE');
  return { mode, options };
}

function readJson(path: string): unknown {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    fail('INVALID_JSON_INPUT');
  }
}

function writeCanonical(path: string, value: unknown): void {
  const absolutePath = resolve(path);
  mkdirSync(dirname(absolutePath), { recursive: true });
  const temporaryPath = `${absolutePath}.tmp-${process.pid}`;
  rmSync(temporaryPath, { force: true });
  try {
    writeFileSync(temporaryPath, canonicalJson(value), {
      flag: 'wx',
      mode: 0o600,
    });
    renameSync(temporaryPath, absolutePath);
  } finally {
    rmSync(temporaryPath, { force: true });
  }
}

function main(): void {
  try {
    const { mode, options } = parseArguments(process.argv.slice(2));
    const input = readJson(options.get('input')!);
    if (mode === 'verify-safe') {
      assertSafeEvidence(input);
      return;
    }

    let projected: JsonObject;
    switch (mode) {
      case 'sanitize-inspect':
        projected = projectInspect(input);
        break;
      case 'sanitize-deployment':
        projected = projectDeployment(input);
        break;
      case 'sanitize-env':
        projected = projectEnvironment(input, options.get('scope'));
        break;
      case 'sanitize-openrouter-revocation':
        projected = projectOpenRouterRevocation(input);
        break;
      default:
        fail('INVALID_MODE');
    }
    assertSafeEvidence(projected);
    writeCanonical(options.get('output')!, projected);
  } catch (error) {
    const rule =
      error instanceof EvidenceError ? error.rule : 'UNEXPECTED_ERROR';
    process.stderr.write(`Evidence sanitizer failed: ${rule}\n`);
    process.exitCode = 1;
  }
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  main();
}
