import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  getComposerActionTone,
  getGhostAnimationMode,
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

test('production lifecycle presentation begins idle and separates compatibility from consent', () => {
  assert.equal(getLifecycleLabel('idle'), 'Not running');
  assert.equal(getLifecycleLabel('checking-capabilities'), 'Checking this browser');
  assert.equal(getLifecycleLabel('awaiting-consent'), 'Ready to load');
  assert.match(experienceSource, />\s*Check compatibility\s*</);
  assert.match(experienceSource, />\s*Load Jet&apos;s Ghost · about 2 GB\s*</);
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

test('ordinary production build metadata never enables the fake runtime', () => {
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
});
