import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmdirSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import type { BrowserContextOptions } from '@playwright/test';
import { afterEach, describe, expect, it } from 'vitest';
import {
  captureProductionBaseline,
  type CaptureDependencies,
} from '../../../scripts/capture-production-baseline';

const expectedCommit = 'c0d158c2f1ba73c879890fd2a8269f633d1f2d04';
const temporaryDirectories: string[] = [];
const routes = [
  { route: '/', name: 'home' },
  { route: '/blog', name: 'blog-index' },
  { route: '/blog/how-to-install-claude-code-cli-2026', name: 'blog-claude' },
  { route: '/works', name: 'works-index' },
  { route: '/works/recursive-convergence-hypothesis', name: 'works-rch' },
  { route: '/tools', name: 'tools' },
  { route: '/contact', name: 'contact' },
] as const;
const viewports = ['desktop', 'mobile'] as const;

type FailurePhase =
  | 'mkdir'
  | 'copy'
  | 'launch'
  | 'capture'
  | 'close'
  | 'baseline-read'
  | 'hash'
  | 'manifest-write'
  | 'comparison-write';

type Fixture = {
  root: string;
  baseline: string;
  candidate: string;
  deployment: string;
};

type BrowserCookie = {
  name: string;
  value: string;
  url: string;
  httpOnly: true;
  secure: true;
  sameSite: 'Lax';
};

type BrowserState = {
  events: string[];
  cookies: BrowserCookie[];
  contextOptions?: BrowserContextOptions[];
  cookieInstallFailure?: boolean;
  redirectedUrl?: string;
};

function makeFixture(): Fixture {
  const root = mkdtempSync(resolve(tmpdir(), 'production-baseline-test-'));
  temporaryDirectories.push(root);
  const baseline = resolve(root, 'baseline');
  const candidate = resolve(root, 'candidate');
  const deployment = resolve(root, 'deployment.json');
  const screenshotDirectory = resolve(baseline, 'screenshots');
  mkdirSync(screenshotDirectory, { recursive: true });
  writeFileSync(deployment, '{}\n');

  const records = routes.flatMap(({ route, name }) => viewports.map((viewport) => {
    const screenshot = `screenshots/${name}-${viewport}.png`;
    writeFileSync(resolve(baseline, screenshot), `baseline-${name}-${viewport}`);
    return {
      route,
      url: `https://jetsanchez.com${route}`,
      status: 200,
      viewport: { name: viewport, width: 1, height: 1 },
      title: 'Baseline',
      canonicalUrl: `https://jetsanchez.com${route}`,
      jsonLd: [{ '@type': 'WebPage' }],
      htmlSha256: 'a'.repeat(64),
      screenshot,
    };
  }));
  writeFileSync(resolve(baseline, 'manifest.json'), `${JSON.stringify({ records })}\n`);
  return { root, baseline, candidate, deployment };
}

function captureArguments(fixture: Fixture, baseline = fixture.baseline, output = fixture.candidate): string[] {
  return [
    '--origin=https://jet-preview.vercel.app',
    `--expected-commit=${expectedCommit}`,
    `--deployment=${fixture.deployment}`,
    `--output=${output}`,
    `--compare-to=${baseline}`,
  ];
}

function baselineCaptureArguments(fixture: Fixture, output: string): string[] {
  return [
    '--origin=https://jetsanchez.com',
    `--expected-commit=${expectedCommit}`,
    `--deployment=${fixture.deployment}`,
    `--output=${output}`,
  ];
}

