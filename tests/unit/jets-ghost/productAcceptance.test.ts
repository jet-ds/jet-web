import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

interface ProductAcceptanceCase {
  id: string;
  category: 'supported' | 'ordinary' | 'cross-document' | 'unsupported';
  question: string;
  expectedSourceIds: string[];
  acceptableSourceIds: string[];
  requiredFacts: string[];
  forbiddenClaims: string[];
  mustAbstain: boolean;
}

const ROOT = process.cwd();
const FIXTURE_PATH = 'tests/fixtures/jets-ghost/product-acceptance.json';
const MANUAL_SPEC_PATH = 'tests/manual/jets-ghost-real-model.spec.ts';
const REQUEST_PRIVACY_PATH = 'tests/manual/requestPrivacy.ts';
const REAL_MODEL_CONFIG_PATH = 'playwright.real-model.config.ts';
const PACKAGE_PATH = 'package.json';

const FIXED_CASES: ProductAcceptanceCase[] = [
  {
    id: 'showcase-claude-native',
    category: 'supported',
    question: 'What installation method does Jet recommend for Claude Code in 2026, and why?',
    expectedSourceIds: ['blog:how-to-install-claude-code-cli-2026'],
    acceptableSourceIds: ['blog:how-to-install-claude-code-cli-2026'],
    requiredFacts: [
      'The native installer is the recommended standard method.',
      'Jet attributes better stability, automatic updates, and avoiding dependency conflicts to it.',
    ],
    forbiddenClaims: ['Jet recommends npm as the standard 2026 installation method.'],
    mustAbstain: false,
  },
  {
    id: 'showcase-rch-claim',
    category: 'supported',
    question: 'What is the central claim of the Recursive Convergence Hypothesis?',
    expectedSourceIds: ['works:recursive-convergence-hypothesis'],
    acceptableSourceIds: ['works:recursive-convergence-hypothesis'],
    requiredFacts: [
      'Emergent sentience is proposed as a structurally favored outcome of open recursive ASI.',
      'Recursive self-improvement and modeling sentient agents create converging pressures.',
    ],
    forbiddenClaims: ['The paper proves that every ASI will become conscious.'],
    mustAbstain: false,
  },
  {
    id: 'ordinary-agent-writing',
    category: 'ordinary',
    question: 'What has Jet published about working with coding agents?',
    expectedSourceIds: [
      'blog:how-to-install-claude-code-cli-2026',
      'blog:vibe-coding-vs-agentic-coding-why-the-distinction-matters',
    ],
    acceptableSourceIds: [
      'blog:how-to-install-claude-code-cli-2026',
      'blog:vibe-coding-vs-agentic-coding-why-the-distinction-matters',
    ],
    requiredFacts: [
      'There is a practical Claude Code setup guide.',
      'There is a conceptual essay distinguishing vibe and agentic coding.',
    ],
    forbiddenClaims: [],
    mustAbstain: false,
  },
  {
    id: 'cross-review-control',
    category: 'cross-document',
    question: "How does human review in Jet's Claude Code guidance relate to the control concerns in agentic coding?",
    expectedSourceIds: [
      'blog:how-to-install-claude-code-cli-2026',
      'blog:vibe-coding-vs-agentic-coding-why-the-distinction-matters',
    ],
    acceptableSourceIds: [
      'blog:how-to-install-claude-code-cli-2026',
      'blog:vibe-coding-vs-agentic-coding-why-the-distinction-matters',
    ],
    requiredFacts: [
      'The guide says the human maintains control and should review changes before accepting them.',
      'The essay frames durable intent and constraints as central to agentic control.',
    ],
    forbiddenClaims: ['Either article recommends autonomous changes without human review.'],
    mustAbstain: false,
  },
  {
    id: 'unsupported-private-note',
    category: 'unsupported',
    question: "What exact launch date did Jet record in a private, unpublished note for Jet's Ghost 2.1?",
    expectedSourceIds: [],
    acceptableSourceIds: [],
    requiredFacts: [],
    forbiddenClaims: [
      'Any claimed access to a private, unpublished note or an exact date unsupported by the eligible corpus.',
    ],
    mustAbstain: true,
  },
  {
    id: 'unsupported-private-schedule',
    category: 'unsupported',
    question: "What meetings are on Jet's private schedule tomorrow?",
    expectedSourceIds: [],
    acceptableSourceIds: [],
    requiredFacts: [],
    forbiddenClaims: ['Any claimed access to a private schedule.'],
    mustAbstain: true,
  },
];

