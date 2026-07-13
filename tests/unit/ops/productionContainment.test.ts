import { beforeEach, describe, expect, it } from 'vitest';
import { KNOWN_CHATBOT_PATHNAMES } from '../../../scripts/contain-chatbot-blobs';
import { canonicalEvidenceJson } from '../../../scripts/sanitize-vercel-evidence';
import {
  verifyProductionContainment,
  type ProductionContainmentDependencies,
} from '../../../scripts/verify-production-containment';

const expectedCommit = 'c0d158c2f1ba73c879890fd2a8269f633d1f2d04';
const blobOrigin = 'https://vyge4wbmw8jgd8rh.public.blob.vercel-storage.com';
const resultPath = 'docs/verification/containment/result.json';
const paths = {
  deployment: 'deployment.json',
  revocation: 'revocation.json',
  before: 'blob-before.json',
  after: 'blob-after.json',
  production: 'env-production.json',
  preview: 'env-preview.json',
  development: 'env-development.json',
};

function argumentsForFixture(origin = 'https://jetsanchez.com'): string[] {
  return [
    `--origin=${origin}`,
    `--expected-commit=${expectedCommit}`,
    `--deployment=${paths.deployment}`,
    `--revocation=${paths.revocation}`,
    `--blob-before=${paths.before}`,
    `--blob-after=${paths.after}`,
    `--env=${paths.production}`,
    `--env=${paths.preview}`,
    `--env=${paths.development}`,
  ];
}

function blob(pathname: string) {
  return {
    pathname,
    url: `${blobOrigin}/${pathname}`,
    size: 100,
    uploadedAt: '2026-07-11T07:00:00.000Z',
  };
}

type Fixture = {
  files: Map<string, unknown>;
  routeStatuses: {
    apiRedirect: number;
    apiDestination: string | null;
    apiTerminal: number;
    apiTerminalDestination: string | null;
    redirect: number;
    destination: string | null;
    blob: number;
  };
  writes: Map<string, string>;
  reads: string[];
  fetches: Array<{ url: string; init: RequestInit | undefined }>;
  resultState: { exists: boolean };
  dependencies: ProductionContainmentDependencies;
};

function makeFixture(): Fixture {
  const files = new Map<string, unknown>([
    [paths.deployment, {
      id: 'dpl_approved123',
      readyState: 'READY',
      target: 'production',
      gitSource: { sha: expectedCommit },
    }],
    [paths.revocation, {
      provider: 'OpenRouter',
      keyRecord: 'record:11581522',
      status: 'disabled',
      revokedAt: '2026-07-11T07:00:00.000Z',
      verifiedAt: '2026-07-13T03:00:00.000Z',
    }],
    [paths.before, KNOWN_CHATBOT_PATHNAMES.map(blob)],
    [paths.after, []],
    [paths.production, { scope: 'production', envs: [{ key: 'PUBLIC_SITE_ORIGIN' }] }],
    [paths.preview, { scope: 'preview', envs: [] }],
    [paths.development, { scope: 'development', envs: [] }],
  ]);
  const routeStatuses = {
    apiRedirect: 308,
    apiDestination: '/api/chat/',
    apiTerminal: 404,
    apiTerminalDestination: null,
    redirect: 308,
    destination: '/tools/chatbot/',
    blob: 404,
  };
  const writes = new Map<string, string>();
  const reads: string[] = [];
  const fetches: Array<{ url: string; init: RequestInit | undefined }> = [];
  const resultState = { exists: false };
  const dependencies = {
    resultExists(path: string) {
      expect(path).toBe(resultPath);
      return resultState.exists;
    },
    readFile(path) {
      reads.push(path);
      if (!files.has(path)) throw new Error('TEST_FILE_NOT_FOUND');
      return `${JSON.stringify(files.get(path))}\n`;
    },
    writeResult(path, contents) {
      writes.set(path, contents);
    },
    async fetch(url, init) {
      fetches.push({ url, init });
      const parsed = new URL(url);
      if (parsed.hostname === 'jetsanchez.com' && parsed.pathname === '/api/chat') {
        return {
          status: routeStatuses.apiRedirect,
          headers: {
            get: (name) => name.toLowerCase() === 'location' ? routeStatuses.apiDestination : null,
          },
        };
      }
      if (parsed.hostname === 'jetsanchez.com' && parsed.pathname === '/api/chat/') {
        return {
          status: routeStatuses.apiTerminal,
          headers: {
            get: (name) => (
              name.toLowerCase() === 'location' ? routeStatuses.apiTerminalDestination : null
            ),
          },
        };
      }
      if (parsed.hostname === 'jetsanchez.com' && parsed.pathname === '/chatbot') {
        return {
          status: routeStatuses.redirect,
          headers: { get: (name) => name.toLowerCase() === 'location' ? routeStatuses.destination : null },
        };
      }
      return { status: routeStatuses.blob, headers: { get: () => null } };
    },
    now: () => new Date('2026-07-13T04:05:06.789Z'),
  } as ProductionContainmentDependencies;
  return { files, routeStatuses, writes, reads, fetches, resultState, dependencies };
}

