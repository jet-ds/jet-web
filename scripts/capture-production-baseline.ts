import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  rmdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { fileURLToPath } from 'node:url';
import { basename, dirname, isAbsolute, relative, resolve } from 'node:path';
import { chromium, devices, type BrowserContextOptions } from '@playwright/test';

type JsonObject = Record<string, unknown>;

type ViewportDefinition = {
  name: 'desktop' | 'mobile';
  context: BrowserContextOptions;
  manifestViewport: { width: number; height: number };
};

type CaptureRecord = {
  route: string;
  url: string;
  status: number;
  viewport: { name: string; width: number; height: number };
  title: string;
  canonicalUrl: string;
  jsonLd: unknown[];
  htmlSha256: string;
  screenshot: string;
};

type CaptureResponse = {
  status(): number;
  body(): Promise<Buffer>;
};

type CaptureLocator = {
  getAttribute(name: string): Promise<string | null>;
  allTextContents(): Promise<string[]>;
};

type CapturePage = {
  goto(url: string, options: { waitUntil: 'networkidle' }): Promise<CaptureResponse | null>;
  title(): Promise<string>;
  locator(selector: string): CaptureLocator;
  screenshot(options: { path: string; fullPage: true }): Promise<unknown>;
  url(): string;
};

type CaptureContext = {
  newPage(): Promise<CapturePage>;
  close(): Promise<void>;
};

type CaptureBrowser = {
  newContext(options: BrowserContextOptions): Promise<CaptureContext>;
  close(): Promise<void>;
};

export type CaptureDependencies = {
  fileSystem: {
    copyFileSync: typeof copyFileSync;
    existsSync: typeof existsSync;
    mkdirSync: typeof mkdirSync;
    readFileSync: typeof readFileSync;
    rmdirSync: typeof rmdirSync;
    rmSync: typeof rmSync;
    statSync: typeof statSync;
    writeFileSync: typeof writeFileSync;
  };
  launchBrowser(): Promise<CaptureBrowser>;
  verifyDeployment(path: string): JsonObject;
  hash(value: Buffer | string): string;
};

const ROUTES = [
  { route: '/', name: 'home' },
  { route: '/blog', name: 'blog-index' },
  { route: '/blog/how-to-install-claude-code-cli-2026', name: 'blog-claude' },
  { route: '/works', name: 'works-index' },
  { route: '/works/recursive-convergence-hypothesis', name: 'works-rch' },
  { route: '/tools', name: 'tools' },
  { route: '/contact', name: 'contact' },
] as const;

const pixel7 = devices['Pixel 7'];
if (!pixel7.viewport) throw new Error('PIXEL_7_VIEWPORT_UNAVAILABLE');

const VIEWPORTS: ViewportDefinition[] = [
  {
    name: 'desktop',
    context: { viewport: { width: 1_440, height: 1_000 } },
    manifestViewport: { width: 1_440, height: 1_000 },
  },
  {
    name: 'mobile',
    context: { ...pixel7 },
    manifestViewport: { ...pixel7.viewport },
  },
];

function isObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!isObject(value)) return value;
  return Object.fromEntries(
    Object.entries(value)
      .sort(([left], [right]) => {
        if (left === right) return 0;
        return left < right ? -1 : 1;
      })
      .map(([key, child]) => [key, canonicalize(child)]),
  );
}

function canonicalJson(value: unknown): string {
  return `${JSON.stringify(canonicalize(value), null, 2)}\n`;
}

function sha256(value: Buffer | string): string {
  return createHash('sha256').update(value).digest('hex');
}

function parseArguments(arguments_: string[]): Map<string, string> {
  const options = new Map<string, string>();
  for (const argument of arguments_) {
    const match = /^--([a-z-]+)=(.+)$/u.exec(argument);
    if (!match || options.has(match[1])) throw new Error('INVALID_ARGUMENT');
    options.set(match[1], match[2]);
  }
  const allowed = new Set(['origin', 'expected-commit', 'deployment', 'output', 'compare-to']);
  if ([...options.keys()].some((key) => !allowed.has(key))) throw new Error('INVALID_ARGUMENT');
  for (const key of ['origin', 'expected-commit', 'deployment', 'output']) {
    if (!options.has(key)) throw new Error(`MISSING_${key.toUpperCase().replaceAll('-', '_')}`);
  }
  return options;
}

