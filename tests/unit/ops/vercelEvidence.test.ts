import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

const projectRoot = resolve(import.meta.dirname, '../../..');
const tsx = resolve(projectRoot, 'node_modules/tsx/dist/cli.mjs');
const sanitizer = resolve(projectRoot, 'scripts/sanitize-vercel-evidence.ts');
const temporaryDirectories: string[] = [];
const credentialCanary = ['sk', 'or', 'v1', 'A'.repeat(40)].join('-');
const entropyCanary = Buffer.from(
  Array.from({ length: 96 }, (_value, index) => (index * 37 + 11) % 251),
).toString('base64');
const hexEntropyCanary = createHash('sha256')
  .update('synthetic long hexadecimal review canary')
  .digest('hex');
const encodedHexEntropyCanary = hexEntropyCanary
  .split('')
  .map((character, index) =>
    index % 8 === 0 ? `%${character.charCodeAt(0).toString(16)}` : character,
  )
  .join('');

type CliResult = ReturnType<typeof spawnSync>;

function temporaryDirectory(): string {
  const directory = mkdtempSync(resolve(tmpdir(), 'vercel-evidence-test-'));
  temporaryDirectories.push(directory);
  return directory;
}

function runCli(
  mode: string,
  input: unknown,
  extraArguments: string[] = [],
  includeOutput = mode !== 'verify-safe',
): {
  result: CliResult;
  outputPath: string;
} {
  const directory = temporaryDirectory();
  const inputPath = resolve(directory, 'input.json');
  const outputPath = resolve(directory, 'output.json');
  writeFileSync(inputPath, `${JSON.stringify(input)}\n`, { mode: 0o600 });

  const arguments_ = [tsx, sanitizer, mode, `--input=${inputPath}`];
  if (includeOutput) arguments_.push(`--output=${outputPath}`);
  arguments_.push(...extraArguments);

  const result = spawnSync(process.execPath, arguments_, {
    cwd: projectRoot,
    encoding: 'utf8',
  });

  return { result, outputPath };
}

function expectSuccess(result: CliResult): void {
  expect(result.status, 'sanitizer command failed').toBe(0);
  expect(result.stdout).toBe('');
  expect(result.stderr).toBe('');
}

