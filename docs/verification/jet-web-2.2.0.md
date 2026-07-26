# Jet Web 2.2.0 verification baseline

**Status:** Implementation in progress; Tasks 1 through 3 are recorded below.

This record fixes the starting point for the approved `2.2.0` work. It records only release and device facts needed to evaluate the implementation; it contains no device serial, browsing history, raw logs, traces, screenshots, conversation content, or credentials.

## Execution start

| Field                            | Verified value                                                                           |
| -------------------------------- | ---------------------------------------------------------------------------------------- |
| Canonical repository             | `/Users/jet/jet-web`                                                                     |
| Implementation branch            | `codex/jet-web-2.2.0`                                                                    |
| Execution-start commit           | `71dafed7dfb6a4a36d1d87129ba8fa9cc9693af1`                                               |
| `origin/main` at execution start | `0d59dc9210f38f5ab32dd8636604563bef8024a3`                                               |
| Production `v2.1.0` commit       | `0d59dc9210f38f5ab32dd8636604563bef8024a3`                                               |
| Approved-content anchor          | `27afb67dc169d5fd725d6e78457e5ee84e66145e` is an ancestor of the execution-start commit. |

The execution-start commit contains the approved [2.2.0 design](../superpowers/specs/2026-07-18-jet-web-2.2.0-design.md) and [implementation plan](../superpowers/plans/2026-07-18-jet-web-2.2.0.md). `package.json` declares Node `24.x`, and the routine verification workflow uses Node `24`.

At task start, the expected pre-implementation workspace changes were the frozen [2.1.0 qualification and follow-up record](../archive/releases/2.1.0/jets-ghost-2.1.0.md) and user-owned material under `Untracked/`. The latter was not inspected, altered, or staged.

## Repository verification

The required Node 24 baseline ran with Node `v24.18.0` and npm `11.16.0`:

| Check                                                | Result                                                                             |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `npm run check`                                      | Passed with 0 errors and 0 warnings; Astro emitted 2 existing inline-script hints. |
| `npm run test`                                       | 50 test files and 623 tests passed.                                                |
| `npm run verify:docs`                                | 16 documents and 77 relative links verified.                                       |
| `npm run build` and production-artifact verification | Passed.                                                                            |

## GitHub Release record