function requireOrigin(value: string): string {
  let origin: URL;
  try {
    origin = new URL(value);
  } catch {
    throw new Error('INVALID_ORIGIN');
  }
  if (
    origin.protocol !== 'https:'
    || origin.username !== ''
    || origin.password !== ''
    || origin.port !== ''
    || origin.pathname !== '/'
    || origin.search !== ''
    || origin.hash !== ''
  ) {
    throw new Error('INVALID_ORIGIN');
  }
  return origin.origin;
}

function requireExpectedCommit(value: string): string {
  if (!/^[a-f0-9]{40}$/u.test(value)) throw new Error('INVALID_EXPECTED_COMMIT');
  return value;
}

function verifySanitizedDeployment(path: string): JsonObject {
  const projectRoot = resolve(import.meta.dirname, '..');
  const tsx = resolve(projectRoot, 'node_modules/tsx/dist/cli.mjs');
  const sanitizer = resolve(projectRoot, 'scripts/sanitize-vercel-evidence.ts');
  const verification = spawnSync(
    process.execPath,
    [tsx, sanitizer, 'verify-safe', `--input=${resolve(path)}`],
    { cwd: projectRoot, encoding: 'utf8' },
  );
  if (verification.status !== 0 || verification.stdout !== '' || verification.stderr !== '') {
    throw new Error('DEPLOYMENT_EVIDENCE_NOT_SANITIZER_APPROVED');
  }
  const deployment = JSON.parse(readFileSync(path, 'utf8')) as unknown;
  if (!isObject(deployment)) throw new Error('INVALID_DEPLOYMENT_EVIDENCE');
  return deployment;
}

function assertDeployment(deployment: JsonObject, expectedCommit: string): {
  id: string;
  readyState: string;
  target: string;
  gitSha: string;
} {
  const gitSource = isObject(deployment.gitSource) ? deployment.gitSource : undefined;
  if (
    typeof deployment.id !== 'string'
    || typeof deployment.readyState !== 'string'
    || typeof deployment.target !== 'string'
    || !gitSource
    || typeof gitSource.sha !== 'string'
  ) {
    throw new Error('INVALID_DEPLOYMENT_EVIDENCE');
  }
  if (gitSource.sha !== expectedCommit) {
    throw new Error(
      `DEPLOYMENT_SHA_MISMATCH actual=${gitSource.sha} readyState=${deployment.readyState} target=${deployment.target}`,
    );
  }
  if (deployment.readyState !== 'READY' || deployment.target !== 'production') {
    throw new Error(
      `DEPLOYMENT_NOT_READY_PRODUCTION actual=${gitSource.sha} readyState=${deployment.readyState} target=${deployment.target}`,
    );
  }
  return {
    id: deployment.id,
    readyState: deployment.readyState,
    target: deployment.target,
    gitSha: gitSource.sha,
  };
}

function isEqualOrWithin(candidate: string, parent: string): boolean {
  const pathFromParent = relative(parent, candidate);
  return pathFromParent === '' || (!pathFromParent.startsWith('..') && !isAbsolute(pathFromParent));
}

function prospectiveRealPath(
  path: string,
  fileSystem: CaptureDependencies['fileSystem'],
): string {
  let existingAncestor = resolve(path);
  const missingSegments: string[] = [];
  while (!fileSystem.existsSync(existingAncestor)) {
    const parent = dirname(existingAncestor);
    if (parent === existingAncestor) throw new Error('OUTPUT_ANCESTOR_NOT_FOUND');
    missingSegments.unshift(basename(existingAncestor));
    existingAncestor = parent;
  }
  return resolve(realpathSync(existingAncestor), ...missingSegments);
}

function assertComparisonPaths(
  output: string,
  baseline: string,
  fileSystem: CaptureDependencies['fileSystem'],
): void {
  if (!fileSystem.existsSync(baseline) || !fileSystem.statSync(baseline).isDirectory()) {
    throw new Error('IMMUTABLE_BASELINE_NOT_FOUND');
  }
  if (fileSystem.existsSync(output)) throw new Error('COMPARISON_OUTPUT_ALREADY_EXISTS');
  const realBaseline = realpathSync(baseline);
  const realOutput = prospectiveRealPath(output, fileSystem);
  if (isEqualOrWithin(realOutput, realBaseline)) throw new Error('OUTPUT_WITHIN_IMMUTABLE_BASELINE');
}

