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

### Final disposition

The four reversible phases are review-clean and the final Node 24 gate passed. The phase commits are `b83457b435135869de59e027e9a66fd2322f0fc4` (Tailwind 4 bridge), `fbdd1183a1e4c831edd8e8b6496b3d035ddc5b66` (Astro 7/core matrix), `7eb692d9d5fb0a523880612eaf4891fc44696a2c` (Lucide 1.x), and `7efb8f7593a8b4eb2bcbbcbfe9b990a8021d1a15` (jest-dom 7).

The final clean install used Node `v24.18.0` and npm `11.16.0`: `npm ci` installed 864 packages. It then passed `npm run format:check`, `npm run lint`, `npm run check` (166 files; 0 errors, warnings, or hints), `npx tsc --noEmit`, `npm test` (46 files / 548 tests), `npm run verify:docs` (8 documents / 94 relative links), `npm run build` (12 pages), `npm run verify:build-purity`, and `npm run verify:production-artifacts`. The artifact check confirmed the complete runtime and license surfaces and no Egregore fake-runtime seam. `git diff --check` also passed.

The exact root graph read back from `npm ls` is Astro `7.1.3`; MDX `7.0.3`; React integration `6.0.1`; Partytown `2.1.7`; Check `0.9.9`; RSS `4.0.19`; Sitemap `3.7.3`; Tailwind CSS, Vite adapter, and Typography `4.3.3`, `4.3.3`, and `0.5.20`; TypeScript `6.0.3`; React and React DOM `19.2.7`; React types `19.2.17` and `19.2.3` in `devDependencies`; Framer Motion `12.42.2`; Lucide `1.25.0`; esbuild `0.28.1`; tsx `4.23.1`; jest-dom `7.0.0`; Vercel Blob `2.6.1`; dotenv `17.4.2`; unist-util-visit `5.1.0`; and LiteRT-LM exactly `0.14.0`. No TypeScript 7, SSR adapter, direct `markdown-remark` dependency, CSP enforcement, runtime/model change, or model download was added.

`env -u NO_COLOR npm run verify:browser` completed one full matrix: 240 passed and 20 intentional skips. Its desktop and mobile Chromium owners cover light and dark themes, sitemap routes plus qualification routes, MDX, Works, About, Contact, Egregore lifecycle/privacy/recovery, dock closed/open, collection filters, ClientRouter cleanup, keyboard/focus, and axe accessibility. A bounded screenshot-free rendered readback additionally loaded Home, a Blog MDX page, Works, About, Contact, and Egregore at 360px light and 1440px dark with one main heading, non-empty content, correct theme, no error overlay, and no page errors (12 page states); it confirmed compact dock `false → true → false`, a Blog `tutorial` filter leaving one visible item and synchronizing the URL, and ClientRouter navigation to Blog. No screenshots or visual baselines were created.

`npm audit --omit=dev` found 0 production vulnerabilities. Full `npm audit` reports seven high findings, all dev-only: `brace-expansion` through the ESLint/`eslint-plugin-jsx-a11y`/TypeScript-ESLint minimatch chains, and `fast-uri@3.1.3` through `@astrojs/check@0.9.9` → language server → YAML language service → AJV. They are not in the production install path; the available forced fix would make an unapproved breaking ESLint-plugin change. They remain recorded for a separately approved developer-toolchain security update rather than being hidden by an out-of-matrix upgrade.

Vite 8 emits upstream notices that `vite:react-babel` and dependency optimization still specify esbuild options while Vite is moving to Oxc/Rolldown. This is a pinned-matrix upstream residual; Task 6 adds no override or suppression. Tailwind remains on the supported JavaScript `@config` bridge. The CSS-first `@theme` semantic-token-owner rewrite is deliberately deferred, and enforcing CSP remains outside this ClientRouter/Shiki-bound matrix. The production-artifact verifier's log-copy assertion is unchanged and remains ledgered for Task 12.

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
- The future cold path records separately: network transfer; Cache `put()` wall time (which includes/overlaps streaming transfer); cache reread; LiteRT import/WASM initialization; engine/model readiness; retrieval/prompt assembly; send-to-first-nonempty chunk; total generation; response size and token rate only where a trustworthy token count exists; process/GPU/system-memory snapshots; thermal state; and renderer/GPU/Chrome/LiteRT termination classification. These are bounded diagnostic evidence, not permanent telemetry or preset latency thresholds, and logs contain no conversation content or root-only assumptions.
- Cache reuse must prove zero model-network requests on the warm path and separately capture its bounded non-transfer spans: cache reread; LiteRT import/WASM initialization; engine/model readiness; retrieval/prompt assembly; send-to-first-nonempty chunk; total generation; response size and token rate only where a trustworthy token count exists; process/GPU/system-memory snapshots; thermal state; and renderer/GPU/Chrome/LiteRT termination classification. The cold run uses a closed dock to isolate model behavior; one warm cache-reuse pass uses the visible dock to couple the separately owned dock and runtime evidence. That warm result is integrated and descriptive, not an isolated cold-versus-warm inference benchmark, and it must not imply a warm network-transfer span beyond the zero-request proof.
- One successful cold/warm run is the minimum real-model qualification, not a cap on diagnosis. A site-controlled bottleneck may receive one narrow evidence-led optimization and matching confirmation, avoiding another approximately `2 GB` transfer unless the changed boundary genuinely requires a cold run. If evidence identifies no safe site owner or a platform limit, stop for a supported-device or explicit trade-off decision; do not weaken model, context, or answer quality, or repeat crashes/downloads for benchmarking.