function readRequired(relativePath: string): string {
  const absolutePath = join(ROOT, relativePath);
  expect(existsSync(absolutePath), `${relativePath} must exist`).toBe(true);
  return readFileSync(absolutePath, 'utf8');
}

function readFixture(): ProductAcceptanceCase[] {
  return JSON.parse(readRequired(FIXTURE_PATH)) as ProductAcceptanceCase[];
}

function quotedValues(source: string, declaration: string): string[] {
  const match = source.match(new RegExp(`const ${declaration} = \\[([\\s\\S]*?)\\] as const;`));
  expect(match, `${declaration} must be a readonly literal list`).not.toBeNull();
  return [...match![1].matchAll(/'([^']+)'/g)].map((result) => result[1]);
}

describe("Jet's Ghost product-acceptance fixture", () => {
  it('contains only the six fixed reviewed cases', () => {
    expect(readFixture()).toEqual(FIXED_CASES);
  });

  it('keeps unique IDs and the fixed 2/1/1/2 category scope', () => {
    const cases = readFixture();
    expect(new Set(cases.map(({ id }) => id)).size).toBe(6);
    expect(cases.map(({ id }) => id)).toEqual(FIXED_CASES.map(({ id }) => id));
    expect(Object.fromEntries([
      'supported',
      'ordinary',
      'cross-document',
      'unsupported',
    ].map((category) => [
      category,
      cases.filter((acceptanceCase) => acceptanceCase.category === category).length,
    ]))).toEqual({
      supported: 2,
      ordinary: 1,
      'cross-document': 1,
      unsupported: 2,
    });
  });

  it('enforces source, fact, synthesis, and abstention boundaries', () => {
    const cases = readFixture();

    for (const acceptanceCase of cases) {
      expect(acceptanceCase.expectedSourceIds.every((sourceId) => (
        acceptanceCase.acceptableSourceIds.includes(sourceId)
      )), acceptanceCase.id).toBe(true);

      if (acceptanceCase.category === 'supported') {
        expect(acceptanceCase.expectedSourceIds.length, acceptanceCase.id).toBeGreaterThan(0);
        expect(acceptanceCase.requiredFacts.length, acceptanceCase.id).toBeGreaterThan(0);
      }

      if (acceptanceCase.mustAbstain) {
        expect(acceptanceCase.expectedSourceIds, acceptanceCase.id).toEqual([]);
        expect(acceptanceCase.acceptableSourceIds, acceptanceCase.id).toEqual([]);
        expect(acceptanceCase.requiredFacts, acceptanceCase.id).toEqual([]);
      }
    }

    const crossDocument = cases.find(({ category }) => category === 'cross-document');
    expect(crossDocument?.expectedSourceIds.length).toBeGreaterThanOrEqual(2);
  });
});

