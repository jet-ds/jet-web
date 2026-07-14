import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  getComposerActionTone,
  getGhostAnimationMode,
  getLifecycleAnnouncement,
  getLifecycleLabel,
  getLoadingStage,
  shouldFocusComposer,
} from '../src/features/jets-ghost/experience';

const experienceSource = readFileSync(
  new URL('../src/features/jets-ghost/JetsGhostExperience.tsx', import.meta.url),
  'utf8',
);
const mappingSource = readFileSync(
  new URL('../src/features/jets-ghost/experience.ts', import.meta.url),
  'utf8',
);
const productionArtifactVerifierSource = readFileSync(
  new URL('../scripts/verify-production-artifacts.ts', import.meta.url),
  'utf8',
);
const buildPurityVerifierSource = readFileSync(
  new URL('../scripts/verify-build-purity.ts', import.meta.url),
  'utf8',
);

const lifecyclePresentation = [
  ['idle', 'Not running', "Jet's Ghost is not running."],
  ['checking-capabilities', 'Checking', "Checking whether this browser can run Jet's Ghost."],
  ['awaiting-consent', 'Load ready', "Compatibility check complete. Jet's Ghost is ready to load."],
  ['unsupported', 'Not running', "This browser cannot run Jet's Ghost."],
  ['loading', 'Loading', "Jet's Ghost is loading on this device."],
  ['load-error', 'Not running', "Jet's Ghost did not finish loading. Review the recovery action."],
  ['ready', 'Ready', "Jet's Ghost is ready."],
  ['generating', 'Responding', "Jet's Ghost is responding."],
  ['cancelling', 'Responding', 'Stopping the current response.'],
  ['generation-error', 'Ready', 'The response was interrupted. Review the recovery action.'],
  ['resetting', 'Ready', "Starting a new Jet's Ghost session."],
  ['reset-error', 'Ready', 'The new session did not start. Review the recovery action.'],
  ['unloading', 'Not running', "Unloading Jet's Ghost from this device."],
  ['unload-error', 'Not running', "Jet's Ghost did not finish unloading. Review the recovery action."],
] as const;

test('every lifecycle state maps to one approved compact label and a fuller announcement', () => {
  const compactLabels = new Set([
    'Not running',
    'Checking',
    'Load ready',
    'Loading',
    'Ready',
    'Responding',
  ]);

  for (const [status, label, announcement] of lifecyclePresentation) {
    assert.equal(getLifecycleLabel(status), label);
    assert.equal(getLifecycleAnnouncement(status), announcement);
    assert.ok(compactLabels.has(label));
    assert.notEqual(announcement, label);
  }
  assert.deepEqual(
    new Set(lifecyclePresentation.map(([, label]) => label)),
    compactLabels,
  );
});

test('production lifecycle presentation begins idle and separates compatibility from consent', () => {
  assert.match(experienceSource, />\s*Check compatibility\s*</);
  assert.match(experienceSource, />\s*Load Jet&apos;s Ghost · about 2 GB\s*</);
});