## Task 9–12 bounded phone protocol (prepared, not executed)

The phone remains disconnected for Task 9. Once Task 10's deterministic cache/runtime instrumentation is ready, connect a cool phone for one bounded Chrome pass before any model activation. Record only a sanitized state table: Chrome controls expanded or contracted; CSS and visual viewport dimensions; document client height; dock, disclosure, and activation-action bounds; dock visible/closed state; direct `/chatbot/` entry; explicit close; Licenses navigation; reload; history traversal; and compact-to-wide-to-compact restoration where the mirrored orientation path permits it. Keep the same display mode and unrelated browser settings throughout the pass.

For each state, capture process, GPU, system-memory, and thermal snapshots without a device serial, browsing history, prompt, response, or permanent telemetry. Task 12 starts one bounded sanitized ADB/Chrome log window immediately before cold activation. If Chrome returns to Home, classify the available evidence as Android process exit, renderer or GPU-process failure, Chrome termination, or LiteRT failure; record uncertainty where the evidence cannot distinguish them. No root access, model download, conversation content, or runtime trace is authorized by this prepared protocol. After Task 9 and Task 10 are both deterministic, combine this cool-device pass with Task 11's first trace; retain the connection for Task 12 only if that sequence remains cool and controlled, otherwise cool and reconnect once for the final candidate.

## Task 10 model-cache boundary

Task 10 adds one versioned Cache API boundary for the pinned Gemma 4 E2B artifact. The cache namespace is keyed only by the cache schema and pinned model SHA; the same-origin metadata key is keyed by the pinned repository revision and filename. Application version is not cache identity. A cache miss transfers only after explicit load activation; the browser Cache boundary validates final HTTPS trusted origin, success status, body stream, and declared pinned length, commits the response once, then supplies the committed cache stream to LiteRT-LM. The release/manual model-delivery owner enforces the exact initial URL, every HTTPS trusted redirect hop, and `maxRedirects`: direct static-site browser Fetch cannot inspect intermediary hops because manual redirects are opaque, and no proxy, service worker, or hosted fallback is added. Cache unavailability or a failed cache write requires a separate visitor-authorized uncached retry and never starts a second model transfer automatically.

Unload remains in-memory and session cleanup only. A cached artifact can be removed explicitly with confirmation; the UI announces success or failure. The deterministic fake runtime remains uncached and never exposes the removal control. The manual real-model qualification prepares one frozen cold interaction, the same warm interaction, and the other five approved warm cases with distinct retrieval/context-selection, prompt-assembly, send-to-first-nonempty, and total-generation observations when running the local qualification build; external smoke retains visible/model behavior checks without those local-only spans. It records model-network transfer separately from Cache `put()` wall time, which includes/overlaps streaming transfer. After final warm Unload it proves the cache remains, removes it directly while unloaded, then proves Cache Storage absence. It is prepared for the combined Task 12 gate and was not run during this task.

## Task 11 physical Liquid Glass dock audit

The cool-device, no-model protocol ran against the current local production build on the Xiaomi 14T with Android 16 and Chrome `150.0.7871.128`. The physical display remained `1220 × 2712` at density `520`; Chrome exposed a `375 × 720` CSS/visual viewport with controls expanded and `375 × 776` with controls contracted. The display reported an active dynamic `120 Hz` mode while page `requestAnimationFrame` sampling was approximately `60 Hz`, so the required comparison remains against 60 fps. Thermal status stayed `0`; the observed current skin range was approximately `39.9–41.4 °C`. No phone setting was changed, no model or corpus was downloaded, and **Load Egregore** was never activated.