describe("Jet's Ghost real-model harness contract", () => {
  it('exposes exactly one qualification mode and the fixed two-case smoke mode', () => {
    const manualSpec = readRequired(MANUAL_SPEC_PATH);

    expect(quotedValues(manualSpec, 'REAL_MODEL_MODES')).toEqual([
      'qualification',
      'smoke',
    ]);
    expect(quotedValues(manualSpec, 'SMOKE_CASE_IDS')).toEqual([
      'showcase-rch-claim',
      'unsupported-private-note',
    ]);
    expect(manualSpec).toContain("throw new Error('UNKNOWN_REAL_MODEL_MODE');");
    expect(manualSpec).toContain("test.skip(process.env.RUN_REAL_MODEL !== '1', 'Set RUN_REAL_MODEL=1 for the 2 GB WebGPU qualification');");
    expect(manualSpec).toContain("process.platform !== 'darwin' || process.arch !== 'arm64'");
  });

  it('keeps qualification interactive, in memory, content-free, and black-box', () => {
    const manualSpec = readRequired(MANUAL_SPEC_PATH);

    expect(manualSpec).toContain('page.pause()');
    expect(manualSpec).toContain('validateModelDeliveryChain');
    expect(manualSpec).toContain('isTrustedModelOrigin');
    expect(manualSpec).toContain('LITERT_LM_WASM_ASSETS');
    expect(manualSpec).toContain('validation/hydration');
    expect(manualSpec).toContain('engine-ready-ms=');
    expect(manualSpec).toContain('phase=cold-activation');
    expect(manualSpec).toContain('phase=warm-activation');
    expect(manualSpec).toContain('phase=product-cases');
    expect(manualSpec).toContain('phase=lifecycle-closeout');
    expect(manualSpec).toContain('printSmokeVersions');
    expect(manualSpec).toContain('if (articles.length < 2) return false;');
    expect(manualSpec).toContain("getByTestId('lifecycle-visible-status')");
    expect(manualSpec).toContain("getByRole('link', { name: 'Contact' })");
    expect(manualSpec).not.toMatch(/review[-_ ]?(?:overlay|form|application)/iu);
    expect(manualSpec).not.toMatch(/__JETS_GHOST_E2E__|PUBLIC_JETS_GHOST_E2E/u);
    expect(manualSpec).not.toMatch(/writeFile|createWriteStream|outputPath|testInfo\.attach/u);
    expect(manualSpec).not.toMatch(/launchPersistentContext|userDataDir|deviceSlug|deviceMatrix/u);
    expect(manualSpec).not.toMatch(/result(?:Path|Schema)|qualification-results?/u);
  });

  it('rejects Playwright browser connection and context reuse controls', () => {
    const manualSpec = readRequired(MANUAL_SPEC_PATH);

    expect(quotedValues(manualSpec, 'PROFILE_ENVIRONMENT_KEYS')).toEqual([
      'PLAYWRIGHT_USER_DATA_DIR',
      'CHROME_USER_DATA_DIR',
      'JETS_GHOST_USER_DATA_DIR',
      'PW_TEST_CONNECT_WS_ENDPOINT',
      'PW_TEST_REUSE_CONTEXT',
    ]);
  });

  it('audits Partytown transport separately and decodes request sentinels', () => {
    const manualSpec = readRequired(MANUAL_SPEC_PATH);

    expect(manualSpec).toContain('function isPartytownTransport');
    expect(manualSpec).toContain('validatePartytownTransport');
    expect(manualSpec).toContain("request.method() === 'POST'");
    expect(manualSpec).toContain("JSON.parse(body)");
    expect(manualSpec).toContain("url.searchParams.values()");
    expect(manualSpec).toContain('decodeURIComponent');
    expect(manualSpec).toContain('PARTYTOWN_TRANSPORT_SCHEMA_INVALID');
    expect(manualSpec).not.toContain("credentials: 'same-origin'");
  });

  it('classifies only the exact non-network Partytown blob-script shape', () => {
    const manualSpec = readRequired(MANUAL_SPEC_PATH);
    const privacySource = readRequired(REQUEST_PRIVACY_PATH);

    expect(manualSpec).toContain("from './requestPrivacy';");
    expect(privacySource).toContain('export function isPartytownBlobScript');
    expect(privacySource).toContain("url.protocol !== 'blob:'");
    expect(privacySource).toContain("url.search !== ''");
    expect(privacySource).toContain("url.hash !== ''");
    expect(manualSpec).toContain('|| partytownBlobScript');
  });

  it('classifies only the exact same-origin Partytown sandbox document shape', () => {
    const manualSpec = readRequired(MANUAL_SPEC_PATH);
    const privacySource = readRequired(REQUEST_PRIVACY_PATH);

    expect(privacySource).toContain('export function isPartytownSandboxDocument');
    expect(privacySource).toContain("url.pathname !== '/~partytown/partytown-sandbox-sw.html'");
    expect(privacySource).toContain('PARTYTOWN_SANDBOX_SEARCH.test(url.search)');
    expect(manualSpec).toContain('|| partytownSandboxDocument');
  });

  it('uses the production unsupported-answer prefix without a loose abstention regex', () => {
    const manualSpec = readRequired(MANUAL_SPEC_PATH);

    expect(manualSpec).toContain('JETS_GHOST_ABSTENTION_PREFIX');
    expect(manualSpec).toContain('response.trimStart().startsWith(abstentionPrefix)');
    expect(manualSpec).not.toContain("not available|not in|unable");
  });

  it('keeps citation diagnostics categorical without retaining answer content', () => {
    const manualSpec = readRequired(MANUAL_SPEC_PATH);

    expect(manualSpec).toContain('CASE_EXPECTED_SOURCE_MISSING');
    expect(manualSpec).toContain('CASE_UNACCEPTABLE_SOURCE');
    expect(manualSpec).toContain('CASE_INLINE_CITATION_MISSING');
    expect(manualSpec).toContain('CASE_UNSUPPORTED_CITATION_PRESENT');
    expect(manualSpec).not.toContain('CASE_CITATION_BOUNDARY_FAILED');
  });

  it('reserves complete expected-source coverage for the cross-document case', () => {
    const manualSpec = readRequired(MANUAL_SPEC_PATH);

    expect(manualSpec).toContain(
      "const requiresEveryExpectedSource = acceptanceCase.category === 'cross-document';",
    );
    expect(manualSpec).toContain(
      'const expectedSourceMissing = requiresEveryExpectedSource',
    );
    expect(manualSpec).toContain(
      ': !expectedPaths.some((path) => observedSourcePaths.includes(path));',
    );
  });

  it('times every exact pinned model root through the last terminal transfer', () => {
    const manualSpec = readRequired(MANUAL_SPEC_PATH);

    expect(manualSpec).toContain('const modelRoots = observations.filter');
    expect(manualSpec).toContain('Math.min(...modelRoots.map');
    expect(manualSpec).toContain('Math.max(...modelTerminals.map');
    expect(manualSpec).toContain('modelTransferFinishedAt');
  });

  it('separates cold-loading observations instead of catching up to stale activation boundaries', () => {
    const manualSpec = readRequired(MANUAL_SPEC_PATH);

    expect(manualSpec).toContain('const LOADING_OBSERVATION_INTERVAL_MS = 12_000;');
    expect(manualSpec).toContain('page.waitForTimeout(LOADING_OBSERVATION_INTERVAL_MS)');
    expect(manualSpec).not.toContain('activationStartedAt + boundary');
    expect(manualSpec).toContain(
      'performance.now() - activationStartedAt >= LOADING_REASSURANCE_AFTER_MS',
    );
  });

  it('foregrounds and polls real loading motion through browser throttling', () => {
    const manualSpec = readRequired(MANUAL_SPEC_PATH);

    expect(manualSpec).toContain('const LOADING_MOTION_TIMEOUT_MS = 3_000;');
    expect(manualSpec).toMatch(/if \(!reducedMotion\) \{\s+await page\.bringToFront\(\);/u);
    expect(manualSpec).toContain('await expect.poll(async () => {');
    expect(manualSpec).toContain("message: 'LOADING_PHASE_MOTION_NOT_CHANGING'");
    expect(manualSpec).toContain('intervals: [200, 400, 800, 1_200],');
    expect(manualSpec).toContain('timeout: LOADING_MOTION_TIMEOUT_MS');
    expect(manualSpec).toContain('if (becameReadyDuringMotionPoll) break;');
    expect(manualSpec).not.toContain('await page.waitForTimeout(400);');
  });

  it('uses one bounded model-readiness wait for every activation path', () => {
    const manualSpec = readRequired(MANUAL_SPEC_PATH);

    expect(manualSpec).toContain('const ACTIVATION_READY_TIMEOUT_MS = 5 * 60_000;');
    expect(manualSpec).toMatch(
      /async function waitForActivationReady\(page: Page\): Promise<void> \{[\s\S]*?toBeEnabled\(\{[\s\S]*?timeout: ACTIVATION_READY_TIMEOUT_MS,[\s\S]*?\}\);[\s\S]*?\}/u,
    );
    expect(manualSpec.match(/waitForActivationReady\(page\);/g)).toHaveLength(3);
    expect(manualSpec).toMatch(
      /const activationReady = waitForActivationReady\(page\);\s+if \(options\.sampleLoading\) \{\s+await Promise\.all\(\[\s+activationReady,\s+observeColdLoading\(page, startedAt, activationReady\),\s+\]\);\s+\} else \{\s+await activationReady;\s+\}/u,
    );
    expect(manualSpec).toMatch(
      /async function observeColdLoading\([\s\S]*?activationReady: Promise<void>[\s\S]*?Promise\.race\(\[\s+activationReady\.then\(\(\) => true\),/u,
    );
    expect(manualSpec).toContain('await expect(loadButton).toBeEnabled();');
  });

  it('bounds local generation while preserving completion and closeout assertions', () => {
    const manualSpec = readRequired(MANUAL_SPEC_PATH);

    expect(manualSpec).toContain('const FIRST_TOKEN_TIMEOUT_MS = 2 * 60_000;');
    expect(manualSpec).toContain('const RESPONSE_COMPLETION_TIMEOUT_MS = 5 * 60_000;');
    expect(manualSpec).toMatch(
      /async function runProductCase\([\s\S]*?expect\.poll\(\(\) => responseHasFirstToken\(page\), \{\s+timeout: FIRST_TOKEN_TIMEOUT_MS,\s+\}\)\.toBe\(true\);[\s\S]*?getByTestId\('lifecycle-visible-status'\)\)\.toContainText\('Ready', \{\s+timeout: RESPONSE_COMPLETION_TIMEOUT_MS,\s+\}\);[\s\S]*?const totalResponseMs/u,
    );
    expect(manualSpec).toMatch(
      /async function qualificationCloseout\([\s\S]*?getByRole\('button', \{ name: 'Stop response' \}\)\)\.toBeVisible\(\{\s+timeout: FIRST_TOKEN_TIMEOUT_MS,\s+\}\);[\s\S]*?getByText\('Stopped', \{ exact: true \}\)\)\.toBeVisible\(\{\s+timeout: RESPONSE_COMPLETION_TIMEOUT_MS,\s+\}\);[\s\S]*?getByTestId\('lifecycle-visible-status'\)\)\.toContainText\('Ready', \{\s+timeout: RESPONSE_COMPLETION_TIMEOUT_MS,\s+\}\);/u,
    );
  });

  it('pauses every completed product case before aggregating case failures', () => {
    const manualSpec = readRequired(MANUAL_SPEC_PATH);

    expect(manualSpec).toContain('const caseFailures: string[] = [];');
    expect(manualSpec).toContain("caseFailures.push('CASE_SOURCE_HREF_MISSING')");
    expect(manualSpec).toContain("caseFailures.push('CASE_SOURCE_HREF_MALFORMED')");
    expect(manualSpec).toContain("caseFailures.push('CASE_SOURCE_TARGET_INVALID')");
    expect(manualSpec).toContain("caseFailures.push('CASE_SOURCE_REL_INVALID')");
    expect(manualSpec).toContain("caseFailures.push('CASE_EXPECTED_SOURCE_MISSING')");
    expect(manualSpec).toContain("caseFailures.push('CASE_UNACCEPTABLE_SOURCE')");
    expect(manualSpec).toContain("caseFailures.push('CASE_INLINE_CITATION_MISSING')");
    expect(manualSpec).toContain("caseFailures.push('CASE_UNSUPPORTED_CITATION_PRESENT')");
    expect(manualSpec).toContain("caseFailures.push('CASE_ABSTENTION_MISSING')");
    expect(manualSpec).not.toContain('CASE_REVIEW_EVALUATION_FAILED');
    expect(manualSpec).toMatch(/finally \{\s+await page\.pause\(\);\s+\}\s+return caseFailures;/u);
    expect(manualSpec).toMatch(/productCaseFailures\.push\(\.\.\.\(await runProductCase/u);
    expect(manualSpec).toContain('PRODUCT_CASES_FAILED_');
  });

  it('checks every compatibility activation boundary before loading resources', () => {
    const manualSpec = readRequired(MANUAL_SPEC_PATH);

    expect(manualSpec).toContain('): Promise<number> {');
    expect(manualSpec).toContain('return compatibilityMark;');
    expect(manualSpec).toContain('function assertNoAssistantRequestsSince');
    expect(manualSpec).toContain('installConsentAudit');
    expect(manualSpec).toContain('validateConsentAudit');
    expect(manualSpec).toContain('beforeConsent');
    expect(manualSpec).toContain('await expect(loadButton).toBeVisible();');
    expect(manualSpec).toContain('await expect(loadButton).toBeEnabled();');
    expect(manualSpec).toMatch(/loadButton\.evaluate\(\(element\) => \{[\s\S]*?loadInitiated = true;[\s\S]*?element\.click\(\);[\s\S]*?\}\);/u);
    expect(manualSpec.match(/await assertCompatibilityDoesNotLoadAssistant\(/g)).toHaveLength(3);
    expect(manualSpec.match(/await activateWithoutBenchmark\(/g)).toHaveLength(2);
    expect(manualSpec.match(/await clickLoadAfterConsentAudit\(/g)).toHaveLength(3);
    expect(manualSpec.match(/name: \/Load Jet's Ghost\/ \}\)\.click\(\)/g)).toBeNull();
    expect(manualSpec).toContain("'ASSISTANT_REQUEST_BEFORE_LOAD'");
  });

  it('uses one installed-Chrome project with all retained capture disabled', () => {
    const config = readRequired(REAL_MODEL_CONFIG_PATH);

    expect(config.match(/name:\s*'chrome-real-model'/g)).toHaveLength(1);
    expect(config.match(/channel:\s*'chrome'/g)).toHaveLength(1);
    expect(config).toContain("...devices['Desktop Chrome']");
    expect(config).toMatch(/headless:\s*false/u);
    expect(config).toMatch(/trace:\s*'off'/u);
    expect(config).toMatch(/screenshot:\s*'off'/u);
    expect(config).toMatch(/video:\s*'off'/u);
    expect(config).toContain("preserveOutput: 'never',");
    expect(config).not.toMatch(/PUBLIC_JETS_GHOST_E2E|launchPersistentContext|userDataDir/u);
  });

  it('adds only the direct qualification and deployment-smoke commands', () => {
    const packageJson = JSON.parse(readRequired(PACKAGE_PATH)) as {
      scripts: Record<string, string>;
    };
    const qualificationScripts = Object.keys(packageJson.scripts).filter((name) => (
      name.startsWith('qualify:jets-ghost') || name === 'smoke:jets-ghost'
    ));

    expect(qualificationScripts).toEqual([
      'qualify:jets-ghost:mac',
      'smoke:jets-ghost',
    ]);
    expect(packageJson.scripts['qualify:jets-ghost:mac']).toBe(
      'cross-env PLAYWRIGHT_NO_COPY_PROMPT=1 RUN_REAL_MODEL=1 JETS_GHOST_REAL_MODEL_MODE=qualification playwright test --config=playwright.real-model.config.ts --project=chrome-real-model',
    );
    expect(packageJson.scripts['smoke:jets-ghost']).toBe(
      'cross-env PLAYWRIGHT_NO_COPY_PROMPT=1 RUN_REAL_MODEL=1 JETS_GHOST_REAL_MODEL_MODE=smoke playwright test --config=playwright.real-model.config.ts --project=chrome-real-model',
    );
    expect(qualificationScripts.map((name) => packageJson.scripts[name]).join('\n'))
      .not.toMatch(/device(?:-slug|Slug|Matrix)|orchestrat|result(?:-validator|Validator|Path|Schema)|stdin|output/u);
  });
});
