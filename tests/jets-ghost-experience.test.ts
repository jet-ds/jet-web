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
const canonicalStatusDocs = [
  [
    'experience note',
    readFileSync(
      new URL('../docs/jets-ghost-chat-experience.md', import.meta.url),
      'utf8',
    ),
  ],
  [
    'architecture design',
    readFileSync(
      new URL(
        '../docs/superpowers/specs/2026-07-11-jets-ghost-local-assistant-design.md',
        import.meta.url,
      ),
      'utf8',
    ),
  ],
  [
    'implementation plan',
    readFileSync(
      new URL(
        '../docs/superpowers/plans/2026-07-11-jets-ghost-local-assistant.md',
        import.meta.url,
      ),
      'utf8',
    ),
  ],
] as const;

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

test('content-sized lifecycle status precedes stable conversational header actions', () => {
  assert.doesNotMatch(experienceSource, /lifecycle-status-slot/);
  const statusSource = experienceSource.match(
    /function LifecycleStatus[\s\S]*?\n}\n/,
  )?.[0] ?? '';
  assert.match(
    statusSource,
    /data-testid="lifecycle-visible-status"[\s\S]*?className="[^"]*w-fit[^"]*"/,
  );
  const visibleStatusClass = statusSource.match(
    /data-testid="lifecycle-visible-status"[\s\S]*?className="([^"]*)"/,
  )?.[1] ?? '';
  assert.doesNotMatch(
    visibleStatusClass,
    /(?:^|\s)(?:min-w-|w-(?:\[|\d)|h-(?:\[|\d)|border(?:-\S+)?|bg-\S+|rounded\S*|shadow\S*|p[trblxy]?-\S+)(?:\s|$)/,
  );
  assert.match(visibleStatusClass, /(?:^|\s)w-fit(?:\s|$)/);
  assert.doesNotMatch(experienceSource, /LifecycleCapsule|lifecycle-capsule/);
  assert.match(
    experienceSource,
    /const showHeaderActions = \[[\s\S]*?'ready'[\s\S]*?'generating'[\s\S]*?'cancelling'[\s\S]*?'generation-error'[\s\S]*?'resetting'[\s\S]*?'reset-error'[\s\S]*?'unloading'[\s\S]*?'unload-error'[\s\S]*?\]\.includes\(status\);/,
  );
  assert.match(experienceSource, /const canStartNewSession = status === 'ready'[\s\S]*?conversation-limit-reached/);
  assert.match(experienceSource, /const canUnload = showHeaderActions && status !== 'unloading';/);
  assert.doesNotMatch(experienceSource, /{status === 'ready' && \(/);
  assert.match(
    experienceSource,
    /<LifecycleStatus status={status} \/>[\s\S]*?{showHeaderActions && \([\s\S]*?disabled={!canStartNewSession}[\s\S]*?>New session<[\s\S]*?disabled={!canUnload}[\s\S]*?>Unload</,
  );
  assert.match(statusSource, /<AnimatePresence initial={false}>/);
  assert.match(statusSource, /key={compactLabel}/);
  assert.match(statusSource, /<span className="grid h-4 overflow-hidden">/);
  assert.match(
    statusSource,
    /className="col-start-1 row-start-1 flex items-center whitespace-nowrap motion-reduce:transition-none"/,
  );
  assert.doesNotMatch(statusSource, /invisible block whitespace-nowrap/);
  assert.match(statusSource, /initial={{ opacity: 0 }}/);
  assert.match(statusSource, /exit={{ opacity: 0 }}/);
  assert.match(statusSource, /{prefersReducedMotion \? \(/);
  assert.match(statusSource, /data-testid="lifecycle-visual-label"/);
});

test('lifecycle announcement is separate from the visual status and percentages stay absent', () => {
  assert.match(
    experienceSource,
    /data-testid="lifecycle-visible-status"[\s\S]*?aria-hidden="true"/,
  );
  assert.match(
    experienceSource,
    /data-testid="lifecycle-announcement"[\s\S]*?role="status"[\s\S]*?aria-live="polite"[\s\S]*?aria-atomic="true"/,
  );
  assert.doesNotMatch(
    experienceSource,
    /data-testid="lifecycle-(?:status-slot|visible-status)"[^>]*aria-live/,
  );
  assert.doesNotMatch(experienceSource, /getLifecycleLabel\(status\)[\s\S]{0,80}%/);
});

test('canonical docs require a chrome-free status group and no capsule or pill terminology', () => {
  for (const [name, source] of canonicalStatusDocs) {
    assert.match(source, /chrome-free status group/i, `${name} must name the approved treatment`);
    assert.doesNotMatch(source, /\b(?:capsule|pill)\b/i, `${name} retains superseded chrome terminology`);
    assert.doesNotMatch(source, /7\.5rem|fixed[^.]{0,40}status slot/i, `${name} retains the removed slot`);
    assert.match(source, /status group[^.]*before[^.]*stable header actions/i);
    assert.match(source, /keyboard hint/i);
    assert.match(source, /Local only/);
  }

  const implementationPlan = canonicalStatusDocs[2][1];
  assert.match(
    implementationPlan,
    /computed border, background, shadow, radius, and padding[^.]*absent, zero, or transparent/i,
  );
  assert.match(
    implementationPlan,
    /desktop and (?:representative )?mobile[^.]*Ready[^.]*Responding[^.]*action x\/y\/width\/height[^.]*1px/i,
  );
  assert.match(implementationPlan, /no artificial gap beyond[^.]*gap-2xs/i);
  assert.match(implementationPlan, /430px touch[^.]*display[^.]*none/i);
  assert.match(implementationPlan, /desktop keyboard[^.]*both[^.]*one line/i);
});

test('canonical docs carry reliability, modality, and citation-only footer correctness into Task 10', () => {
  for (const [name, source] of canonicalStatusDocs) {
    assert.match(
      source,
      /Jet’s Ghost can make mistakes\. Check cited sources\./,
      `${name} must preserve the exact pre-message reliability copy`,
    );
    assert.match(source, /interaction modality/i, `${name} must define modality-aware focus`);
    assert.match(source, /canonicalUrl/i, `${name} must define document-level citation deduplication`);
  }

  const architectureDesign = canonicalStatusDocs[1][1];
  assert.match(architectureDesign, /footer[^.]*completed or stopped turn[^.]*validated citations/i);
  assert.match(architectureDesign, /zero cited documents[^.]*no footer/i);

  const implementationPlan = canonicalStatusDocs[2][1];
  assert.match(
    implementationPlan,
    /430px touch[^.]*many selected context chunks[^.]*\[S1\][^.]*exactly one document source item/i,
  );
  assert.match(implementationPlan, /source footer[^.]*does not overlap[^.]*composer/i);
  assert.match(implementationPlan, /pointer[^.]*immediate blur/i);
  assert.match(implementationPlan, /touch-origin Enter[^.]*virtual-keyboard/i);
});

test('canonical docs require accessible CSS clamping for long cited-source titles', () => {
  for (const [name, source] of canonicalStatusDocs) {
    assert.match(source, /source prefix[^.]*first line/i, `${name} must anchor the source prefix`);
    assert.match(source, /line-clamp-2/i, `${name} must require two touch lines`);
    assert.match(source, /line-clamp-1/i, `${name} must require one desktop line`);
    assert.match(source, /aria-label[^.]*full source title/i, `${name} must preserve the accessible title`);
    assert.match(source, /native `title` attribute[^.]*full source title/i, `${name} must preserve hover text`);
    assert.match(source, /no (?:JavaScript|JS)[^.]*truncation/i, `${name} must prohibit string truncation`);
  }

  const implementationPlan = canonicalStatusDocs[2][1];
  assert.match(
    implementationPlan,
    /The Recursive Convergence Hypothesis: Emergent Sentience as a Structural Attractor of Recursive ASI/,
  );
  assert.match(implementationPlan, /430px touch[^.]*two rendered lines/i);
  assert.match(implementationPlan, /desktop[^.]*one rendered line/i);
});

test('composer metadata removes the keyboard hint on touch layouts without a placeholder', () => {
  assert.match(
    experienceSource,
    /data-testid="composer-metadata"[\s\S]*?className="[^"]*justify-end[^"]*min-\[768px\]:\[@media\(pointer:fine\)\]:justify-between[^"]*"/,
  );
  assert.match(
    experienceSource,
    /data-testid="composer-keyboard-hint"[\s\S]*?className="[^"]*hidden[^"]*min-\[768px\]:\[@media\(pointer:fine\)\]:inline[^"]*"[\s\S]*?>Enter sends · Shift\+Enter newline</,
  );
  assert.match(
    experienceSource,
    /data-testid="composer-local-only"[\s\S]*?>[\s\S]*?Local only/,
  );
  const metadataSource = experienceSource.match(
    /<div\s+data-testid="composer-metadata"[\s\S]*?<\/div>/,
  )?.[0] ?? '';
  assert.doesNotMatch(metadataSource, /invisible|opacity-0|grid-cols|placeholder/);
});

test('pre-message reliability disclosure sits directly above the composer form without reserved space', () => {
  const composerSource = experienceSource.match(
    /function Composer[\s\S]*?\n}\n\ninterface AnimatedGhostProps/,
  )?.[0] ?? '';
  assert.match(
    composerSource,
    /{showReliabilityDisclosure && \([\s\S]*?data-testid="composer-reliability-disclosure"[\s\S]*?>Jet’s Ghost can make mistakes\. Check cited sources\.<[\s\S]*?\)}[\s\S]*?<form[\s\S]*?data-testid="composer-metadata"/,
  );
  assert.doesNotMatch(
    composerSource.match(/showReliabilityDisclosure[\s\S]*?<form/)?.[0] ?? '',
    /invisible|opacity-0|min-h-|placeholder|aria-hidden/,
  );
  assert.match(experienceSource, /showReliabilityDisclosure={!hasSubmittedInSession}/);
});

test('focus follows interaction modality and response scrolling stays inside the conversation', () => {
  assert.match(experienceSource, /onPointerDownCapture={handlePointerDownCapture}/);
  assert.match(experienceSource, /onKeyDownCapture={handleInteractionKeyDownCapture}/);
  assert.match(experienceSource, /composerFocusModalityRef\.current === 'touch'[\s\S]*?'pen'/);
  assert.match(experienceSource, /messageSubmissionModalityRef\.current = submissionModality/);
  assert.match(experienceSource, /submissionModality !== 'keyboard'[\s\S]*?inputRef\.current\?\.blur\(\)/);
  assert.match(experienceSource, /readyFocusModalityRef\.current = lastInteractionModalityRef\.current/);
  assert.match(experienceSource, /data-testid="conversation-scroller"/);
  assert.match(experienceSource, /data-testid="conversation-end-sentinel"/);
  assert.match(experienceSource, /conversationScrollerRef\.current[\s\S]*?scrollTop = scroller\.scrollHeight/);
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
  assert.match(experienceSource, /getCitedDocumentSources\(turn\.citations\)/);
  assert.doesNotMatch(experienceSource, /turn\.sources/);
  assert.match(experienceSource, /citedDocumentSources\.map/);
  assert.match(experienceSource, /citedDocumentSources\.length > 0 \|\| turn\.stopped/);
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

test('long cited-source titles clamp in CSS without losing accessible text', () => {
  const footerSource = experienceSource.match(
    /function ResponseSourceFooter[\s\S]*?\n}\n\ninterface ErrorRecoveryProps/,
  )?.[0] ?? '';

  assert.match(
    footerSource,
    /className="[^"]*inline-flex[^"]*max-w-full[^"]*min-w-0[^"]*items-start[^"]*focus:ring-2[^"]*"/,
  );
  assert.match(footerSource, /aria-label={`\${id\.slice\(1\)} · \${source\.title}`}/);
  assert.match(footerSource, /title={source\.title}/);
  assert.match(
    footerSource,
    /data-testid="response-source-prefix"[\s\S]*?className="[^"]*shrink-0[^"]*"[\s\S]*?>\s*{id\.slice\(1\)} ·\s*</,
  );
  assert.match(
    footerSource,
    /data-testid="response-source-title"[\s\S]*?className="[^"]*min-w-0[^"]*overflow-hidden[^"]*line-clamp-2[^"]*min-\[768px\]:\[@media\(pointer:fine\)\]:line-clamp-1[^"]*"[\s\S]*?>\s*{source\.title}\s*</,
  );
  assert.doesNotMatch(footerSource, /source\.title\.(?:slice|substring)\(/);
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
  assert.match(experienceSource, /searchParams\.get\('stream'\)\s*===\s*'slow'/);
  assert.match(experienceSource, /slowFakeStream[\s\S]*?scheduler:/);
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
