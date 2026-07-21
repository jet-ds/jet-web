# Jet Web 2.2.0 verification baseline

**Status:** Implementation in progress; Tasks 1 through 3 are recorded below.

This record fixes the starting point for the approved `2.2.0` work. It records only release and device facts needed to evaluate the implementation; it contains no device serial, browsing history, raw logs, traces, screenshots, conversation content, or credentials.

## Execution start

| Field | Verified value |
| --- | --- |
| Canonical repository | `/Users/jet/jet-web` |
| Implementation branch | `codex/jet-web-2.2.0` |
| Execution-start commit | `71dafed7dfb6a4a36d1d87129ba8fa9cc9693af1` |
| `origin/main` at execution start | `0d59dc9210f38f5ab32dd8636604563bef8024a3` |
| Production `v2.1.0` commit | `0d59dc9210f38f5ab32dd8636604563bef8024a3` |
| Approved-content anchor | `27afb67dc169d5fd725d6e78457e5ee84e66145e` is an ancestor of the execution-start commit. |

The execution-start commit contains the approved [2.2.0 design](../superpowers/specs/2026-07-18-jet-web-2.2.0-design.md) and [implementation plan](../superpowers/plans/2026-07-18-jet-web-2.2.0.md). `package.json` declares Node `24.x`, and the routine verification workflow uses Node `24`.

At task start, the expected pre-implementation workspace changes were the frozen [2.1.0 qualification and follow-up record](../archive/releases/2.1.0/jets-ghost-2.1.0.md) and user-owned material under `Untracked/`. The latter was not inspected, altered, or staged.

## Repository verification

The required Node 24 baseline ran with Node `v24.18.0` and npm `11.16.0`:

| Check | Result |
| --- | --- |
| `npm run check` | Passed with 0 errors and 0 warnings; Astro emitted 2 existing inline-script hints. |
| `npm run test` | 50 test files and 623 tests passed. |
| `npm run verify:docs` | 16 documents and 77 relative links verified. |
| `npm run build` and production-artifact verification | Passed. |

## GitHub Release record

The annotated `v2.1.0` tag was read before release creation and remained at `0d59dc9210f38f5ab32dd8636604563bef8024a3` after it. The normal [jet-web 2.1.0 GitHub Release](https://github.com/jet-ds/jet-web/releases/tag/v2.1.0) was created from that existing tag at `2026-07-21T08:06:49Z`, marked Latest, and published without release assets. This records the existing deployed release bytes; it does not move the tag, alter the deployed commit, or trigger a deployment.

## Egregore identity checkpoint

Task 3 moved the complete maintained assistant identity to Egregore while preserving `/chatbot/`, `/chatbot/#softwareapplication`, the generic `/assistant/` artifacts, `/tools/chatbot/`, all model and runtime pins, and the released interaction behavior. `/licenses/egregore/` is now the canonical license document; the former name-bearing license route is redirect-only. Archived `2.1.0` files remain byte-identical, and no deployment or real-model download occurred during this checkpoint.

The identity contracts were written before the namespace move. The focused pre-move unit command failed across all seven selected files with 19 failing expectations, including the missing identity owner and old prompt, navigation, rendered, license, and artifact identities. After implementation, the following Node 24 evidence passed:

| Check | Result |
| --- | --- |
| Focused Egregore unit and component owners | 9 files and 126 tests passed. |
| `npm run check` | Passed with 0 errors and 0 warnings; Astro emitted 2 existing inline-script hints. The separate prerequisite commit `030ffd3` repairs a type-only semantic-token test regression reproduced at the exact Task 3 starting commit. |
| `npm test` | 46 test files and 548 tests passed. |
| `npm run build` and `npm run verify:production-artifacts` | Passed; the generated license and runtime surfaces are complete and the fake-runtime seam is absent. |
| Focused Egregore, site, and accessibility browser owners | 220 tests passed and 20 intentionally skipped. An earlier timing-sensitive lifecycle timeout passed in isolation before the complete command passed on rerun. |
| Active documentation links | 8 documents and 94 relative links verified. |
| Frozen `docs/archive/releases/2.1.0/` checksum | All 6 tracked files matched the pre-task SHA-1 checksum manifest. |
| Standard `npm run verify` gate | Passed end to end after making the reload-escape unit owner independent of the intentionally rotating loading headline. |

## Physical-device baseline

| Field | Observed fact |
| --- | --- |
| Device | Xiaomi 14T |
| Operating system | Android 16 |
| Browser | Chrome `150.0.7871.128` |
| Physical display | `1220 × 2712` |
| Density | `520` |
| Current refresh rate | `60 Hz` |
| Observed page width | `375` CSS pixels |

Memory pressure remains plausible but unproven. The probe observed approximately `11.6 GB` total memory and `3.8 GB` available memory, alongside historical Chrome low-memory exits. No event was retained that correlates those exits with the Jet's Ghost 2.1 termination.

## Baseline constraints

- The `v2.1.0` tag and deployed commit are historical release bytes and must not move.
- No deployment was initiated for this baseline work.
- Future real-device evidence must record the available CSS and visual viewport for each state rather than infer a fixed viewport height from display pixels.
- Keep the phone disconnected until deterministic Tasks 8 and 9 code, tests, and bounded instrumentation are ready. Its first connected session is a cool-device, no-model layout/state and dock trace; retain the connection for bounded ADB/Chrome runtime evidence afterward, or cool and reconnect once if the final candidate requires it.
- The future cold path records separately: network transfer; cache commit/reread; LiteRT import/WASM initialization; engine/model readiness; retrieval/prompt assembly; send-to-first-nonempty chunk; total generation; response size and token rate only where a trustworthy token count exists; process/GPU/system-memory snapshots; thermal state; and renderer/GPU/Chrome/LiteRT termination classification. These are bounded diagnostic evidence, not permanent telemetry or preset latency thresholds, and logs contain no conversation content or root-only assumptions.
- Cache reuse must prove zero model-network requests on the warm path and separately capture its bounded non-transfer spans: cache reread; LiteRT import/WASM initialization; engine/model readiness; retrieval/prompt assembly; send-to-first-nonempty chunk; total generation; response size and token rate only where a trustworthy token count exists; process/GPU/system-memory snapshots; thermal state; and renderer/GPU/Chrome/LiteRT termination classification. The cold run uses a closed dock to isolate model behavior; one warm cache-reuse pass uses the visible dock to couple the separately owned dock and runtime evidence. That warm result is integrated and descriptive, not an isolated cold-versus-warm inference benchmark, and it must not imply a warm network-transfer span beyond the zero-request proof.
- One successful cold/warm run is the minimum real-model qualification, not a cap on diagnosis. A site-controlled bottleneck may receive one narrow evidence-led optimization and matching confirmation, avoiding another approximately `2 GB` transfer unless the changed boundary genuinely requires a cold run. If evidence identifies no safe site owner or a platform limit, stop for a supported-device or explicit trade-off decision; do not weaken model, context, or answer quality, or repeat crashes/downloads for benchmarking.