let fixture: Fixture;

beforeEach(() => {
  fixture = makeFixture();
});

describe('production containment verification', () => {
  it('asserts routes, deployment, revocation, environments, and Blob probes', async () => {
    const result = await verifyProductionContainment(argumentsForFixture(), fixture.dependencies);

    expect(result).toEqual({
      deployment: {
        id: 'dpl_approved123',
        gitSha: expectedCommit,
        readyState: 'READY',
        target: 'production',
      },
      routes: [
        {
          path: '/api/chat',
          status: 308,
          destination: 'https://jetsanchez.com/api/chat/',
        },
        { path: '/api/chat/', status: 404 },
        {
          path: '/chatbot',
          status: 308,
          destination: 'https://jetsanchez.com/tools/chatbot/',
        },
      ],
      blobs: {
        beforeCount: 3,
        afterCount: 0,
        probes: KNOWN_CHATBOT_PATHNAMES.map((pathname) => ({ pathname, status: 404 })),
      },
      credentialRevoked: true,
      environmentNameAbsent: {
        production: true,
        preview: true,
        development: true,
      },
      verifiedAt: '2026-07-13T04:05:06.789Z',
    });
    expect(fixture.writes.get('docs/verification/containment/result.json'))
      .toBe(canonicalEvidenceJson(result));

    const apiRedirectRequest = fixture.fetches.find(
      ({ url }) => new URL(url).pathname === '/api/chat',
    );
    const apiTerminalRequest = fixture.fetches.find(
      ({ url }) => new URL(url).pathname === '/api/chat/',
    );
    const redirectRequest = fixture.fetches.find(({ url }) => new URL(url).pathname === '/chatbot');
    expect(apiRedirectRequest?.init)
      .toMatchObject({ method: 'POST', redirect: 'manual', cache: 'no-store' });
    expect(apiTerminalRequest?.init)
      .toMatchObject({ method: 'POST', redirect: 'manual', cache: 'no-store' });
    expect(redirectRequest?.init).toMatchObject({ method: 'GET', redirect: 'manual', cache: 'no-store' });
    const blobRequests = fixture.fetches.filter(({ url }) => new URL(url).hostname === new URL(blobOrigin).hostname);
    expect(blobRequests).toHaveLength(3);
    expect(blobRequests.every(({ url }) => (
      /^1783915506789-\d+$/u.test(new URL(url).searchParams.get('containment') ?? '')
    ))).toBe(true);
  });

  it.each([
    'https://www.jetsanchez.com',
    'https://review-invalid.example',
    'https://jetsanchez.com/path',
    'https://jetsanchez.com?preview=true',
    'https://jetsanchez.com#fragment',
  ])('rejects non-canonical origin before any evidence read or fetch: %s', async (origin) => {
    await expect(verifyProductionContainment(
      argumentsForFixture(origin),
      fixture.dependencies,
    )).rejects.toThrow('INVALID_ORIGIN');
    expect(fixture.reads).toEqual([]);
    expect(fixture.fetches).toEqual([]);
    expect(fixture.writes.size).toBe(0);
  });

  it('refuses a pre-existing result before evidence reads or fetches and preserves it', async () => {
    const sentinel = '{"stale":"preserve"}\n';
    fixture.resultState.exists = true;
    fixture.writes.set(resultPath, sentinel);

    await expect(verifyProductionContainment(argumentsForFixture(), fixture.dependencies))
      .rejects.toThrow('RESULT_ALREADY_EXISTS');

    expect(fixture.reads).toEqual([]);
    expect(fixture.fetches).toEqual([]);
    expect(fixture.writes.get(resultPath)).toBe(sentinel);
  });

  it('rejects unsafe preserved before evidence before fetch or result output', async () => {
    fixture.files.set(paths.before, [
      ...KNOWN_CHATBOT_PATHNAMES.map(blob),
      blob('chatbot/token=review-canary.json'),
    ]);

    await expect(verifyProductionContainment(argumentsForFixture(), fixture.dependencies))
      .rejects.toThrow();
    expect(fixture.fetches).toEqual([]);
    expect(fixture.writes.size).toBe(0);
  });

  it('fails when slashless POST /api/chat is not exactly 308', async () => {
    fixture.routeStatuses.apiRedirect = 404;
    await expect(verifyProductionContainment(argumentsForFixture(), fixture.dependencies))
      .rejects.toThrow('CHAT_API_REDIRECT_STATUS_NOT_308');
  });

  it('fails when slashless POST /api/chat does not resolve to /api/chat/', async () => {
    fixture.routeStatuses.apiDestination = '/api/chat-v2/';
    await expect(verifyProductionContainment(argumentsForFixture(), fixture.dependencies))
      .rejects.toThrow('CHAT_API_REDIRECT_DESTINATION_MISMATCH');
  });

  it('fails when terminal POST /api/chat/ is not exactly 404', async () => {
    fixture.routeStatuses.apiTerminal = 410;
    await expect(verifyProductionContainment(argumentsForFixture(), fixture.dependencies))
      .rejects.toThrow('CHAT_API_TERMINAL_STATUS_NOT_404');
  });

  it('fails when terminal POST /api/chat/ redirects again', async () => {
    fixture.routeStatuses.apiTerminalDestination = '/api/chat//';
    await expect(verifyProductionContainment(argumentsForFixture(), fixture.dependencies))
      .rejects.toThrow('CHAT_API_TERMINAL_REDIRECT_PRESENT');
  });

  it('fails when /chatbot is not exactly 308', async () => {
    fixture.routeStatuses.redirect = 301;
    await expect(verifyProductionContainment(argumentsForFixture(), fixture.dependencies))
      .rejects.toThrow('CHATBOT_REDIRECT_STATUS_NOT_308');
  });

  it('fails when /chatbot does not resolve to the exact interim destination', async () => {
    fixture.routeStatuses.destination = '/chatbot';
    await expect(verifyProductionContainment(argumentsForFixture(), fixture.dependencies))
      .rejects.toThrow('CHATBOT_REDIRECT_DESTINATION_MISMATCH');
  });

  it.each([
    ['ready state', { readyState: 'BUILDING' }, 'DEPLOYMENT_NOT_READY'],
    ['target', { target: 'preview' }, 'DEPLOYMENT_NOT_PRODUCTION'],
    ['Git SHA', { gitSource: { sha: 'a'.repeat(40) } }, 'DEPLOYMENT_SHA_MISMATCH'],
  ])('fails the deployment %s assertion', async (_label, patch, error) => {
    fixture.files.set(paths.deployment, {
      ...(fixture.files.get(paths.deployment) as Record<string, unknown>),
      ...patch,
    });
    await expect(verifyProductionContainment(argumentsForFixture(), fixture.dependencies))
      .rejects.toThrow(error);
  });

  it('fails unless the OpenRouter key record remains revoked or disabled', async () => {
    fixture.files.set(paths.revocation, {
      ...(fixture.files.get(paths.revocation) as Record<string, unknown>),
      status: 'active',
    });
    await expect(verifyProductionContainment(argumentsForFixture(), fixture.dependencies))
      .rejects.toThrow('CREDENTIAL_NOT_REVOKED');
  });

  it.each(['production', 'preview', 'development']) (
    'fails when OPENROUTER_API_KEY is present in %s evidence',
    async (scope) => {
      fixture.files.set(`env-${scope}.json`, {
        scope,
        envs: [{ key: 'OPENROUTER_API_KEY' }],
      });
      await expect(verifyProductionContainment(argumentsForFixture(), fixture.dependencies))
        .rejects.toThrow('CREDENTIAL_NAME_PRESENT');
    },
  );

  it('fails when one required environment scope is missing', async () => {
    fixture.files.set(paths.development, { scope: 'preview', envs: [] });
    await expect(verifyProductionContainment(argumentsForFixture(), fixture.dependencies))
      .rejects.toThrow('ENVIRONMENT_SCOPE_DUPLICATE');
  });

  it('fails unless the after-inventory is exactly empty', async () => {
    fixture.files.set(paths.after, [blob('chatbot/still-present.json')]);
    await expect(verifyProductionContainment(argumentsForFixture(), fixture.dependencies))
      .rejects.toThrow('BLOB_AFTER_NOT_EMPTY');
  });

  it('fails unless every known draft-bearing Blob is in the before-inventory', async () => {
    fixture.files.set(paths.before, KNOWN_CHATBOT_PATHNAMES.slice(1).map(blob));
    await expect(verifyProductionContainment(argumentsForFixture(), fixture.dependencies))
      .rejects.toThrow('KNOWN_CHATBOT_BLOB_MISSING');
  });

  it('fails unless every cache-busted Blob probe is exactly 404', async () => {
    fixture.routeStatuses.blob = 410;
    await expect(verifyProductionContainment(argumentsForFixture(), fixture.dependencies))
      .rejects.toThrow('BLOB_PROBE_NOT_404');
  });

  it('does not write a result after any failed assertion', async () => {
    fixture.routeStatuses.apiRedirect = 500;
    await expect(verifyProductionContainment(argumentsForFixture(), fixture.dependencies))
      .rejects.toThrow('CHAT_API_REDIRECT_STATUS_NOT_308');
    expect(fixture.writes.size).toBe(0);
  });
});