test('lifecycle slot stays fixed while the right-anchored visible capsule fits its label', () => {
  assert.match(
    experienceSource,
    /data-testid="lifecycle-status-slot"[\s\S]*?className="[^"]*h-10[^"]*w-\[7\.5rem\][^"]*justify-end[^"]*"/,
  );
  const capsuleSource = experienceSource.match(
    /function LifecycleCapsule[\s\S]*?\n}\n/,
  )?.[0] ?? '';
  assert.match(
    capsuleSource,
    /data-testid="lifecycle-capsule"[\s\S]*?className="[^"]*w-fit[^"]*"/,
  );
  const visibleCapsuleClass = capsuleSource.match(
    /data-testid="lifecycle-capsule"[\s\S]*?className="([^"]*)"/,
  )?.[1] ?? '';
  assert.doesNotMatch(visibleCapsuleClass, /(?:^|\s)min-w-|(?:^|\s)w-(?:\[|\d)/);
  assert.match(visibleCapsuleClass, /(?:^|\s)w-fit(?:\s|$)/);
  assert.match(capsuleSource, /<AnimatePresence initial={false}>/);
  assert.match(capsuleSource, /key={compactLabel}/);
  assert.match(capsuleSource, /<span className="grid h-4 overflow-hidden">/);
  assert.match(
    capsuleSource,
    /className="col-start-1 row-start-1 flex items-center whitespace-nowrap motion-reduce:transition-none"/,
  );
  assert.doesNotMatch(capsuleSource, /invisible block whitespace-nowrap/);
  assert.match(capsuleSource, /initial={{ opacity: 0 }}/);
  assert.match(capsuleSource, /exit={{ opacity: 0 }}/);
  assert.match(capsuleSource, /{prefersReducedMotion \? \(/);
  assert.match(capsuleSource, /data-testid="lifecycle-visual-label"/);
});

test('lifecycle announcement is separate from the visual capsule and percentages stay absent', () => {
  assert.match(
    experienceSource,
    /data-testid="lifecycle-status-slot"[\s\S]*?aria-hidden="true"/,
  );
  assert.match(
    experienceSource,
    /data-testid="lifecycle-announcement"[\s\S]*?role="status"[\s\S]*?aria-live="polite"[\s\S]*?aria-atomic="true"/,
  );
  assert.doesNotMatch(
    experienceSource,
    /data-testid="lifecycle-(?:status-slot|capsule)"[^>]*aria-live/,
  );
  assert.doesNotMatch(experienceSource, /getLifecycleLabel\(status\)[\s\S]{0,80}%/);
});

test('approved disclosure and production actions replace prototype simulation', () => {
  assert.match(
    experienceSource,
    /Jet&apos;s Ghost runs Gemma 4 E2B in this browser\. Starting it downloads about 2 GB and may use substantial GPU memory\. Your prompts and responses stay on this device\./,
  );
  assert.match(experienceSource, /ghost\.checkCompatibility/);
  assert.match(experienceSource, /ghost\.load/);
  assert.match(experienceSource, /ghost\.sendMessage/);
  assert.match(experienceSource, /ghost\.startNewSession/);
  assert.match(experienceSource, /ghost\.unload/);
  assert.doesNotMatch(experienceSource, /setTimeout|makePreviewResponse|interface preview has reached/);
  assert.doesNotMatch(mappingSource, /transitionExperience|createInitialExperience|hasActivatedModel/);
});

test('ghost animation follows every lifecycle context including loading', () => {
  assert.equal(getGhostAnimationMode('idle'), 'idle');
  assert.equal(getGhostAnimationMode('checking-capabilities'), 'scanning');
  assert.equal(getGhostAnimationMode('awaiting-consent'), 'ready');
  assert.equal(getGhostAnimationMode('loading'), 'loading');
  assert.equal(getGhostAnimationMode('ready'), 'ready');
  assert.equal(getGhostAnimationMode('generating'), 'thinking');
  assert.equal(getGhostAnimationMode('cancelling'), 'thinking');
});

test('loading stages stay model-agnostic and on theme', () => {
  assert.equal(getLoadingStage('corpus'), "Haunting Jet's archive");
  assert.equal(getLoadingStage('runtime'), 'Waking the ghost');
  assert.equal(getLoadingStage('model'), 'Feeding it ones and zeroes');
  assert.doesNotMatch(experienceSource, /experience\.progress|progressSteps|%<\/span>/);
  assert.match(experienceSource, /elapsedSeconds/);
});

test('mustard is reserved for a valid send action', () => {
  assert.equal(getComposerActionTone(false, false), 'neutral');
  assert.equal(getComposerActionTone(false, true), 'accent');
  assert.equal(getComposerActionTone(true, false), 'stop');
  assert.equal(getComposerActionTone(true, true), 'stop');
});

test('immersive chat layout uses Utopia type and spacing tokens', () => {
  const routeSource = readFileSync(
    new URL('../src/pages/tools/chatbot.astro', import.meta.url),
    'utf8',
  );

  assert.doesNotMatch(experienceSource, /sm:text-5xl/);
  assert.doesNotMatch(experienceSource, /5\.75rem|1\.25rem_3rem/);
  assert.match(experienceSource, /var\(--space-xl\)/);
  assert.match(experienceSource, /var\(--space-m\)/);
  assert.doesNotMatch(routeSource, /7\.25rem|6\.75rem/);
  assert.match(routeSource, /var\(--space-2xl\)/);
  assert.match(routeSource, /var\(--space-xl\)/);
});

test('ready prompt stays on one line at the annotated mobile width', () => {
  assert.match(
    experienceSource,
    /<h1 className="[^"]*text-2xl[^"]*min-\[370px\]:whitespace-nowrap[^"]*">What are you curious about\?<\/h1>/,
  );
  assert.match(
    experienceSource,
    /<p className="[^"]*text-xs[^"]*min-\[370px\]:whitespace-nowrap[^"]*">\s*Ask about Jet&apos;s writing, research, projects, or ideas\./,
  );
});

