# Jet Web 2.2.0 verification baseline

**Baseline status:** Established 2026-07-21; product implementation has not begun.

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

At task start, the expected pre-implementation workspace changes were the frozen [2.1.0 qualification and follow-up record](./jets-ghost-2.1.0.md) and user-owned material under `Untracked/`. The latter was not inspected, altered, or staged.

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
