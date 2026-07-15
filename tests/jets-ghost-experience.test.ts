import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  getComposerActionTone,
  getGhostAnimationMode,
  getLifecycleAnnouncement,
  getLifecycleLabel,
  getLoadingHeadline,
  getLoadingReassurance,
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

test('canonical docs carry reliability, modality, and collapsed-source correctness into Task 10', () => {
  for (const [name, source] of canonicalStatusDocs) {
    assert.match(
      source,
      /Jet’s Ghost can make mistakes\. Check cited sources\./,
      `${name} must preserve the exact pre-message reliability copy`,
    );
    assert.match(source, /interaction modality/i, `${name} must define modality-aware focus`);
    assert.match(source, /canonicalUrl/i, `${name} must define document-level citation deduplication`);
    assert.match(source, /collapsed source disclosure/i, `${name} must define the approved disclosure`);
  }

  const architectureDesign = canonicalStatusDocs[1][1];
  assert.match(architectureDesign, /completed or stopped turn[^.]*validated citations/i);
  assert.match(architectureDesign, /zero cited documents[^.]*no disclosure/i);
  assert.match(architectureDesign, /default[^.]*collapsed/i);

  const implementationPlan = canonicalStatusDocs[2][1];
  assert.match(
    implementationPlan,
    /430px touch[^.]*many selected context chunks[^.]*\[S1\][^.]*exactly one document source item/i,
  );
  assert.match(implementationPlan, /source disclosure[^.]*does not overlap[^.]*composer/i);
  assert.match(implementationPlan, /pointer[^.]*immediate blur/i);
  assert.match(implementationPlan, /touch-origin Enter[^.]*virtual-keyboard/i);
});

test('canonical docs require an accessible responsive source disclosure', () => {
  for (const [name, source] of canonicalStatusDocs) {
    assert.match(source, /1 source[^.]*N sources/i, `${name} must define count-aware copy`);
    assert.match(source, /aria-expanded[^.]*aria-controls/i, `${name} must define disclosure semantics`);
    assert.match(source, /44px/i, `${name} must preserve the mobile touch target`);
    assert.match(source, /full document title/i, `${name} must preserve complete source titles`);
    assert.match(source, /no[^.]*truncation/i, `${name} must prohibit title truncation`);
  }

  const implementationPlan = canonicalStatusDocs[2][1];
  assert.match(
    implementationPlan,
    /The Recursive Convergence Hypothesis: Emergent Sentience as a Structural Attractor of Recursive ASI/,
  );
  assert.match(implementationPlan, /320px[^.]*430px/i);
  assert.match(implementationPlan, /tablet[^.]*portrait[^.]*landscape/i);
  assert.match(implementationPlan, /desktop[^.]*compact trigger/i);
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
  assert.match(experienceSource, /const isTouchOriginComposerKeyDown = event\.target === inputRef\.current/);
  assert.doesNotMatch(
    experienceSource.match(/const handleInteractionKeyDownCapture[\s\S]*?\n  };/)?.[0] ?? '',
    /event\.key === 'Enter'/,
  );
  assert.match(experienceSource, /messageSubmissionModalityRef\.current = submissionModality/);
  assert.match(experienceSource, /submissionModality !== 'keyboard'[\s\S]*?inputRef\.current\?\.blur\(\)/);
  assert.match(experienceSource, /readyFocusModalityRef\.current = lastInteractionModalityRef\.current/);
  assert.match(experienceSource, /data-testid="conversation-scroller"/);
  assert.match(experienceSource, /data-testid="conversation-end-sentinel"/);
  assert.match(experienceSource, /onScroll={handleConversationScroll}/);
  assert.match(experienceSource, /STICKY_FOLLOW_THRESHOLD_PX = 48/);
  assert.match(experienceSource, /stickyFollowRef\.current/);
  assert.match(experienceSource, /pendingSubmissionFollowRef\.current/);
  assert.match(experienceSource, /window\.visualViewport/);
  assert.match(experienceSource, /addEventListener\('resize', queueAfterViewportSettles\)/);
  assert.match(experienceSource, />\s*Jump to latest\s*</);
  assert.match(experienceSource, /prefersReducedMotion \? 'auto' : 'smooth'/);
  const turnFollowEffect = experienceSource.match(
    /useEffect\(\(\) => \{[\s\S]*?\}, \[ghost\.state\.turns\]\);/,
  )?.[0] ?? '';
  assert.match(turnFollowEffect, /if \(stickyFollowRef\.current\)/);
  assert.match(turnFollowEffect, /setHasUnseenContent\(true\)/);
  assert.doesNotMatch(turnFollowEffect, /^\s*scroller\.scrollTop = scroller\.scrollHeight;\s*$/m);
});