function makeBrowser(phase?: FailurePhase, state?: BrowserState) {
  let currentUrl = 'https://jet-preview.vercel.app/';
  return {
    async newContext(options: BrowserContextOptions) {
      state?.contextOptions?.push(options);
      return {
        async addCookies(cookies: BrowserCookie[]) {
          state?.events.push('addCookies');
          if (state?.cookieInstallFailure) {
            throw new Error(`browser rejected ${cookies[0]?.value}`);
          }
          state?.cookies.push(...cookies);
        },
        async newPage() {
          return {
            async goto(url: string) {
              state?.events.push('goto');
              currentUrl = state?.redirectedUrl ?? url;
              if (phase === 'capture') throw new Error('INJECTED_CAPTURE_FAILURE');
              return {
                status: () => 200,
                body: async () => Buffer.from('<html></html>'),
              };
            },
            async title() {
              return 'Candidate';
            },
            locator(selector: string) {
              return {
                async getAttribute() {
                  return selector === 'link[rel="canonical"]' ? currentUrl : null;
                },
                async allTextContents() {
                  return selector === 'script[type="application/ld+json"]'
                    ? ['{"@type":"WebPage"}']
                    : [];
                },
              };
            },
            async screenshot(options: { path: string }) {
              writeFileSync(options.path, 'candidate-screenshot');
            },
            url() {
              return currentUrl;
            },
          };
        },
        async close() {},
      };
    },
    async close() {
      if (phase === 'close') throw new Error('INJECTED_CLOSE_FAILURE');
    },
  };
}