The annotated `v2.1.0` tag was read before release creation and remained at `0d59dc9210f38f5ab32dd8636604563bef8024a3` after it. The normal [jet-web 2.1.0 GitHub Release](https://github.com/jet-ds/jet-web/releases/tag/v2.1.0) was created from that existing tag at `2026-07-21T08:06:49Z`, marked Latest, and published without release assets. This records the existing deployed release bytes; it does not move the tag, alter the deployed commit, or trigger a deployment.

## Egregore identity checkpoint

Task 3 moved the complete maintained assistant identity to Egregore while preserving `/chatbot/`, `/chatbot/#softwareapplication`, the generic `/assistant/` artifacts, `/tools/chatbot/`, all model and runtime pins, and the released interaction behavior. `/licenses/egregore/` is now the canonical license document; the former name-bearing license route is redirect-only. Archived `2.1.0` files remain byte-identical, and no deployment or real-model download occurred during this checkpoint.

The identity contracts were written before the namespace move. The focused pre-move unit command failed across all seven selected files with 19 failing expectations, including the missing identity owner and old prompt, navigation, rendered, license, and artifact identities. After implementation, the following Node 24 evidence passed:

| Check                                                     | Result                                                                                                                                                                                                                           |
| --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Focused Egregore unit and component owners                | 9 files and 126 tests passed.                                                                                                                                                                                                    |
| `npm run check`                                           | Passed with 0 errors and 0 warnings; Astro emitted 2 existing inline-script hints. The separate prerequisite commit `030ffd3` repairs a type-only semantic-token test regression reproduced at the exact Task 3 starting commit. |
| `npm test`                                                | 46 test files and 548 tests passed.                                                                                                                                                                                              |
| `npm run build` and `npm run verify:production-artifacts` | Passed; the generated license and runtime surfaces are complete and the fake-runtime seam is absent.                                                                                                                             |
| Focused Egregore, site, and accessibility browser owners  | 220 tests passed and 20 intentionally skipped. An earlier timing-sensitive lifecycle timeout passed in isolation before the complete command passed on rerun.                                                                    |
| Active documentation links                                | 8 documents and 94 relative links verified.                                                                                                                                                                                      |
| Frozen `docs/archive/releases/2.1.0/` checksum            | All 6 tracked files matched the pre-task SHA-1 checksum manifest.                                                                                                                                                                |
| Standard `npm run verify` gate                            | Passed end to end after making the reload-escape unit owner independent of the intentionally rotating loading headline.                                                                                                          |

## Task 6 platform modernization

The platform migration is approved and proceeds through reversible phases. The values below are targets unless a completed phase records its installed graph and verification:

| Concern                 | Approved exact target                                                                                                                             | Evidence status                                                        |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Runtime                 | Node.js `24.x`                                                                                                                                    | Phase 2 confirmed: Node `v24.18.0`, npm `11.16.0`                      |
| Astro                   | `astro@7.1.3`                                                                                                                                     | Phase 2 complete                                                       |
| Astro integrations      | `@astrojs/mdx@7.0.3`, `@astrojs/react@6.0.1`, `@astrojs/partytown@2.1.7`, `@astrojs/check@0.9.9`, `@astrojs/rss@4.0.19`, `@astrojs/sitemap@3.7.3` | Phase 2 complete                                                       |
| Tailwind                | `tailwindcss@4.3.3`, `@tailwindcss/vite@4.3.3`, `@tailwindcss/typography@0.5.20`; remove `@astrojs/tailwind`                                      | Phase 1 complete; confirmed under Astro 7                              |
| TypeScript              | `typescript@6.0.3`; TypeScript 7 excluded                                                                                                         | Phase 2 complete                                                       |
| React                   | `react@19.2.7`, `react-dom@19.2.7`, `@types/react@19.2.17`, `@types/react-dom@19.2.3`; both type packages move to `devDependencies`               | Phase 2 complete                                                       |
| UI/runtime dependencies | `framer-motion@12.42.2`, `lucide-react@1.25.0`                                                                                                    | Framer Motion phase 2 complete; Lucide phase 3 complete                |
| Build/test dependencies | `esbuild@0.28.1`, `tsx@4.23.1`, `@testing-library/jest-dom@7.0.0`                                                                                 | esbuild and tsx phase 2 complete; jest-dom phase 4 complete            |
| Other reviewed updates  | `@vercel/blob@2.6.1`, `dotenv@17.4.2`, `unist-util-visit@5.1.0`                                                                                   | Phase 2 complete                                                       |
| Local model runtime     | retain exact `@litert-lm/core@0.14.0`                                                                                                             | Phase 2 confirmed unchanged; real-model qualification stays in Task 12 |

Task 6 first adopts Tailwind 4 through the supported JavaScript `@config` compatibility bridge. The later CSS-first `@theme` and semantic-token-owner rewrite is deliberately deferred because current semantic custom-property names collide with that model. It is a separately evaluated design-system migration, is not required for `2.2.0`, and must not be reported as silently completed by the Tailwind upgrade.

### Phase 1 — Tailwind 4 bridge

- Node `v24.18.0` and npm `11.12.1`; installed graph: Astro `5.18.2`, Tailwind CSS `4.3.3`, `@tailwindcss/vite` `4.3.3`, Typography `0.5.20`, and LiteRT-LM unchanged at `0.14.0`.
- Replaced the Astro Tailwind integration with the Vite plugin and retained the JavaScript theme compatibility bridge; Preflight, the custom dark variant, semantic palette, and Utopia scales remain in their existing ownership model.
- Corrected only observed v4 semantics: renamed changed utilities; used explicit container variables where Utopia `xl` through `4xl` spacing keys collide with v4 `max-w-*`; kept prose links unlayered so their shared interaction recipe outranks Typography v4's layered output; and asserted card hover only for fine-pointer hover devices while retaining keyboard coverage on both browser projects.
- RED evidence: v4's individual `scale` property invalidated transform serialization; container collisions collapsed Egregore and shifted its Ghost viewport by `409px`; v4 Typography overrode prose-link styling; and the mobile hover assertion exercised an unavailable capability. The focused contracts passed after correction.
- Node 24 gates passed: `npm run verify` (46 files / 548 tests, 0 Astro errors; 2 existing Partytown hints), `npx tsc --noEmit`, `npm run verify:build-purity`, and the complete `npm run verify:browser` matrix (260 tests; Playwright last-run status `passed`).

### Phase 2 — Astro 7 and core platform matrix

- Node `v24.18.0` and npm `11.16.0`; a clean `npm ci` installed 864 packages. `npm audit --omit=dev` found no production dependency vulnerabilities.
- Installed the approved exact graph: Astro `7.1.3`; MDX `7.0.3`; React integration `6.0.1`; Partytown `2.1.7`; Check `0.9.9`; RSS `4.0.19`; Sitemap `3.7.3`; TypeScript `6.0.3`; React and React DOM `19.2.7`; React types `19.2.17` and `19.2.3` in `devDependencies`; Framer Motion `12.42.2`; esbuild `0.28.1`; tsx `4.23.1`; Vercel Blob `2.6.1`; dotenv `17.4.2`; and unist-util-visit `5.1.0`. LiteRT-LM remains exactly `0.14.0`.
- Astro 7 required moving the existing loader configuration to `src/content.config.ts`; TypeScript 6 required replacing the deprecated React `FormEvent` annotations with `SubmitEvent`. `compressHTML: true` is explicit, and both Partytown analytics scripts have explicit `is:inline`; Astro Check completed with 0 errors, 0 warnings, and 0 hints.
- Node 24 gates passed: format, lint, Astro check, standalone TypeScript, 46 unit files / 548 tests, documentation links (8 documents / 94 relative links), production build (12 pages), build purity, and production-artifact verification.
- The single complete browser matrix exercised 260 tests. One Chromium image-card test failed once and passed on its immediate focused retry without a source change; no broader rerun was made. Its report is isolated in `.superpowers/sdd/2026-07-18-jet-web-2.2.0/task-6-phase2-report.md`.
- No rendering-specific compatibility failure required a manual light/dark or compact correction. No CSS-first token rewrite, CSP enforcement, SSR adapter, model download/runtime change, Lucide major, or jest-dom major change was made. Vite 8 reports upstream esbuild-to-Oxc deprecation notices, and the inherited `NO_COLOR`/`FORCE_COLOR` browser-process warning remains unconfigured by design.

### Phase 3 — Lucide 1.x isolation

- Node `v24.18.0` and npm `11.16.0`; installed `lucide-react@1.25.0` as an exact production dependency. `npm ls lucide-react @litert-lm/core --depth=0` confirmed Lucide `1.25.0` and unchanged LiteRT-LM `0.14.0`.
- The existing imports and rendered controls were compatible without a consumer or test change. Format, lint, Astro check (166 files; 0 errors, warnings, or hints), standalone TypeScript, 46 unit files / 548 tests, and the 12-page static build passed.
- One complete `npm run verify:browser` matrix passed: 260 tests, including the existing shared-control, Egregore lifecycle and theme/compact, Contact, dock, keyboard, target, and accessibility contracts. Playwright recorded `passed` with no failed tests, so no focused retry or flake disposition was necessary.
- No test asserts the installed Lucide version. The Tailwind 4 bridge, semantic tokens, action taxonomy, content configuration, analytics, fake-runtime boundary, model-download boundary, and active documentation remain unchanged. Vite's upstream esbuild-to-Oxc notices and inherited `NO_COLOR`/`FORCE_COLOR` browser-process warnings remain non-blocking and unconfigured.

### Phase 4 — jest-dom 7 isolation

- Node `v24.18.0` and npm `11.16.0`; installed `@testing-library/jest-dom@7.0.0` as an exact development dependency. Exact `npm ls` confirmed jest-dom `7.0.0`, LiteRT-LM `0.14.0`, and Lucide `1.25.0`.
- The existing Vitest setup import, `@testing-library/jest-dom/vitest`, and all existing matcher contracts remained compatible; no matcher, setup, typing, or test correction was required.
- Node 24 gates passed: format, lint, Astro check (166 files; 0 errors, warnings, or hints), standalone TypeScript, and 46 unit files / 548 tests. `git diff --check` passed. Astro's Vite dependency-optimization run emitted existing upstream esbuild-to-Oxc deprecation notices only.
- No browser matrix, build, production artifact check, CSS/token, platform, model, deployment, or audit work was run or changed for this isolated unit-matcher major.

Populate this section during Task 6 with the four phase commit SHAs, Node/npm readback, exact `npm ls` graph, clean-`npm ci` command results, compiler/type/test/docs/build/build-purity/production-artifact/browser results, representative light/dark and `320–369px`/desktop rendered disposition, and the reviewed production-only and full audit dispositions. Comparison artifacts remain ignored under `test-results/`; no screenshot or `Untracked/` evidence is committed. The Tailwind 4 support floor becomes Chrome 111+, Safari 16.4+, and Firefox 128+ only after the phase passes. Astro uses `compressHTML: true` and its Sätteri default unless rendered evidence requires a compatibility change. Enforcing CSP remains outside the matrix because of the current `ClientRouter` and Shiki constraint; no CSP setting is added in Task 6.

## Physical-device baseline

| Field                | Observed fact           |
| -------------------- | ----------------------- |
| Device               | Xiaomi 14T              |
| Operating system     | Android 16              |
| Browser              | Chrome `150.0.7871.128` |
| Physical display     | `1220 × 2712`           |
| Density              | `520`                   |
| Current refresh rate | `60 Hz`                 |
| Observed page width  | `375` CSS pixels        |

Memory pressure remains plausible but unproven. The probe observed approximately `11.6 GB` total memory and `3.8 GB` available memory, alongside historical Chrome low-memory exits. No event was retained that correlates those exits with the Jet's Ghost 2.1 termination.

## Baseline constraints

- The `v2.1.0` tag and deployed commit are historical release bytes and must not move.
- No deployment was initiated for this baseline work.
- Future real-device evidence must record the available CSS and visual viewport for each state rather than infer a fixed viewport height from display pixels.
- Keep the phone disconnected until deterministic Tasks 9 and 10 code, tests, and bounded instrumentation are ready. Its first connected session is a cool-device, no-model layout/state and dock trace; retain the connection for bounded ADB/Chrome runtime evidence afterward, or cool and reconnect once if the final candidate requires it.
- The future cold path records separately: network transfer; cache commit/reread; LiteRT import/WASM initialization; engine/model readiness; retrieval/prompt assembly; send-to-first-nonempty chunk; total generation; response size and token rate only where a trustworthy token count exists; process/GPU/system-memory snapshots; thermal state; and renderer/GPU/Chrome/LiteRT termination classification. These are bounded diagnostic evidence, not permanent telemetry or preset latency thresholds, and logs contain no conversation content or root-only assumptions.
- Cache reuse must prove zero model-network requests on the warm path and separately capture its bounded non-transfer spans: cache reread; LiteRT import/WASM initialization; engine/model readiness; retrieval/prompt assembly; send-to-first-nonempty chunk; total generation; response size and token rate only where a trustworthy token count exists; process/GPU/system-memory snapshots; thermal state; and renderer/GPU/Chrome/LiteRT termination classification. The cold run uses a closed dock to isolate model behavior; one warm cache-reuse pass uses the visible dock to couple the separately owned dock and runtime evidence. That warm result is integrated and descriptive, not an isolated cold-versus-warm inference benchmark, and it must not imply a warm network-transfer span beyond the zero-request proof.
- One successful cold/warm run is the minimum real-model qualification, not a cap on diagnosis. A site-controlled bottleneck may receive one narrow evidence-led optimization and matching confirmation, avoiding another approximately `2 GB` transfer unless the changed boundary genuinely requires a cold run. If evidence identifies no safe site owner or a platform limit, stop for a supported-device or explicit trade-off decision; do not weaken model, context, or answer quality, or repeat crashes/downloads for benchmarking.