function expectRejected(result: CliResult): void {
  expect(result.status, 'unsafe evidence was accepted').not.toBe(0);
  expect(result.stdout).toBe('');
  expect(result.stderr).not.toContain(credentialCanary);
}

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, 'utf8'));
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe('Vercel evidence sanitizer', () => {
  it('is import-safe for shared in-memory validation', () => {
    const result = spawnSync(
      process.execPath,
      [
        tsx,
        '--eval',
        `import(${JSON.stringify(sanitizer)}).catch((error) => { console.error(error); process.exitCode = 1; })`,
      ],
      { cwd: projectRoot, encoding: 'utf8' },
    );

    expect(result.status).toBe(0);
    expect(result.stdout).toBe('');
    expect(result.stderr).toBe('');
  });

  it('projects inspect evidence from approved fields and sorts aliases', () => {
    const { result, outputPath } = runCli('sanitize-inspect', {
      id: 'dpl_approved123',
      name: 'jet-web',
      url: 'jet-web-abc.vercel.app',
      target: 'production',
      readyState: 'READY',
      aliases: ['www.jetsanchez.com', 'jetsanchez.com'],
      buildEnv: { OPENROUTER_API_KEY: credentialCanary },
      headers: { authorization: `Bearer ${credentialCanary}` },
      nested: { value: credentialCanary, encryptedValue: credentialCanary },
    });

    expectSuccess(result);
    expect(readJson(outputPath)).toEqual({
      aliases: ['jetsanchez.com', 'www.jetsanchez.com'],
      id: 'dpl_approved123',
      name: 'jet-web',
      readyState: 'READY',
      target: 'production',
      url: 'jet-web-abc.vercel.app',
    });
    expect(readFileSync(outputPath, 'utf8')).not.toContain(credentialCanary);
  });

  it('projects deployment evidence without provider-only or sensitive fields', () => {
    const { result, outputPath } = runCli('sanitize-deployment', {
      id: 'dpl_approved123',
      name: 'jet-web',
      projectId: 'prj_approved123',
      url: 'jet-web-abc.vercel.app',
      target: 'production',
      readyState: 'READY',
      createdAt: 1_752_300_000_000,
      gitSource: {
        type: 'github',
        ref: 'main',
        sha: 'c0d158c2f1ba73c879890fd2a8269f633d1f2d04',
        token: credentialCanary,
      },
      env: { OPENROUTER_API_KEY: credentialCanary },
      cookies: [credentialCanary],
      raw: { password: credentialCanary },
    });

    expectSuccess(result);
    expect(readJson(outputPath)).toEqual({
      createdAt: 1_752_300_000_000,
      gitSource: {
        ref: 'main',
        sha: 'c0d158c2f1ba73c879890fd2a8269f633d1f2d04',
        type: 'github',
      },
      id: 'dpl_approved123',
      project: { id: 'prj_approved123', name: 'jet-web' },
      readyState: 'READY',
      target: 'production',
      url: 'jet-web-abc.vercel.app',
    });
    expect(readFileSync(outputPath, 'utf8')).not.toContain(credentialCanary);
  });

  it('retains environment names and metadata but never environment values', () => {
    const { result, outputPath } = runCli(
      'sanitize-env',
      {
        envs: [
          {
            key: 'PUBLIC_SITE_ORIGIN',
            type: 'plain',
            target: ['preview', 'production'],
            value: credentialCanary,
          },
          {
            key: 'FEATURE_FLAG',
            type: 'encrypted',
            target: ['production'],
            gitBranch: 'main',
            encryptedValue: credentialCanary,
          },
        ],
      },
      ['--scope=production'],
    );

    expectSuccess(result);
    expect(readJson(outputPath)).toEqual({
      envs: [
        {
          gitBranch: 'main',
          key: 'FEATURE_FLAG',
          target: ['production'],
          type: 'encrypted',
        },
        {
          key: 'PUBLIC_SITE_ORIGIN',
          target: ['preview', 'production'],
          type: 'plain',
        },
      ],
      scope: 'production',
    });
    expect(readFileSync(outputPath, 'utf8')).not.toContain(credentialCanary);
  });

  it('accepts only the exact OpenRouter revocation schema', () => {
    const evidence = {
      provider: 'OpenRouter',
      keyRecord: 'record:11581522',
      status: 'disabled',
      revokedAt: '2026-07-11T07:00:00.000Z',
      verifiedAt: '2026-07-13T03:00:00.000Z',
    };
    const valid = runCli('sanitize-openrouter-revocation', evidence);
    expectSuccess(valid.result);
    expect(readJson(valid.outputPath)).toEqual(evidence);

    const unknown = runCli('sanitize-openrouter-revocation', {
      ...evidence,
      raw: credentialCanary,
    });
    expectRejected(unknown.result);

    const credentialShaped = runCli('sanitize-openrouter-revocation', {
      ...evidence,
      keyRecord: credentialCanary,
    });
    expectRejected(credentialShaped.result);
  });

  it('accepts safe UUID-shaped provider record IDs', () => {
    const { result, outputPath } = runCli('sanitize-openrouter-revocation', {
      provider: 'OpenRouter',
      keyRecord: '550e8400-e29b-41d4-a716-446655440000',
      status: 'disabled',
      revokedAt: '2026-07-11T07:00:00.000Z',
      verifiedAt: '2026-07-13T03:00:00.000Z',
    });

    expectSuccess(result);
    expect(readJson(outputPath)).toMatchObject({
      keyRecord: '550e8400-e29b-41d4-a716-446655440000',
    });
  });

  it('accepts safe bare alphanumeric provider record IDs', () => {
    const { result, outputPath } = runCli('sanitize-openrouter-revocation', {
      provider: 'OpenRouter',
      keyRecord: 'providerKeyRecord123',
      status: 'disabled',
      revokedAt: '2026-07-11T07:00:00.000Z',
      verifiedAt: '2026-07-13T03:00:00.000Z',
    });

    expectSuccess(result);
    expect(readJson(outputPath)).toMatchObject({
      keyRecord: 'providerKeyRecord123',
    });
  });

  it.each([credentialCanary, hexEntropyCanary, 'authorization:record-123'])(
    'rejects unsafe bare provider record IDs',
    (keyRecord) => {
      const { result } = runCli('sanitize-openrouter-revocation', {
        provider: 'OpenRouter',
        keyRecord,
        status: 'disabled',
        revokedAt: '2026-07-11T07:00:00.000Z',
        verifiedAt: '2026-07-13T03:00:00.000Z',
      });

      expectRejected(result);
    },
  );

  it('rejects generic high-entropy data in a Git ref', () => {
    const { result, outputPath } = runCli('sanitize-deployment', {
      id: 'dpl_approved123',
      name: 'jet-web',
      projectId: 'prj_approved123',
      url: 'jet-web-abc.vercel.app',
      target: 'production',
      readyState: 'READY',
      createdAt: 1_752_300_000_000,
      gitSource: {
        type: 'github',
        ref: `feature/${entropyCanary}`,
        sha: 'c0d158c2f1ba73c879890fd2a8269f633d1f2d04',
      },
    });

    expectRejected(result);
    expect(() => readFileSync(outputPath)).toThrow();
  });

  it('rejects long high-variation hexadecimal data in a Git ref', () => {
    const { result, outputPath } = runCli('sanitize-deployment', {
      id: 'dpl_approved123',
      name: 'jet-web',
      projectId: 'prj_approved123',
      url: 'jet-web-abc.vercel.app',
      target: 'production',
      readyState: 'READY',
      createdAt: 1_752_300_000_000,
      gitSource: {
        type: 'github',
        ref: `feature/${hexEntropyCanary}`,
        sha: 'c0d158c2f1ba73c879890fd2a8269f633d1f2d04',
      },
    });

    expectRejected(result);
    expect(() => readFileSync(outputPath)).toThrow();
  });

  it.each([entropyCanary, encodeURIComponent(entropyCanary)])(
    'rejects generic high-entropy data in Blob pathname and URL components',
    (canary) => {
      const { result } = runCli('verify-safe', [
        {
          pathname: `chatbot/${canary}.json`,
          size: 123,
          uploadedAt: '2026-07-11T07:00:00.000Z',
          url: `https://vyge4wbmw8jgd8rh.public.blob.vercel-storage.com/chatbot/${canary}.json`,
        },
      ]);

      expectRejected(result);
    },
  );

  it.each([
    {
      label: 'raw pathname',
      pathname: `chatbot/${hexEntropyCanary}.json`,
      urlPath: 'chatbot/safe-file.json',
    },
    {
      label: 'decoded pathname',
      pathname: `chatbot/${encodedHexEntropyCanary}.json`,
      urlPath: 'chatbot/safe-file.json',
    },
    {
      label: 'raw URL',
      pathname: 'chatbot/safe-file.json',
      urlPath: `chatbot/${hexEntropyCanary}.json`,
    },
    {
      label: 'decoded URL',
      pathname: 'chatbot/safe-file.json',
      urlPath: `chatbot/${encodedHexEntropyCanary}.json`,
    },
  ])(
    'rejects long hexadecimal data in a $label component',
    ({ pathname, urlPath }) => {
      const { result } = runCli('verify-safe', [
        {
          pathname,
          size: 123,
          uploadedAt: '2026-07-11T07:00:00.000Z',
          url: `https://vyge4wbmw8jgd8rh.public.blob.vercel-storage.com/${urlPath}`,
        },
      ]);

      expectRejected(result);
    },
  );

  it('retains explicit SHA and ID entropy exceptions', () => {
    const { result } = runCli('verify-safe', {
      aliases: ['jetsanchez.com'],
      id: `dpl_${hexEntropyCanary}`,
      name: 'jet-web',
      readyState: 'READY',
      target: 'production',
      url: 'jet-web-abc.vercel.app',
    });

    expectSuccess(result);
  });

  it('removes a partial output whenever sanitization fails', () => {
    const { result, outputPath } = runCli('sanitize-inspect', {
      id: 'dpl_approved123',
      name: 'jet-web',
      url: `https://${credentialCanary}@jet-web-abc.vercel.app`,
      target: 'production',
      readyState: 'READY',
      aliases: [],
    });

    expectRejected(result);
    expect(() => readFileSync(outputPath)).toThrow();
  });

  it('verify-safe rejects dangerous names, credential-like values, and unknown schemas', () => {
    const unsafeDocuments = [
      { authorization: `Bearer ${credentialCanary}` },
      { cookie: credentialCanary },
      { environmentValue: credentialCanary },
      { buildEnv: { SAFE_NAME: credentialCanary } },
      { result: 'A'.repeat(96) },
    ];

    for (const document of unsafeDocuments) {
      const { result } = runCli('verify-safe', document);
      expectRejected(result);
    }
  });

  it('verify-safe rejects --output without deleting an unrelated sentinel', () => {
    const directory = temporaryDirectory();
    const inputPath = resolve(directory, 'input.json');
    const sentinelPath = resolve(directory, 'sentinel.txt');
    writeFileSync(inputPath, `${JSON.stringify({ raw: credentialCanary })}\n`, {
      mode: 0o600,
    });
    writeFileSync(sentinelPath, 'preserve-me\n', { mode: 0o600 });

    const result = spawnSync(
      process.execPath,
      [
        tsx,
        sanitizer,
        'verify-safe',
        `--input=${inputPath}`,
        `--output=${sentinelPath}`,
      ],
      { cwd: projectRoot, encoding: 'utf8' },
    );

    expectRejected(result);
    expect(readFileSync(sentinelPath, 'utf8')).toBe('preserve-me\n');
  });

  it('verify-safe rejects --output even when the input is safe', () => {
    const safeInspect = {
      aliases: ['jetsanchez.com'],
      id: 'dpl_approved123',
      name: 'jet-web',
      readyState: 'READY',
      target: 'production',
      url: 'jet-web-abc.vercel.app',
    };
    const { result } = runCli('verify-safe', safeInspect, [], true);

    expectRejected(result);
  });
});

