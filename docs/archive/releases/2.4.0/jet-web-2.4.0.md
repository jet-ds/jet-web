# Jet Web 2.4.0 verification

> Archived on 2026-10-22 as implementation history. Current contributor and operating requirements live in [AGENTS.md](../../../../AGENTS.md). Dated statuses, commands and evidence below describe their original checkpoints; archiving does not complete pending release, deployment or retirement actions.

Date: 2026-10-21. Release acceptance and deployment remain separate from this record.

The implementation follows the [approved media design](2026-10-21-jet-web-2.4.0-media-design.md) and [repository workflow](../../../../AGENTS.md#image-workflow). It is on `codex/blob-transfer-2.4.0`, based on `46149edf72d300120e6e147d202392f2733931d9` after safely fast-forwarding the local checkout. No implementation plan was added.

## Implemented boundaries

- Raw originals are private. Content authors reference small tracked descriptors; pages, cards, responsive images, theme variants and social metadata resolve the same finite public rendition sets locally.
- Publishing is operator-only, immutable, bounded and resumable. A descriptor is saved only after the original and every rendition pass readback verification. Store credentials remain local and are bound to their intended stores.
- Builds and routine tests do not fetch Blob media. Build-purity probes cover global fetch, Node HTTP(S), and the Blob SDK's Undici dispatcher. Local browser qualification uses SHA-verified cached renditions; clean CI uses explicit synthetic dimension-correct fixtures.
- Legacy public URLs remain available for rollback. They require separately approved retirement after accepted and verified deployment; new metadata cannot stop existing direct requests to them.

## Storage evidence

The [migration manifest](evidence/2.4.0-media-migration.json) records every legacy URL, full source SHA-256, byte count, descriptor key, publication/archive status and the retirement hold.

| Check                   | Verified result                                                                 |
| ----------------------- | ------------------------------------------------------------------------------- |
| Originals store         | `store_zuQm74IfTNAGny0B`, private, HKG1, correct team, zero project connections |
| Original archive        | 14 objects, 19,073,509 bytes                                                    |
| Anonymous archive probe | HTTP 403 on an unauthenticated HEAD request                                     |
| Public rendition store  | Existing `store_vYgE4WbMW8JGD8rh`                                               |
| Published descriptors   | 11                                                                              |
| Published renditions    | 63, 3,935,731 bytes total                                                       |
| Legacy public objects   | All 14 retained                                                                 |

Each original was downloaded once into an ignored cache. Reuse verifies the filename hash prefix and persisted full SHA-256. Upload receipts include full SHA-256, bytes, access, content type, cache policy and ETag; unchanged receipts avoid repeat media downloads. An independent reviewer decoded all 63 local rendition files and matched every descriptor's hash, byte count, format and dimensions. This is an asset inventory comparison, not a measured reduction in live traffic.

The actual About original is 3060×4080; the spec's earlier 1200×1600 source assumption was corrected. The private original is unchanged and public portrait renditions preserve 3:4 without cropping. All ten referenced Blog/Works originals are 1920×1080.

## Verification results

- Changed implementation files pass Prettier; ESLint passes with zero warnings.
- Astro check: zero errors, warnings and hints.
- Unit/integration suite: 73 files, 780 tests passed.
- Documentation links, content policy, local media validation, static build, linked structured data and production artifact checks passed.
- Build purity passed with media networking denied and repository input hashes/status unchanged.
- Media metadata and portrait qualification: six tests passed across Chromium, Firefox and WebKit.
- Desktop/mobile acceptance qualification: all 42 affected tests passed.
- Independent review approved the implementation after fix/re-review cycles, including an audit of all 63 rendition files and the corrected record-to-image identity check.

The full `npm run verify` command in the user's working copy stops at a pre-existing formatting warning in the untracked `docs/superpowers/notes/2026-08-27-jet-web-2.4.0-build-notes.md`. Its SHA-256 remains `9370253e19b7cf36ecc3268917f3b5f8398c8a78aaefc5f5f0caf32c4b5d4d5d`, identical to the pre-update backup. The file is preserved and excluded from this change. The complete `npm run verify` passed in a clean temporary checkout of implementation commit `99b8ea9`, with its own dependency tree and no media credentials. The initial symlinked-dependency attempt failed on Astro compile-path resolution and a fixture timeout; the self-contained rerun passed. This excludes the local-only note without rewriting it.

Independent review found and drove fixes for descriptor tracking, cache-policy verification, legacy cache identity, SDK network interception and normalized Blob metadata validation. A browser assertion was corrected to compare selected rendition identity and encoded dimensions: responsive `naturalWidth`/`naturalHeight` are density-corrected and rounded, rather than exact encoded pixels.

No merge, push, deployment, legacy deletion, billing change or project permission change is included. The uploaded renditions do not change the currently deployed site's references until release.

## Routine CI reliability hotfix

Read-only GitHub investigation covered all 140 available workflow runs through `2026-10-20T21:38:16Z`. Of the latest 30 scheduled runs, 2 failed (6.67%); of the latest 14, 1 failed (7.14%). Since the actual 2.3.1 merge at `2026-08-28T14:39:56Z`, 4 of 54 scheduled runs failed (7.41%), or 4 of 57 runs across all triggers (7.02%). These denominators include completed runs and exclude cancellations. Every inspected run used attempt 1; no reruns were requested.

All four post-2.3.1 failures passed `verify`; the browser job reported one failure and 63 passes. Each failed the reduced-motion/no-autoplay case while its shared setup tried to scroll a transient carousel sentinel:

- [October 20 UTC failure](https://github.com/jet-ds/jet-web/actions/runs/39501967492)
- [October 6 UTC failure](https://github.com/jet-ds/jet-web/actions/runs/37392010141)
- [September 17 UTC failure](https://github.com/jet-ds/jet-web/actions/runs/35276404424)
- [August 30 UTC failure](https://github.com/jet-ds/jet-web/actions/runs/33335542259)

Three logs show the node detaching during scrolling; the October 6 log shows the locator timing out after the preceding count succeeded. Hydration normally removes this sentinel. Counting it and then acting on it therefore races ordinary enhancement; the logs do not indicate a reduced-motion or autoplay regression. The latest failed run had no uploaded artifacts, so its historical trace cannot be recovered from Actions.

The hotfix scrolls the persistent section owner to its leading edge, then awaits the visible region by its accessible name. The leading edge matches the existing visibility boundary; application code and CSS are unchanged. All four transient scroll sites use this shared helper. Dedicated lazy-loading tests retain their before/after fallback and sentinel assertions. New browser cases protect canonical fallback links while scripts are deliberately gated and preserve selection/interaction when an already-ready carousel is revisited. Their data comes from the published collection resolver and selects a collection with at least two destinations.

Failures now upload Playwright evidence for seven days, with unique run/attempt names and no error if a failure occurs before evidence files exist. `actions/upload-artifact@v7` uses Node 24, consistent with the workflow runtime. Job names, required-check ordering, schedule, worker count, zero retries, timeouts and failure-on-flaky policy are unchanged.

The new workflow contract check was observed RED without artifact retention and GREEN after it was added. Assertions parse the workflow and check its evidence destination, failure condition and retention policy. Browser assertions cover rendered links, named-region readiness, selection and navigation rather than React helpers or module filenames. The controlled race reproduction remains investigation scaffolding outside the repository.

Broader validation exposed two additional test setup races, which were corrected without changing application behavior. The drag test captured its heading baseline during the existing 620 ms entrance transition (the trace's two heading measurements were 419 ms apart). It now awaits heading/ancestor animation completion before capturing the baseline and retains exact coordinate equality during drag. The new delayed-script case initially scrolled before WebKit finished document startup; after asserting the complete gated fallback, it now releases scripts, awaits the public document-load event and triggers visible enhancement. It protects delayed startup followed by enhancement, without claiming that a pre-load scroll remains intersecting through later layout changes.

Final hotfix validation:

- Full `npm run verify` passed in a clean temporary checkout containing the final patch: formatting, lint, Astro check, 73 unit/integration files with 781 tests, documentation links, content/media validation, production build, structured data and production artifacts.
- Final `CI=1 npm run verify:browser`: 72 passed with two workers and zero retries.
- Affected release-browser qualification: 21 passed across Chromium, Firefox and WebKit.
- Repetition checks: 60 desktop/mobile hydration/reduced-motion cases, ten drag cases and ten corrected WebKit delayed-startup cases passed with zero retries.
- `npm run verify:build-purity` passed after browser qualification, restoring production output with media networking denied and repository inputs unchanged.
- Independent review, fixes and re-review completed with no remaining findings. Existing local notes retained their original SHA-256 and remain outside the commit.

Remote improvement and artifact upload remain unmeasured until the branch runs on GitHub Actions; local browser qualification cannot establish a new remote failure rate.