The physical state matrix passed at compact width. Direct `/chatbot/` entry exposed the open dock and **Close navigation**; explicit close made the dock inert and `aria-hidden`; the closed choice survived Licenses navigation, reload, back, and forward; reopen restored the interactive dock. Both **Check compatibility** and the compatibility-approved **Load Egregore · about 2 GB** control ended at `528.59` CSS px, clear of the dock/disclosure zone. Chrome controls expansion/contraction changed available height without breaking the closed-state disclosure.

The trace used identical bounded idle, scroll, open, close, and post-transition intervals on static About. Raw CDP traces and memory/thermal dumps remain ignored local artifacts; disposable screenshot files and helper scripts were removed after review. The decisive local-renderer measurements were:

| Interval                                     | Presented evidence                                                                                 | Filter/lifecycle evidence                                                                                                    |
| -------------------------------------------- | -------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Baseline About, visible scroll               | 64 all-presented frames over `2.217 s`; `28.4 fps`; `33.22 ms` median; `58.11 ms` p95; 210 dropped | Two backdrop-filter render surfaces; stable nodes/heap; no displacement-map rewrites during stable scroll                    |
| Baseline About, hidden scroll                | 161 all-presented frames over `2.218 s`; `16.60 ms` median; `16.68 ms` p95; no gap over `33.4 ms`  | One intersecting backdrop-filter surface; the translated dock surface was outside the viewport                               |
| After-change About, visible / hidden scroll  | Visible `35.1 fps`, `24.91 ms` median; hidden `16.61 ms` median with no gap over `33.4 ms`         | Same two-versus-one render-surface ownership; no material hidden-state regression                                            |
| Home, visible / hidden decisive confirmation | Visible `27.2 fps`, `41.46 ms` median; hidden `56.9 fps`, `16.60 ms` median                        | The visible/hidden split remained with Grainient present, so Grainient was not the owner                                     |
| Stable visible and hidden idle               | No ongoing local-renderer presentation or paint                                                    | No continuing hidden or idle painting, node growth, heap growth, resize churn, or displacement-map regeneration was isolated |

The visible dock remained below the approximately 57 fps diagnostic aspiration, but the ordered investigation isolated the required visible SVG backdrop filters and their already separate render surfaces—not simultaneous hidden painting, displacement regeneration, resize/state invalidation, or Grainient—as the cost. Removing or weakening distortion, translucency, shadows, or either visible glass surface would be a fidelity trade-off. No fidelity-preserving performance change was therefore justified, and no dock/filter implementation was changed.

The physical review did confirm a separate Task 9 geometry regression. Both pre-Task9 `4f093b2` and approved prototype `d406ed46` raised the disclosure by `88px`, which rendered an `8.00px` visual gap. Task 9's new shared token resolved to approximately `80px`, while the actual compact dock was `80px` tall, leaving only `0.049px` between the circular disclosure and dock. The compact shared dock-height token now matches the rendered `5rem` dock: the physical gap is `8.049px`, and the complete bottom exclusion reserve increases by the same `8px`. The focused rendered contract failed before the correction at `0.048px` and passed afterward. Physical mobile and local desktop light/dark review retained the Liquid Glass treatment, shadows, icons, theme response, geometry, activation clearance, and breakpoint presentation; no screenshots or benchmark harness were committed.

Node 24 verification passed the focused dock unit owner (6 tests), the focused rendered gap and card-focus owners (3 passed, 1 project skip), the recovery accessibility owner (1 test), the complete required browser matrix (235 passed, 23 intentional project skips), and the standard repository gate (48 files / 575 unit tests, documentation links, production build, and artifact verification). Two initial full matrices exposed that the recovery keyboard/axe test reached its complete error state while its nonessential Framer label crossfade remained at initial opacity under suite contention. That test now selects the supported reduced-motion mode before navigation and retains the opacity assertion; the dedicated normal-motion Egregore suite continues to own lifecycle crossfades. A subsequent complete matrix passed.

## Task 12A integrated candidate and physical real-model qualification

### Disposition

**Failed — Jet Web 2.2.0 remains unqualified and unreleasable on the mandatory Xiaomi 14T until the code-level GPU-resource correction and its one approved bounded warm confirmation are complete.** Jet approved that matching post-correction run using the existing committed model cache; it remains unperformed at this checkpoint. The initial cold/warm sequence ended when Android force-stopped Chrome for exceeding the device's KGSL resource threshold. The failure was not retried, Xiaomi support was not removed, and no version bump, deployment, tag, release, or Search Console mutation followed.