function dependenciesFor(
  fixture: Fixture,
  phase?: FailurePhase,
  deploymentTarget: 'production' | null = null,
  environment: Readonly<Record<string, string | undefined>> = {},
  browserState?: BrowserState,
): CaptureDependencies {
  const screenshotDirectory = resolve(fixture.candidate, 'screenshots');
  const candidateDeployment = resolve(fixture.candidate, 'deployment.json');
  const candidateManifest = resolve(fixture.candidate, 'manifest.json');
  const candidateComparison = resolve(fixture.candidate, 'comparison.json');
  const baselineManifest = resolve(fixture.baseline, 'manifest.json');
  let hashCalls = 0;

  const fileSystem: CaptureDependencies['fileSystem'] = {
    copyFileSync: ((source, destination, mode) => {
      copyFileSync(source, destination, mode);
      if (phase === 'copy' && String(destination) === candidateDeployment) {
        throw new Error('INJECTED_COPY_FAILURE');
      }
    }) as typeof copyFileSync,
    existsSync,
    mkdirSync: ((path, options) => {
      const result = mkdirSync(path, options as { recursive: true });
      if (phase === 'mkdir' && String(path) === screenshotDirectory) {
        throw new Error('INJECTED_MKDIR_FAILURE');
      }
      return result;
    }) as typeof mkdirSync,
    readFileSync: ((path, options) => {
      if (phase === 'baseline-read' && String(path) === baselineManifest) {
        throw new Error('INJECTED_BASELINE_READ_FAILURE');
      }
      return readFileSync(path, options as BufferEncoding);
    }) as typeof readFileSync,
    rmdirSync,
    rmSync,
    statSync,
    writeFileSync: ((path, data, options) => {
      writeFileSync(path, data, options);
      if (phase === 'manifest-write' && String(path) === candidateManifest) {
        throw new Error('INJECTED_MANIFEST_WRITE_FAILURE');
      }
      if (phase === 'comparison-write' && String(path) === candidateComparison) {
        throw new Error('INJECTED_COMPARISON_WRITE_FAILURE');
      }
    }) as typeof writeFileSync,
  };

  return {
    fileSystem,
    environment,
    async launchBrowser() {
      if (phase === 'launch') throw new Error('INJECTED_LAUNCH_FAILURE');
      return makeBrowser(phase, browserState);
    },
    verifyDeployment() {
      return {
        id: 'dpl_approved123',
        url: 'jet-preview.vercel.app',
        readyState: 'READY',
        target: deploymentTarget,
        createdAt: 1_783_917_600_000,
        gitSource: { type: 'github', ref: 'codex/v1-modernization', sha: expectedCommit },
        project: { id: 'prj_approved123', name: 'jet-web' },
      };
    },
    hash() {
      hashCalls += 1;
      if (phase === 'hash' && hashCalls > routes.length * viewports.length) {
        throw new Error('INJECTED_HASH_FAILURE');
      }
      return 'a'.repeat(64);
    },
  };
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe('production baseline capture safety', () => {
  it('sets the skip-toolbar header only on preview comparison contexts', async () => {
    const fixture = makeFixture();
    const previewState: BrowserState = { events: [], cookies: [], contextOptions: [] };

    await captureProductionBaseline(
      captureArguments(fixture),
      dependenciesFor(fixture, undefined, null, {}, previewState),
    );

    expect(previewState.contextOptions).toHaveLength(routes.length * viewports.length);
    for (const options of previewState.contextOptions ?? []) {
      expect(options.extraHTTPHeaders).toEqual({ 'x-vercel-skip-toolbar': '1' });
    }

    const output = resolve(fixture.root, 'baseline-output');
    const outputFixture = { ...fixture, candidate: output };
    const productionState: BrowserState = { events: [], cookies: [], contextOptions: [] };

    await captureProductionBaseline(
      baselineCaptureArguments(fixture, output),
      dependenciesFor(outputFixture, undefined, 'production', {}, productionState),
    );

    expect(productionState.contextOptions).toHaveLength(routes.length * viewports.length);
    for (const options of productionState.contextOptions ?? []) {
      expect(options).not.toHaveProperty('extraHTTPHeaders');
    }
  });

  it('installs a protected-preview cookie before every navigation without persisting it', async () => {
    const fixture = makeFixture();
    const browserState: BrowserState = { events: [], cookies: [] };
    const cookieEnvironment = 'VERCEL_PREVIEW_BYPASS_COOKIE';
    const cookieName = '_vercel_jwt';
    const cookieValue = 'private-test-cookie-value';

    await captureProductionBaseline(
      [...captureArguments(fixture), `--preview-cookie-env=${cookieEnvironment}`],
      dependenciesFor(
        fixture,
        undefined,
        null,
        { [cookieEnvironment]: `${cookieName}=${cookieValue}` },
        browserState,
      ),
    );

    expect(browserState.events).toEqual(
      routes.flatMap(() => viewports.flatMap(() => ['addCookies', 'goto'])),
    );
    expect(browserState.cookies).toHaveLength(routes.length * viewports.length);
    expect(browserState.cookies).toEqual(expect.arrayContaining([{
      name: cookieName,
      value: cookieValue,
      url: 'https://jet-preview.vercel.app',
      httpOnly: true,
      secure: true,
      sameSite: 'Lax',
    }]));
    const artifactText = ['manifest.json', 'comparison.json', 'deployment.json']
      .map((file) => readFileSync(resolve(fixture.candidate, file), 'utf8'))
      .join('\n');
    expect(artifactText).not.toContain(cookieEnvironment);
    expect(artifactText).not.toContain(cookieName);
    expect(artifactText).not.toContain(cookieValue);
  });

  it('rejects a missing protected-preview cookie without exposing candidate output', async () => {
    const fixture = makeFixture();

    await expect(captureProductionBaseline(
      [...captureArguments(fixture), '--preview-cookie-env=VERCEL_PREVIEW_BYPASS_COOKIE'],
      dependenciesFor(fixture),
    )).rejects.toThrow('MISSING_PREVIEW_COOKIE');
    expect(existsSync(fixture.candidate)).toBe(false);
  });

  it('redacts a browser cookie-install failure and removes candidate output', async () => {
    const fixture = makeFixture();
    const browserState: BrowserState = {
      events: [],
      cookies: [],
      cookieInstallFailure: true,
    };

    await expect(captureProductionBaseline(
      [...captureArguments(fixture), '--preview-cookie-env=VERCEL_PREVIEW_BYPASS_COOKIE'],
      dependenciesFor(
        fixture,
        undefined,
        null,
        { VERCEL_PREVIEW_BYPASS_COOKIE: '_vercel_jwt=private-test-cookie-value' },
        browserState,
      ),
    )).rejects.toThrow(/^PREVIEW_COOKIE_INSTALL_FAILED$/u);
    expect(existsSync(fixture.candidate)).toBe(false);
  });

  it.each([
    'lowercase_name',
    'VERCEL-PREVIEW-COOKIE',
    '1VERCEL_PREVIEW_COOKIE',
  ])('rejects invalid protected-preview environment name %s', async (environmentName) => {
    const fixture = makeFixture();

    await expect(captureProductionBaseline(
      [...captureArguments(fixture), `--preview-cookie-env=${environmentName}`],
      dependenciesFor(fixture, undefined, null, { [environmentName]: 'safe=value' }),
    )).rejects.toThrow('INVALID_PREVIEW_COOKIE_ENV_NAME');
    expect(existsSync(fixture.candidate)).toBe(false);
  });

  it.each([
    'name-only',
    '_vercel_jwt=',
    'bad name=value',
    '_vercel_jwt=value,second=cookie',
    '_vercel_jwt=value;second=cookie',
    '_vercel_jwt=value\r\ninjected=true',
  ])('rejects invalid protected-preview cookie input without echoing it', async (cookieInput) => {
    const fixture = makeFixture();

    const capture = captureProductionBaseline(
      [...captureArguments(fixture), '--preview-cookie-env=VERCEL_PREVIEW_BYPASS_COOKIE'],
      dependenciesFor(
        fixture,
        undefined,
        null,
        { VERCEL_PREVIEW_BYPASS_COOKIE: cookieInput },
      ),
    );
    await expect(capture).rejects.toThrow(/^INVALID_PREVIEW_COOKIE$/u);
    expect(existsSync(fixture.candidate)).toBe(false);
  });

  it('forbids the protected-preview cookie option in production-baseline mode', async () => {
    const fixture = makeFixture();
    const output = resolve(fixture.root, 'baseline-output');
    const outputFixture = { ...fixture, candidate: output };

    await expect(captureProductionBaseline(
      [
        ...baselineCaptureArguments(fixture, output),
        '--preview-cookie-env=VERCEL_PREVIEW_BYPASS_COOKIE',
      ],
      dependenciesFor(
        outputFixture,
        undefined,
        'production',
        { VERCEL_PREVIEW_BYPASS_COOKIE: '_vercel_jwt=private-test-cookie-value' },
      ),
    )).rejects.toThrow('PREVIEW_COOKIE_REQUIRES_COMPARISON');
    expect(existsSync(output)).toBe(false);
  });

  it('rejects a cross-origin SSO redirect and removes all candidate output', async () => {
    const fixture = makeFixture();
    const browserState: BrowserState = {
      events: [],
      cookies: [],
      redirectedUrl: 'https://vercel.com/login',
    };

    await expect(captureProductionBaseline(
      captureArguments(fixture),
      dependenciesFor(fixture, undefined, null, {}, browserState),
    )).rejects.toThrow(/^CROSS_ORIGIN_NAVIGATION$/u);
    expect(existsSync(fixture.candidate)).toBe(false);
  });

  it('accepts ready exact-SHA preview evidence for candidate comparison', async () => {
    const fixture = makeFixture();

    await captureProductionBaseline(captureArguments(fixture), dependenciesFor(fixture));

    const manifest = JSON.parse(readFileSync(resolve(fixture.candidate, 'manifest.json'), 'utf8'));
    expect(manifest.deployment).toEqual({
      id: 'dpl_approved123',
      readyState: 'READY',
      target: null,
      gitSha: expectedCommit,
    });
  });

  it('rejects production deployment evidence for candidate comparison', async () => {
    const fixture = makeFixture();

    await expect(captureProductionBaseline(
      captureArguments(fixture),
      dependenciesFor(fixture, undefined, 'production'),
    )).rejects.toThrow('DEPLOYMENT_NOT_READY_PREVIEW');
    expect(existsSync(fixture.candidate)).toBe(false);
  });

  it('rejects preview deployment evidence for production baseline capture', async () => {
    const fixture = makeFixture();
    const output = resolve(fixture.root, 'baseline-output');
    const outputFixture = { ...fixture, candidate: output };

    await expect(captureProductionBaseline(
      baselineCaptureArguments(fixture, output),
      dependenciesFor(outputFixture),
    )).rejects.toThrow('DEPLOYMENT_NOT_READY_PRODUCTION');
    expect(existsSync(output)).toBe(false);
  });

  it.each(['output-ancestor', 'baseline-path'] as const)(
    'rejects prospective output contained through a symlinked %s',
    async (variant) => {
      const fixture = makeFixture();
      const alias = resolve(fixture.root, 'baseline-link');
      symlinkSync(fixture.baseline, alias, 'dir');
      const baseline = variant === 'baseline-path' ? alias : fixture.baseline;
      const output = variant === 'baseline-path'
        ? resolve(fixture.baseline, 'candidate')
        : resolve(alias, 'candidate');
      const dependencies = dependenciesFor(fixture, 'launch');

      await expect(
        captureProductionBaseline(captureArguments(fixture, baseline, output), dependencies),
      ).rejects.toThrow('OUTPUT_WITHIN_IMMUTABLE_BASELINE');
      expect(existsSync(output)).toBe(false);
    },
  );

  it.each([
    'mkdir',
    'copy',
    'launch',
    'capture',
    'close',
    'baseline-read',
    'hash',
    'manifest-write',
    'comparison-write',
  ] as FailurePhase[])('removes all candidate output after an injected %s failure', async (phase) => {
    const fixture = makeFixture();

    await expect(
      captureProductionBaseline(captureArguments(fixture), dependenciesFor(fixture, phase)),
    ).rejects.toThrow(`INJECTED_${phase.replaceAll('-', '_').toUpperCase()}_FAILURE`);
    expect(existsSync(fixture.candidate)).toBe(false);
  });

  it('preserves a pre-existing screenshot directory when deployment verification fails', async () => {
    const fixture = makeFixture();
    const output = resolve(fixture.root, 'baseline-output');
    const sentinel = resolve(output, 'screenshots', 'unrelated.txt');
    mkdirSync(resolve(output, 'screenshots'), { recursive: true });
    writeFileSync(sentinel, 'preserve me');
    const outputFixture = { ...fixture, candidate: output };
    const dependencies = dependenciesFor(outputFixture);
    dependencies.verifyDeployment = () => {
      throw new Error('INJECTED_DEPLOYMENT_FAILURE');
    };

    await expect(
      captureProductionBaseline(baselineCaptureArguments(fixture, output), dependencies),
    ).rejects.toThrow('INJECTED_DEPLOYMENT_FAILURE');
    expect(readFileSync(sentinel, 'utf8')).toBe('preserve me');
    expect(existsSync(resolve(output, 'screenshots'))).toBe(true);
  });

  it.each(['manifest', 'screenshot'] as const)(
    'refuses to overwrite a pre-existing baseline %s target',
    async (targetKind) => {
      const fixture = makeFixture();
      const output = resolve(fixture.root, 'baseline-output');
      const screenshotDirectory = resolve(output, 'screenshots');
      const sentinel = resolve(screenshotDirectory, 'unrelated.txt');
      const target = targetKind === 'manifest'
        ? resolve(output, 'manifest.json')
        : resolve(screenshotDirectory, 'home-desktop.png');
      mkdirSync(screenshotDirectory, { recursive: true });
      writeFileSync(sentinel, 'preserve me');
      writeFileSync(target, 'pre-existing target');
      const outputFixture = { ...fixture, candidate: output };

      await expect(
        captureProductionBaseline(
          baselineCaptureArguments(fixture, output),
          dependenciesFor(outputFixture),
        ),
      ).rejects.toThrow('BASELINE_OUTPUT_ALREADY_EXISTS');
      expect(readFileSync(target, 'utf8')).toBe('pre-existing target');
      expect(readFileSync(sentinel, 'utf8')).toBe('preserve me');
    },
  );

  it('cleans only newly created baseline artifacts after a later failure', async () => {
    const fixture = makeFixture();
    const output = resolve(fixture.root, 'baseline-output');
    const screenshotDirectory = resolve(output, 'screenshots');
    const sentinel = resolve(screenshotDirectory, 'unrelated.txt');
    mkdirSync(screenshotDirectory, { recursive: true });
    writeFileSync(sentinel, 'preserve me');
    const outputFixture = { ...fixture, candidate: output };

    await expect(
      captureProductionBaseline(
        baselineCaptureArguments(fixture, output),
        dependenciesFor(outputFixture, 'manifest-write', 'production'),
      ),
    ).rejects.toThrow('INJECTED_MANIFEST_WRITE_FAILURE');
    expect(readFileSync(sentinel, 'utf8')).toBe('preserve me');
    expect(existsSync(screenshotDirectory)).toBe(true);
    for (const { name } of routes) {
      for (const viewport of viewports) {
        expect(existsSync(resolve(screenshotDirectory, `${name}-${viewport}.png`))).toBe(false);
      }
    }
    expect(existsSync(resolve(output, 'manifest.json'))).toBe(false);
  });
});