test('chat accessibility and sources are response-local', () => {
  assert.match(experienceSource, /aria-live="polite"/);
  assert.match(experienceSource, /turn\.citations\.map/);
  assert.match(experienceSource, /turn\.sources\.map/);
  assert.match(experienceSource, />Stopped</);
  assert.match(experienceSource, /'Start new session'/);
  assert.match(experienceSource, /errorActionRef/);
  assert.match(experienceSource, /getLifecycleAnnouncement\(status\)/);
  assert.match(
    experienceSource,
    /<div>\s*<p className="mb-2xs[^"]*">[\s\S]*?<\/div>\s*<p className="mt-xs text-xs text-text-tertiary">\s*Elapsed/,
  );
  assert.equal(shouldFocusComposer('generating', 'ready'), true);
  assert.equal(shouldFocusComposer('cancelling', 'ready'), true);
  assert.equal(shouldFocusComposer('loading', 'ready'), true);
  assert.equal(shouldFocusComposer('ready', 'ready'), false);
});

test('test-build fake runtime requires the flag, local host, and explicit query', () => {
  const playwrightSource = readFileSync(
    new URL('../playwright.config.ts', import.meta.url),
    'utf8',
  );

  assert.match(experienceSource, /PUBLIC_JETS_GHOST_E2E\s*===\s*'1'/);
  assert.match(experienceSource, /127\.0\.0\.1/);
  assert.match(experienceSource, /localhost/);
  assert.match(experienceSource, /searchParams\.get\('runtime'\)\s*===\s*'fake'/);
  assert.match(playwrightSource, /cross-env PUBLIC_JETS_GHOST_E2E=1 npm run build/);
});

test('ordinary production verification scans emitted artifacts for the fake runtime seam', () => {
  const packageJson = JSON.parse(readFileSync(
    new URL('../package.json', import.meta.url),
    'utf8',
  )) as { scripts: Record<string, string> };
  const productionPlaywrightSource = readFileSync(
    new URL('../playwright.production.config.ts', import.meta.url),
    'utf8',
  );

  assert.doesNotMatch(packageJson.scripts.build, /PUBLIC_JETS_GHOST_E2E/);
  assert.doesNotMatch(productionPlaywrightSource, /PUBLIC_JETS_GHOST_E2E|runtime=fake|__JETS_GHOST_E2E__/);
  assert.match(packageJson.scripts.verify, /verify:production-artifacts/);
  assert.match(buildPurityVerifierSource, /delete environment\.PUBLIC_JETS_GHOST_E2E/);
  assert.match(buildPurityVerifierSource, /assertProductionArtifactsContainNoFakeRuntime/);
  for (const marker of [
    'FakeRuntime',
    'runtime=fake',
    '__JETS_GHOST_E2E__',
    "Jet's published work connects local-first AI with systems thinking [S1].",
  ]) {
    assert.match(productionArtifactVerifierSource, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
});