test('approved disclosure and production actions replace prototype simulation', () => {
  assert.match(
    experienceSource,
    /Jet&apos;s Ghost runs frontier local AI in this browser\. Starting it downloads about 2 GB and may use substantial GPU memory\. Your prompts and responses stay on this device\./,
  );
  assert.doesNotMatch(experienceSource, /runs Gemma 4 E2B/);
  assert.match(experienceSource, /ghost\.checkCompatibility/);
  assert.match(experienceSource, /ghost\.load/);
  assert.match(experienceSource, /ghost\.sendMessage/);
  assert.match(experienceSource, /ghost\.startNewSession/);
  assert.match(experienceSource, /ghost\.unload/);
  assert.doesNotMatch(experienceSource, /makePreviewResponse|interface preview has reached/);
  assert.doesNotMatch(experienceSource, /setTimeout\([^,]+,\s*(?:500|900|1200|1800)\)/);
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

test('loading liveness changes independently of coarse runtime phases without fake progress', () => {
  assert.equal(getLoadingHeadline(0), "Haunting Jet's archive");
  assert.equal(getLoadingHeadline(12), 'Waking the ghost');
  assert.equal(getLoadingHeadline(24), 'Feeding it ones and zeroes');
  assert.equal(getLoadingHeadline(36), "Haunting Jet's archive");
  assert.equal(getLoadingHeadline(Number.NaN), "Haunting Jet's archive");
  assert.equal(getLoadingReassurance(35), null);
  assert.equal(getLoadingReassurance(36), 'First load may take a few minutes.');
  assert.equal(getLoadingReassurance(120), 'First load may take a few minutes.');
  assert.doesNotMatch(experienceSource, /experience\.progress|progressSteps|%<\/span>/);
  assert.doesNotMatch(experienceSource, /Cancel and unload/);
  assert.doesNotMatch(experienceSource, /Unload anytime/);
  assert.match(experienceSource, /Cancel and reload/);
  assert.match(experienceSource, /window\.location\.reload\(\)/);
  assert.match(experienceSource, />\s*Session only\s*</);
  assert.match(experienceSource, /elapsedSeconds/);
  assert.match(experienceSource, /data-testid="loading-stack"/);
  assert.match(experienceSource, /data-testid="loading-phase-visual"/);
  assert.match(experienceSource, /data-testid="loading-main-ghost"/);
  assert.match(experienceSource, /data-testid="loading-ghost-afterimage"/);
  assert.match(experienceSource, /data-testid="loading-inward-particle"/);
  assert.match(
    experienceSource,
    /<AnimatedGhost mode={status === 'loading' \? 'loading' : 'idle'} \/>/,
  );
  assert.match(experienceSource, /data-testid="loading-reassurance-slot"/);
  assert.match(experienceSource, /min-h-\[1\.375em\]/);
  assert.match(experienceSource, /text-xs/);
  assert.doesNotMatch(experienceSource, /min-h-\[calc\(2\*/);
  assert.doesNotMatch(experienceSource, /loading-(?:progress-track|liveness-indicator)/);
  assert.doesNotMatch(experienceSource, /x: \['-100%', '300%'\]/);
  assert.doesNotMatch(
    experienceSource,
    /role={status === 'loading' \? 'status' : undefined}/,
  );
  assert.match(experienceSource, /scale: \[0\.88, 1\.16, 1\.45\]/);
  assert.match(experienceSource, /opacity: \[0, 0\.28, 0\]/);
  assert.match(experienceSource, /opacity: \[0, 0\.75, 0\]/);
  assert.match(experienceSource, /scale: \[0\.75, 1, 0\.45\]/);
  assert.match(experienceSource, /opacity: \[0\.72, 1, 0\.72\]/);
  assert.match(experienceSource, /scale: \[0\.97, 1\.03, 0\.97\]/);
  assert.match(experienceSource, /repeat: Infinity/);
  assert.match(experienceSource, /prefersReducedMotion/);

  for (const [name, source] of canonicalStatusDocs) {
    assert.match(source, /12 seconds/i, `${name} must pin the loading-copy cadence`);
    assert.match(source, /Cancel and reload/i, `${name} must define the document-reload escape`);
    assert.match(source, /document reload|reloads? the (?:page|document)/i);
    assert.doesNotMatch(source, /no Cancel or Unload/i);
    assert.match(source, /elapsed time[^.]*monotonic|monotonic[^.]*elapsed time/i);
    assert.match(source, /indeterminate/i);
    assert.match(source, /phase-in/i);
    assert.match(source, /no progress bar|no progress-shaped/i);
    assert.match(source, /First load may take a few minutes\./);
    assert.match(source, /reserved[^.]*secondary/i);
  }
});

test('activation readiness and load errors share one stable status slot', () => {
  assert.match(experienceSource, /data-testid="activation-status-message"/);
  assert.match(experienceSource, /This browser is ready for the local runtime/);
  assert.match(
    experienceSource,
    /status === 'load-error'\s*\? ghost\.state\.error\?\.message/,
  );
  assert.match(experienceSource, /aria-describedby="jets-ghost-activation-status"/);
  assert.doesNotMatch(
    experienceSource,
    /status === 'load-error' && ghost\.state\.error !== null && \(\s*<p className="mx-auto mt-xs/,
  );
});

test('activation privacy facts wrap naturally instead of colliding on narrow mobile', () => {
  assert.match(experienceSource, /data-testid="activation-main"/);
  assert.match(
    experienceSource,
    /data-testid="activation-main"[\s\S]{0,260}max-\[369px\]:pb-5xl/,
  );
  assert.doesNotMatch(experienceSource, /data-testid="activation-main"[\s\S]{0,260}md:py-m/);
  assert.match(
    experienceSource,
    /max-\[369px\]:px-s[\s\S]{0,120}max-\[369px\]:text-sm[\s\S]{0,120}max-\[369px\]:whitespace-nowrap[\s\S]{0,220}Load Jet&apos;s Ghost · about 2 GB/,
  );
  assert.match(experienceSource, /data-testid="activation-privacy-facts"/);
  assert.match(
    experienceSource,
    /data-testid="activation-privacy-facts"[\s\S]{0,180}className="[^"]*flex[^"]*flex-wrap[^"]*justify-center[^"]*gap-x-s[^"]*gap-y-2xs[^"]*"/,
  );
  assert.doesNotMatch(
    experienceSource,
    /data-testid="activation-privacy-facts"[\s\S]{0,180}grid-cols-3/,
  );
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
    /<p[^>]*className="mb-2xs font-mono[^>]*>[\s\S]*?Loading on this device[\s\S]*?<h1[^>]*>[\s\S]*?loadingHeadline[\s\S]*?<\/h1>[\s\S]*?<p[^>]*className="mt-xs text-xs text-text-tertiary">\s*Elapsed/,
  );
  assert.equal(shouldFocusComposer('generating', 'ready'), true);
  assert.equal(shouldFocusComposer('cancelling', 'ready'), true);
  assert.equal(shouldFocusComposer('loading', 'ready'), true);
  assert.equal(shouldFocusComposer('ready', 'ready'), false);
});

test('source disclosure is collapsed, semantic, responsive, and untruncated', () => {
  const disclosureSource = experienceSource.match(
    /function ResponseDetails[\s\S]*?\n}\n\ninterface ErrorRecoveryProps/,
  )?.[0] ?? '';

  assert.match(disclosureSource, /useState\(false\)/);
  assert.match(disclosureSource, /sourceCount === 1 \? 'source' : 'sources'/);
  assert.match(disclosureSource, /aria-expanded={isExpanded}/);
  assert.match(disclosureSource, /aria-controls={disclosureId}/);
  assert.match(disclosureSource, /role="region"/);
  assert.match(disclosureSource, /aria-label="Sources for this response"/);
  assert.match(disclosureSource, /<ul[^>]*>[\s\S]*?citedDocumentSources\.map/);
  assert.match(disclosureSource, /className="[^"]*min-h-11[^"]*focus-visible:ring-2[^"]*"/);
  assert.match(disclosureSource, /max-w-\[38rem\]/);
  assert.match(disclosureSource, /aria-label={[\s\S]*?source\.title/);
  assert.match(
    disclosureSource,
    /className="[^"]*min-w-0[^"]*break-words[^"]*\[overflow-wrap:anywhere\][^"]*"[\s\S]*?{source\.title}/,
  );
  assert.match(disclosureSource, /motion-reduce:transition-none/);
  assert.doesNotMatch(disclosureSource, /line-clamp|truncate|rounded-full|ResponseSourceFooter/);
  assert.doesNotMatch(disclosureSource, /source\.title\.(?:slice|substring)\(/);
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
