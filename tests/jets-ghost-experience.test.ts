import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  createInitialExperience,
  getComposerActionTone,
  getGhostAnimationMode,
  getLoadingStage,
  transitionExperience,
} from '../src/features/jets-ghost/experience';

test('route entry stays idle until the visitor checks compatibility', () => {
  const state = createInitialExperience();

  assert.equal(state.lifecycle, 'idle');
  assert.equal(state.hasActivatedModel, false);
  assert.equal(state.progress, 0);
});

test('compatibility checking does not activate or download the model', () => {
  const checking = transitionExperience(createInitialExperience(), {
    type: 'check-compatibility',
  });
  const compatible = transitionExperience(checking, {
    type: 'compatibility-passed',
  });

  assert.equal(checking.lifecycle, 'checking');
  assert.equal(checking.hasActivatedModel, false);
  assert.equal(compatible.lifecycle, 'compatible');
  assert.equal(compatible.hasActivatedModel, false);
});

test('only explicit load consent crosses the model activation boundary', () => {
  const idle = createInitialExperience();
  const ignoredMessage = transitionExperience(idle, {
    type: 'send-message',
  });
  const compatible = transitionExperience(
    transitionExperience(
      transitionExperience(idle, { type: 'check-compatibility' }),
      { type: 'compatibility-passed' },
    ),
    { type: 'load-model' },
  );

  assert.equal(ignoredMessage.lifecycle, 'idle');
  assert.equal(ignoredMessage.hasActivatedModel, false);
  assert.equal(compatible.lifecycle, 'loading');
  assert.equal(compatible.hasActivatedModel, true);
});

test('unload returns the experience to a fresh non-activated state', () => {
  const loading = transitionExperience(
    transitionExperience(
      transitionExperience(createInitialExperience(), {
        type: 'check-compatibility',
      }),
      { type: 'compatibility-passed' },
    ),
    { type: 'load-model' },
  );
  const ready = transitionExperience(loading, { type: 'model-ready' });
  const unloaded = transitionExperience(ready, { type: 'unload' });

  assert.equal(ready.lifecycle, 'ready');
  assert.equal(ready.hasActivatedModel, true);
  assert.deepEqual(unloaded, createInitialExperience());
});

test('ghost animation follows every lifecycle context including loading', () => {
  assert.equal(getGhostAnimationMode('idle'), 'idle');
  assert.equal(getGhostAnimationMode('checking'), 'scanning');
  assert.equal(getGhostAnimationMode('compatible'), 'ready');
  assert.equal(getGhostAnimationMode('loading'), 'loading');
  assert.equal(getGhostAnimationMode('ready'), 'ready');
  assert.equal(getGhostAnimationMode('generating'), 'thinking');
});

test('loading stages stay model-agnostic and on theme', () => {
  assert.equal(getLoadingStage(0), 'Waking the ghost');
  assert.equal(getLoadingStage(20), 'Feeding it ones and zeroes');
  assert.equal(getLoadingStage(82), "Haunting Jet's archive");
  assert.equal(getLoadingStage(96), 'Ready for questions');
});

test('mustard is reserved for a valid send action', () => {
  assert.equal(getComposerActionTone(false, false), 'neutral');
  assert.equal(getComposerActionTone(false, true), 'accent');
  assert.equal(getComposerActionTone(true, false), 'stop');
  assert.equal(getComposerActionTone(true, true), 'stop');
});

test('immersive chat layout uses Utopia type and spacing tokens', () => {
  const experienceSource = readFileSync(
    new URL('../src/features/jets-ghost/JetsGhostExperience.tsx', import.meta.url),
    'utf8',
  );
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
  const experienceSource = readFileSync(
    new URL('../src/features/jets-ghost/JetsGhostExperience.tsx', import.meta.url),
    'utf8',
  );

  assert.match(
    experienceSource,
    /<h1 className="[^"]*text-2xl[^"]*min-\[370px\]:whitespace-nowrap[^"]*">What are you curious about\?<\/h1>/,
  );
  assert.match(
    experienceSource,
    /<p className="[^"]*text-xs[^"]*min-\[370px\]:whitespace-nowrap[^"]*">\s*Ask about Jet&apos;s writing, research, projects, or ideas\./,
  );
});