The deterministic Node 24 prequalification gate and residue audit had passed on review-clean candidate `5cc363ccac21a26a2f95f164819ce0f1444b1d4d`. Physical review then found a mixed `100vh`/`100svh` mobile layout defect and narrow-header compression. The focused viewport correction is `6449fafcea20e9bb03709f1c613889465a2c1c0d`; its stable Egregore Chromium owner passed 46 tests with 1 intentional project skip. A rebuilt localhost qualification artifact contained the qualification observer and excluded the fake-runtime seam. The Xiaomi readback after that fix matched its `375 × 720` visual viewport at the shell, outer main, body, and document boundaries; it had no page scroll or horizontal overflow, exposed the complete `jet-web 2.1.0 · Licenses` metadata, retained 44px action targets, and kept the closed/open dock clear of the activation control.

### Cold activation and first unload

The cold path started once from absent Cache Storage with the dock closed. Ready was observed after `626.2 s`; the cross-origin model ResourceTiming duration was `528,007.6 ms`. Browser timing policy withheld `requestStart` and `responseStart`, so no body-transfer or Cache `put()` proxy is claimed. The committed cache response was readable at the pinned key with status `200`, terminal host `us.aws.cdn.hf.co`, declared length `2,008,432,640`, and `application/octet-stream`; the first controller did not retain the Cache `put()` and reread spans, which remain explicitly unobserved. Corpus requests completed in `33/44/50 ms`, and the observed LiteRT JavaScript/WASM resources completed in `25/536 ms`.

The frozen `recursive-convergence-claim` case passed cold with the expected single work source, resolved inline citations, retrieval `7 ms`, prompt assembly `1 ms`, first nonempty chunk `405 ms`, and total generation `43,854 ms`. The first unload reached the coherent not-running state in `638 ms` and preserved the committed cache. The model renderer dropped from approximately `2.29 GB` RSS to approximately `466 MB`, but the privileged/GPU process remained approximately `1.93 GB` RSS after bounded settling and was still approximately `1.89 GB` several minutes later. Engine/session UI cleanup therefore passed, while GPU/process-memory cleanup did not.

### Warm activation, cases, and termination

After the reviewed viewport fix and clean qualification rebuild, the same committed cache was activated exactly once with the dock visible and the cache, qualification, network, and privacy observers installed before activation. Ready took `12,737 ms`. The run observed two model-cache opens (`10/18 ms`), two cache match/read handoffs (`3/13 ms`), zero cache puts, zero model-network requests, three local corpus requests, two local LiteRT runtime requests, zero request failures, and a passing request-privacy audit. Corpus timings were `42/46/43 ms`; observed LiteRT JavaScript/WASM timings were `23/567 ms`. At Ready, the model renderer was approximately `1.68 GB` RSS, the privileged/GPU process approximately `2.12 GB` RSS, and Android thermal status remained `0`.

The chronological warm evidence before termination was:

| Case                          | Result                                                                                                                                  | Retrieval / prompt / first nonempty / total |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| `recursive-convergence-claim` | Passed; expected single work source and 4 inline citations                                                                              | `14 / 2 / 444 / 13,032 ms`                  |
| `who-is-jet`                  | Passed; About provenance, required profile facts, third-person framing, and 4 inline citations                                          | `1 / 0 / 308 / 12,209 ms`                   |
| `what-does-jet-do`            | Passed; About provenance, required role/work facts, third-person framing, and 4 inline citations                                        | `2 / 0 / 327 / 11,296 ms`                   |
| `digital-squad-timesheet`     | Grounded facts passed with 6 inline citations across 2 documents; strict one-source validator did not resolve the additional provenance | `2 / 0 / 475 / 18,675 ms`                   |
| `claude-native-installation`  | Browser terminated during active generation before a result could be assessed                                                           | Not completed                               |

Android `ApplicationExitInfo` classified the termination at `2026-07-27 03:50:35` local time: Chrome main PID `10507` and privileged/GPU PID `13881` were force-stopped with the description `stop com.android.chrome due to used too many kgsl resource,kgsl used rss:4387820kb,kgsl threshold:1572864kb`. The privileged process record reported approximately `1.7 GB` PSS and `1.8 GB` RSS. A renderer had a `LOW_MEMORY` exit approximately 20 seconds earlier, and the model renderer was subsequently removed as isolated-not-needed. Chrome restarted under new PIDs, proving full browser termination rather than controller loss.

The restored `/chatbot/` route was coherent and unloaded: no composer, conversation, or unload control; **Check compatibility** visible; document/client height `720/720`. The pinned cache remained one readable status-`200` entry, so no incomplete artifact was accepted. Thermal status at recovery remained `0`. The remaining warm cases, stop/recovery closeout, final unload, and explicit model removal were not run because the crash is the qualification boundary. The cache remains intentionally preserved for diagnosis; raw logs, screenshots, device identifiers, prompts, and responses are not tracked.