const onceEncodedCanary = encodeURIComponent(`token=${credentialCanary}`);
const twiceEncodedCanary = encodeURIComponent(onceEncodedCanary);

const urlCanaries = [
  (origin: string) => `${origin}?token=${credentialCanary}`,
  (origin: string) => `${origin}?q=${onceEncodedCanary}`,
  (origin: string) =>
    origin.replace('https://', `https://${credentialCanary}@`),
  (origin: string) => `${origin}/${credentialCanary}`,
  (origin: string) => `${origin}#${credentialCanary}`,
  (origin: string) => `${origin}/%0d%0a${onceEncodedCanary}`,
  (origin: string) => `${origin}/${twiceEncodedCanary}`,
];

type UrlSchema = {
  name: string;
  origin: string;
  run: (url: string) => CliResult;
};

const urlSchemas: UrlSchema[] = [
  {
    name: 'inspect deployment URL',
    origin: 'https://jet-web-abc.vercel.app',
    run: (url) =>
      runCli('sanitize-inspect', {
        id: 'dpl_approved123',
        name: 'jet-web',
        url,
        target: 'production',
        readyState: 'READY',
        aliases: ['jetsanchez.com'],
      }).result,
  },
  {
    name: 'inspect alias URL',
    origin: 'https://www.jetsanchez.com',
    run: (url) =>
      runCli('sanitize-inspect', {
        id: 'dpl_approved123',
        name: 'jet-web',
        url: 'jet-web-abc.vercel.app',
        target: 'production',
        readyState: 'READY',
        aliases: [url],
      }).result,
  },
  {
    name: 'deployment URL',
    origin: 'https://jet-web-abc.vercel.app',
    run: (url) =>
      runCli('sanitize-deployment', {
        id: 'dpl_approved123',
        name: 'jet-web',
        projectId: 'prj_approved123',
        url,
        target: 'production',
        readyState: 'READY',
        createdAt: 1_752_300_000_000,
        gitSource: {
          type: 'github',
          ref: 'main',
          sha: 'c0d158c2f1ba73c879890fd2a8269f633d1f2d04',
        },
      }).result,
  },
  {
    name: 'Blob inventory URL',
    origin:
      'https://vyge4wbmw8jgd8rh.public.blob.vercel-storage.com/chatbot/evidence.json',
    run: (url) =>
      runCli('verify-safe', [
        {
          pathname: 'chatbot/evidence.json',
          size: 123,
          uploadedAt: '2026-07-11T07:00:00.000Z',
          url,
        },
      ]).result,
  },
  {
    name: 'containment result destination URL',
    origin: 'https://jetsanchez.com/tools/chatbot',
    run: (url) =>
      runCli('verify-safe', {
        blobs: {
          afterCount: 0,
          beforeCount: 1,
          probes: [{ pathname: 'chatbot/evidence.json', status: 404 }],
        },
        credentialRevoked: true,
        deployment: {
          gitSha: 'c0d158c2f1ba73c879890fd2a8269f633d1f2d04',
          id: 'dpl_approved123',
          readyState: 'READY',
          target: 'production',
        },
        environmentNameAbsent: {
          development: true,
          preview: true,
          production: true,
        },
        routes: [{ destination: url, path: '/chatbot', status: 308 }],
        verifiedAt: '2026-07-13T03:00:00.000Z',
      }).result,
  },
];

describe.each(urlSchemas)('$name validation', ({ origin, run }) => {
  it.each(urlCanaries.map((createUrl, index) => [index, createUrl]))(
    'rejects URL canary %i',
    (_index, createUrl) => {
      expectRejected(run(createUrl(origin)));
    },
  );
});
