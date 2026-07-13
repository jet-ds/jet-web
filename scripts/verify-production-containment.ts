import { existsSync, linkSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { KNOWN_CHATBOT_PATHNAMES, type BlobEvidenceEntry } from './contain-chatbot-blobs';
import {
  assertSafeBlobInventory,
  assertSafeEvidence,
  canonicalEvidenceJson,
} from './sanitize-vercel-evidence';

const RESULT_PATH = 'docs/verification/containment/result.json';
const REQUIRED_SCOPES = ['production', 'preview', 'development'] as const;

type JsonObject = Record<string, unknown>;

type ContainmentResponse = {
  status: number;
  headers: { get(name: string): string | null };
};

type EnvironmentScope = typeof REQUIRED_SCOPES[number];

export type ProductionContainmentDependencies = {
  resultExists(path: string): boolean;
  readFile(path: string): string;
  writeResult(path: string, contents: string): void;
  fetch(url: string, init?: RequestInit): Promise<ContainmentResponse>;
  now(): Date;
};

export type ProductionContainmentResult = {
  deployment: {
    id: string;
    gitSha: string;
    readyState: string;
    target: string;
  };
  routes: Array<{
    path: string;
    status: number;
    destination?: string;
  }>;
  blobs: {
    beforeCount: number;
    afterCount: number;
    probes: Array<{ pathname: string; status: number }>;
  };
  credentialRevoked: true;
  environmentNameAbsent: Record<EnvironmentScope, boolean>;
  verifiedAt: string;
};

class ProductionContainmentError extends Error {
  constructor(readonly rule: string) {
    super(rule);
  }
}

function fail(rule: string): never {
  throw new ProductionContainmentError(rule);
}

function isObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function compareText(left: string, right: string): number {
  if (left === right) return 0;
  return left < right ? -1 : 1;
}

function parseArguments(arguments_: string[]): {
  origin: string;
  expectedCommit: string;
  deployment: string;
  revocation: string;
  blobBefore: string;
  blobAfter: string;
  environments: string[];
  output: string;
} {
  const singular = new Map<string, string>();
  const environments: string[] = [];
  const required = new Set([
    'origin',
    'expected-commit',
    'deployment',
    'revocation',
    'blob-before',
    'blob-after',
  ]);
  const allowed = new Set([...required, 'output']);

  for (const argument of arguments_) {
    const match = /^--([a-z-]+)=(.+)$/u.exec(argument);
    if (!match) fail('INVALID_ARGUMENT');
    const [, key, value] = match;
    if (key === 'env') {
      environments.push(value);
    } else if (!allowed.has(key) || singular.has(key)) {
      fail('INVALID_ARGUMENT');
    } else {
      singular.set(key, value);
    }
  }

  for (const key of required) {
    if (!singular.has(key)) fail(`MISSING_${key.toUpperCase().replaceAll('-', '_')}`);
  }
  if (environments.length !== REQUIRED_SCOPES.length) fail('INVALID_ENVIRONMENT_EVIDENCE_COUNT');

  const origin = requireOrigin(singular.get('origin')!);
  const expectedCommit = singular.get('expected-commit')!;
  if (!/^[a-f0-9]{40}$/u.test(expectedCommit)) fail('INVALID_EXPECTED_COMMIT');
  return {
    origin,
    expectedCommit,
    deployment: singular.get('deployment')!,
    revocation: singular.get('revocation')!,
    blobBefore: singular.get('blob-before')!,
    blobAfter: singular.get('blob-after')!,
    environments,
    output: singular.get('output') ?? RESULT_PATH,
  };
}

function requireOrigin(value: string): string {
  let origin: URL;
  try {
    origin = new URL(value);
  } catch {
    fail('INVALID_ORIGIN');
  }
  if (
    origin.protocol !== 'https:'
    || origin.username !== ''
    || origin.password !== ''
    || origin.port !== ''
    || origin.pathname !== '/'
    || origin.search !== ''
    || origin.hash !== ''
    || origin.origin !== 'https://jetsanchez.com'
  ) {
    fail('INVALID_ORIGIN');
  }
  return origin.origin;
}

function readJson(path: string, dependencies: ProductionContainmentDependencies): unknown {
  try {
    return JSON.parse(dependencies.readFile(path)) as unknown;
  } catch {
    fail('INVALID_EVIDENCE_JSON');
  }
}

function assertDeployment(value: unknown, expectedCommit: string): ProductionContainmentResult['deployment'] {
  if (!isObject(value) || !isObject(value.gitSource)) fail('INVALID_DEPLOYMENT_EVIDENCE');
  if (typeof value.id !== 'string' || value.id.length === 0) fail('INVALID_DEPLOYMENT_EVIDENCE');
  if (value.readyState !== 'READY') fail('DEPLOYMENT_NOT_READY');
  if (value.target !== 'production') fail('DEPLOYMENT_NOT_PRODUCTION');
  if (value.gitSource.sha !== expectedCommit) fail('DEPLOYMENT_SHA_MISMATCH');
  return {
    id: value.id,
    gitSha: expectedCommit,
    readyState: 'READY',
    target: 'production',
  };
}

function assertCredentialRevoked(value: unknown): void {
  if (
    !isObject(value)
    || value.provider !== 'OpenRouter'
    || !['revoked', 'disabled'].includes(String(value.status))
  ) {
    fail('CREDENTIAL_NOT_REVOKED');
  }
}

function assertEnvironmentEvidence(
  values: unknown[],
): Record<EnvironmentScope, boolean> {
  const result = {
    production: false,
    preview: false,
    development: false,
  };
  const seen = new Set<EnvironmentScope>();

  for (const value of values) {
    if (!isObject(value) || !REQUIRED_SCOPES.includes(value.scope as EnvironmentScope)) {
      fail('INVALID_ENVIRONMENT_SCOPE');
    }
    const scope = value.scope as EnvironmentScope;
    if (seen.has(scope)) fail('ENVIRONMENT_SCOPE_DUPLICATE');
    seen.add(scope);
    if (!Array.isArray(value.envs)) fail('INVALID_ENVIRONMENT_EVIDENCE');
    for (const row of value.envs) {
      if (!isObject(row) || typeof row.key !== 'string') fail('INVALID_ENVIRONMENT_EVIDENCE');
      if (row.key === 'OPENROUTER_API_KEY') fail('CREDENTIAL_NAME_PRESENT');
    }
    result[scope] = true;
  }
  if (seen.size !== REQUIRED_SCOPES.length) fail('ENVIRONMENT_SCOPE_MISSING');
  return result;
}

function assertBlobInventory(value: unknown, label: 'before' | 'after'): BlobEvidenceEntry[] {
  try {
    assertSafeBlobInventory(value);
  } catch {
    fail('UNSAFE_BLOB_INVENTORY');
  }
  const entries = value.map((row) => {
    const url = new URL(row.url);
    let decodedPathname: string;
    try {
      decodedPathname = decodeURIComponent(url.pathname.slice(1));
    } catch {
      fail('INVALID_BLOB_INVENTORY');
    }
    if (
      !row.pathname.startsWith('chatbot/')
      || row.pathname.includes('..')
      || decodedPathname !== row.pathname
    ) {
      fail('INVALID_BLOB_INVENTORY');
    }
    return {
      pathname: row.pathname,
      url: url.toString(),
      size: row.size as number,
      uploadedAt: new Date(row.uploadedAt).toISOString(),
    };
  });
  entries.sort((left, right) => compareText(left.pathname, right.pathname));
  if (new Set(entries.map((entry) => entry.pathname)).size !== entries.length) {
    fail('DUPLICATE_BLOB_PATHNAME');
  }
  if (label === 'after' && entries.length !== 0) fail('BLOB_AFTER_NOT_EMPTY');
  if (label === 'before') {
    const pathnames = new Set(entries.map((entry) => entry.pathname));
    if (KNOWN_CHATBOT_PATHNAMES.some((pathname) => !pathnames.has(pathname))) {
      fail('KNOWN_CHATBOT_BLOB_MISSING');
    }
  }
  return entries;
}

function cacheBustedUrl(url: string, timestamp: number, index: number): string {
  const parsed = new URL(url);
  parsed.searchParams.set('containment', `${timestamp}-${index}`);
  return parsed.toString();
}

function resolveRedirect(origin: string, location: string | null, rule: string): string {
  if (!location) fail(rule);
  try {
    return new URL(location, `${origin}/`).toString();
  } catch {
    fail(rule);
  }
}

export async function verifyProductionContainment(
  arguments_: string[],
  dependencies: ProductionContainmentDependencies,
): Promise<ProductionContainmentResult> {
  const options = parseArguments(arguments_);
  if (dependencies.resultExists(options.output)) fail('RESULT_ALREADY_EXISTS');
  const deployment = assertDeployment(
    readJson(options.deployment, dependencies),
    options.expectedCommit,
  );
  assertCredentialRevoked(readJson(options.revocation, dependencies));
  const environmentNameAbsent = assertEnvironmentEvidence(
    options.environments.map((path) => readJson(path, dependencies)),
  );
  const before = assertBlobInventory(readJson(options.blobBefore, dependencies), 'before');
  const after = assertBlobInventory(readJson(options.blobAfter, dependencies), 'after');

  const apiRedirectResponse = await dependencies.fetch(
    new URL('/api/chat', `${options.origin}/`).toString(),
    { method: 'POST', redirect: 'manual', cache: 'no-store' },
  );
  if (apiRedirectResponse.status !== 308) fail('CHAT_API_REDIRECT_STATUS_NOT_308');
  const apiRedirectDestination = resolveRedirect(
    options.origin,
    apiRedirectResponse.headers.get('location'),
    'CHAT_API_REDIRECT_DESTINATION_MISMATCH',
  );
  const expectedApiDestination = new URL('/api/chat/', `${options.origin}/`).toString();
  if (apiRedirectDestination !== expectedApiDestination) {
    fail('CHAT_API_REDIRECT_DESTINATION_MISMATCH');
  }

  const apiTerminalResponse = await dependencies.fetch(
    apiRedirectDestination,
    { method: 'POST', redirect: 'manual', cache: 'no-store' },
  );
  if (apiTerminalResponse.status !== 404) fail('CHAT_API_TERMINAL_STATUS_NOT_404');
  if (apiTerminalResponse.headers.get('location') !== null) {
    fail('CHAT_API_TERMINAL_REDIRECT_PRESENT');
  }

  const chatbotSlashlessResponse = await dependencies.fetch(
    new URL('/chatbot', `${options.origin}/`).toString(),
    { method: 'GET', redirect: 'manual', cache: 'no-store' },
  );
  if (chatbotSlashlessResponse.status !== 308) fail('CHATBOT_SLASHLESS_STATUS_NOT_308');
  const chatbotSlashlessDestination = resolveRedirect(
    options.origin,
    chatbotSlashlessResponse.headers.get('location'),
    'CHATBOT_SLASHLESS_DESTINATION_MISMATCH',
  );
  const expectedChatbotSlashlessDestination = new URL(
    '/chatbot/',
    `${options.origin}/`,
  ).toString();
  if (chatbotSlashlessDestination !== expectedChatbotSlashlessDestination) {
    fail('CHATBOT_SLASHLESS_DESTINATION_MISMATCH');
  }

  const chatbotSlashfulResponse = await dependencies.fetch(
    chatbotSlashlessDestination,
    { method: 'GET', redirect: 'manual', cache: 'no-store' },
  );
  if (chatbotSlashfulResponse.status !== 308) fail('CHATBOT_SLASHFUL_STATUS_NOT_308');
  const chatbotSlashfulDestination = resolveRedirect(
    options.origin,
    chatbotSlashfulResponse.headers.get('location'),
    'CHATBOT_SLASHFUL_DESTINATION_MISMATCH',
  );
  const expectedChatbotSlashfulDestination = new URL(
    '/tools/chatbot/',
    `${options.origin}/`,
  ).toString();
  if (chatbotSlashfulDestination !== expectedChatbotSlashfulDestination) {
    fail('CHATBOT_SLASHFUL_DESTINATION_MISMATCH');
  }

  const chatbotTerminalResponse = await dependencies.fetch(
    chatbotSlashfulDestination,
    { method: 'GET', redirect: 'manual', cache: 'no-store' },
  );
  if (chatbotTerminalResponse.status !== 200) fail('CHATBOT_TERMINAL_STATUS_NOT_200');
  if (chatbotTerminalResponse.headers.get('location') !== null) {
    fail('CHATBOT_TERMINAL_REDIRECT_PRESENT');
  }

  const timestamp = dependencies.now().getTime();
  if (!Number.isFinite(timestamp)) fail('INVALID_TIME');
  const probes: Array<{ pathname: string; status: number }> = [];
  for (const [index, entry] of before.entries()) {
    const response = await dependencies.fetch(
      cacheBustedUrl(entry.url, timestamp, index),
      { method: 'GET', redirect: 'manual', cache: 'no-store' },
    );
    probes.push({ pathname: entry.pathname, status: response.status });
    if (response.status !== 404) fail('BLOB_PROBE_NOT_404');
  }

  const now = dependencies.now();
  if (Number.isNaN(now.getTime())) fail('INVALID_TIME');
  const result: ProductionContainmentResult = {
    deployment,
    routes: [
      {
        path: '/api/chat',
        status: apiRedirectResponse.status,
        destination: apiRedirectDestination,
      },
      { path: '/api/chat/', status: apiTerminalResponse.status },
      {
        path: '/chatbot',
        status: chatbotSlashlessResponse.status,
        destination: chatbotSlashlessDestination,
      },
      {
        path: '/chatbot/',
        status: chatbotSlashfulResponse.status,
        destination: chatbotSlashfulDestination,
      },
      { path: '/tools/chatbot/', status: chatbotTerminalResponse.status },
    ],
    blobs: {
      beforeCount: before.length,
      afterCount: after.length,
      probes,
    },
    credentialRevoked: true,
    environmentNameAbsent,
    verifiedAt: now.toISOString(),
  };
  try {
    assertSafeEvidence(result);
  } catch {
    fail('UNSAFE_CONTAINMENT_RESULT');
  }
  dependencies.writeResult(options.output, canonicalEvidenceJson(result));
  return result;
}

function writeResultFresh(path: string, contents: string): void {
  const absolutePath = resolve(path);
  mkdirSync(dirname(absolutePath), { recursive: true });
  const temporaryPath = `${absolutePath}.tmp-${process.pid}`;
  rmSync(temporaryPath, { force: true });
  try {
    writeFileSync(temporaryPath, contents, { flag: 'wx', mode: 0o600 });
    linkSync(temporaryPath, absolutePath);
  } finally {
    rmSync(temporaryPath, { force: true });
  }
}

const defaultDependencies: ProductionContainmentDependencies = {
  resultExists: existsSync,
  readFile: (path) => readFileSync(path, 'utf8'),
  writeResult: writeResultFresh,
  fetch: async (url, init) => fetch(url, init),
  now: () => new Date(),
};

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  verifyProductionContainment(process.argv.slice(2), defaultDependencies).catch((error: unknown) => {
    const rule = error instanceof ProductionContainmentError ? error.rule : 'UNEXPECTED_ERROR';
    process.stderr.write(`Production containment verification failed: ${rule}\n`);
    process.exitCode = 1;
  });
}