function parseJsonLd(values: string[]): unknown[] {
  return values.map((value) => {
    try {
      return JSON.parse(value) as unknown;
    } catch {
      throw new Error('INVALID_JSON_LD');
    }
  });
}

function comparisonFor(
  baselineDirectory: string,
  candidateDirectory: string,
  candidateManifest: JsonObject,
  dependencies: CaptureDependencies,
): JsonObject {
  const baselineManifest = JSON.parse(
    dependencies.fileSystem.readFileSync(resolve(baselineDirectory, 'manifest.json'), 'utf8'),
  ) as JsonObject;
  const baselineRecords = Array.isArray(baselineManifest.records)
    ? baselineManifest.records.filter(isObject)
    : [];
  const candidateRecords = Array.isArray(candidateManifest.records)
    ? candidateManifest.records.filter(isObject)
    : [];
  if (baselineRecords.length !== ROUTES.length * VIEWPORTS.length) {
    throw new Error('INVALID_BASELINE_MANIFEST_RECORD_COUNT');
  }

  const baselineByKey = new Map(
    baselineRecords.map((record) => [
      `${String(record.route)}:${String(isObject(record.viewport) ? record.viewport.name : '')}`,
      record,
    ]),
  );
  const records = candidateRecords.map((candidate) => {
    const viewport = isObject(candidate.viewport) ? candidate.viewport : {};
    const key = `${String(candidate.route)}:${String(viewport.name)}`;
    const baseline = baselineByKey.get(key);
    if (!baseline) throw new Error('BASELINE_RECORD_MISSING');
    const screenshot = String(candidate.screenshot);
    const baselineScreenshot = String(baseline.screenshot);
    const candidateScreenshotSha256 = dependencies.hash(
      dependencies.fileSystem.readFileSync(resolve(candidateDirectory, screenshot)),
    );
    const baselineScreenshotSha256 = dependencies.hash(
      dependencies.fileSystem.readFileSync(resolve(baselineDirectory, baselineScreenshot)),
    );
    return {
      route: candidate.route,
      viewport: viewport.name,
      statusMatches: candidate.status === baseline.status,
      titleMatches: candidate.title === baseline.title,
      canonicalUrlMatches: candidate.canonicalUrl === baseline.canonicalUrl,
      jsonLdMatches: canonicalJson(candidate.jsonLd) === canonicalJson(baseline.jsonLd),
      htmlMatches: candidate.htmlSha256 === baseline.htmlSha256,
      screenshotMatches: candidateScreenshotSha256 === baselineScreenshotSha256,
      baselineScreenshotSha256,
      candidateScreenshotSha256,
    };
  });
  return { records };
}

const defaultDependencies: CaptureDependencies = {
  fileSystem: {
    copyFileSync,
    existsSync,
    mkdirSync,
    readFileSync,
    rmdirSync,
    rmSync,
    statSync,
    writeFileSync,
  },
  launchBrowser: async () => chromium.launch() as unknown as CaptureBrowser,
  verifyDeployment: verifySanitizedDeployment,
  hash: sha256,
};

export async function captureProductionBaseline(
  arguments_: string[],
  dependencies: CaptureDependencies = defaultDependencies,
): Promise<void> {
  const options = parseArguments(arguments_);
  const origin = requireOrigin(options.get('origin')!);
  const expectedCommit = requireExpectedCommit(options.get('expected-commit')!);
  const deploymentPath = resolve(options.get('deployment')!);
  const output = resolve(options.get('output')!);
  const compareTo = options.has('compare-to') ? resolve(options.get('compare-to')!) : undefined;
  if (compareTo) assertComparisonPaths(output, compareTo, dependencies.fileSystem);

  const manifestPath = resolve(output, 'manifest.json');
  const screenshotDirectory = resolve(output, 'screenshots');
  const comparisonPath = resolve(output, 'comparison.json');
  const candidateDeploymentPath = resolve(output, 'deployment.json');
  const outputDirectoryExisted = dependencies.fileSystem.existsSync(output);
  const screenshotDirectoryExisted = dependencies.fileSystem.existsSync(screenshotDirectory);
  const baselineCreatedPaths = new Set<string>();
  const generatedPaths = [manifestPath, comparisonPath];
  if (compareTo) generatedPaths.push(candidateDeploymentPath);
  for (const route of ROUTES) {
    for (const viewport of VIEWPORTS) {
      generatedPaths.push(resolve(screenshotDirectory, `${route.name}-${viewport.name}.png`));
    }
  }
  if (!compareTo && generatedPaths.some(dependencies.fileSystem.existsSync)) {
    throw new Error('BASELINE_OUTPUT_ALREADY_EXISTS');
  }

  try {
    const deployment = assertDeployment(dependencies.verifyDeployment(deploymentPath), expectedCommit);
    dependencies.fileSystem.mkdirSync(screenshotDirectory, { recursive: true });
    if (compareTo) dependencies.fileSystem.copyFileSync(deploymentPath, candidateDeploymentPath);
    const records: CaptureRecord[] = [];
    let browser: CaptureBrowser | undefined;
    try {
      browser = await dependencies.launchBrowser();
      for (const route of ROUTES) {
        for (const viewport of VIEWPORTS) {
          const context = await browser.newContext(viewport.context);
          try {
            const page = await context.newPage();
            const requestedUrl = new URL(route.route, `${origin}/`).toString();
            const response = await page.goto(requestedUrl, { waitUntil: 'networkidle' });
            if (!response) throw new Error('MISSING_DOCUMENT_RESPONSE');
            const status = response.status();
            if (status !== 200) throw new Error(`UNEXPECTED_ROUTE_STATUS route=${route.route} status=${status}`);
            const responseHtml = await response.body();
            const title = await page.title();
            const canonicalUrl = await page.locator('link[rel="canonical"]').getAttribute('href');
            if (!canonicalUrl) throw new Error(`MISSING_CANONICAL route=${route.route}`);
            const normalizedCanonicalUrl = new URL(canonicalUrl, requestedUrl).toString();
            const jsonLdText = await page.locator('script[type="application/ld+json"]').allTextContents();
            const jsonLd = parseJsonLd(jsonLdText);
            const screenshot = `screenshots/${route.name}-${viewport.name}.png`;
            const screenshotPath = resolve(output, screenshot);
            if (!compareTo) {
              if (dependencies.fileSystem.existsSync(screenshotPath)) {
                throw new Error('BASELINE_OUTPUT_ALREADY_EXISTS');
              }
              baselineCreatedPaths.add(screenshotPath);
            }
            await page.screenshot({ path: screenshotPath, fullPage: true });
            records.push({
              route: route.route,
              url: page.url(),
              status,
              viewport: { name: viewport.name, ...viewport.manifestViewport },
              title,
              canonicalUrl: normalizedCanonicalUrl,
              jsonLd,
              htmlSha256: dependencies.hash(responseHtml),
              screenshot,
            });
          } finally {
            await context.close();
          }
        }
      }
    } finally {
      if (browser) await browser.close();
    }

    records.sort((left, right) => {
      if (left.route !== right.route) return left.route < right.route ? -1 : 1;
      if (left.viewport.name === right.viewport.name) return 0;
      return left.viewport.name < right.viewport.name ? -1 : 1;
    });
    const manifest: JsonObject = {
      origin,
      deployment,
      records,
    };
    if (!compareTo) {
      if (dependencies.fileSystem.existsSync(manifestPath)) {
        throw new Error('BASELINE_OUTPUT_ALREADY_EXISTS');
      }
      baselineCreatedPaths.add(manifestPath);
    }
    dependencies.fileSystem.writeFileSync(manifestPath, canonicalJson(manifest));
    if (compareTo) {
      dependencies.fileSystem.writeFileSync(
        comparisonPath,
        canonicalJson(comparisonFor(compareTo, output, manifest, dependencies)),
      );
    }
  } catch (error) {
    if (compareTo) {
      dependencies.fileSystem.rmSync(output, { recursive: true, force: true });
    } else {
      for (const path of baselineCreatedPaths) {
        dependencies.fileSystem.rmSync(path, { force: true });
      }
      if (!screenshotDirectoryExisted && dependencies.fileSystem.existsSync(screenshotDirectory)) {
        try {
          dependencies.fileSystem.rmdirSync(screenshotDirectory);
        } catch {
          // Preserve unexpected content and the original capture failure.
        }
      }
      if (!outputDirectoryExisted && dependencies.fileSystem.existsSync(output)) {
        try {
          dependencies.fileSystem.rmdirSync(output);
        } catch {
          // Preserve unexpected content and the original capture failure.
        }
      }
    }
    throw error;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  captureProductionBaseline(process.argv.slice(2)).catch((error: unknown) => {
    const message = error instanceof Error ? error.message : 'UNEXPECTED_CAPTURE_ERROR';
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  });
}
