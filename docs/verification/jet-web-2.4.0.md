# Jet Web 2.4.0 verification

Date: 2026-10-21. Release acceptance and deployment remain separate from this record.

The implementation follows the [approved media design](../superpowers/specs/2026-10-21-jet-web-2.4.0-media-design.md) and [repository workflow](../../AGENTS.md#image-workflow). It is on `codex/blob-transfer-2.4.0`, based on `46149edf72d300120e6e147d202392f2733931d9` after safely fast-forwarding the local checkout. No implementation plan was added.

## Implemented boundaries

- Raw originals are private. Content authors reference small tracked descriptors; pages, cards, responsive images, theme variants and social metadata resolve the same finite public rendition sets locally.
- Publishing is operator-only, immutable, bounded and resumable. A descriptor is saved only after the original and every rendition pass readback verification. Store credentials remain local and are bound to their intended stores.
- Builds and routine tests do not fetch Blob media. Build-purity probes cover global fetch, Node HTTP(S), and the Blob SDK's Undici dispatcher. Local browser qualification uses SHA-verified cached renditions; clean CI uses explicit synthetic dimension-correct fixtures.
- Legacy public URLs remain available for rollback. They require separately approved retirement after accepted and verified deployment; new metadata cannot stop existing direct requests to them.

## Storage evidence

The [migration manifest](../evidence/2.4.0-media-migration.json) records every legacy URL, full source SHA-256, byte count, descriptor key, publication/archive status and the retirement hold.

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
- Desktop/mobile acceptance qualification and final independent disposition are being recorded below before handoff.

The full `npm run verify` command in the user's working copy stops at a pre-existing formatting warning in the untracked `docs/superpowers/notes/2026-08-27-jet-web-2.4.0-build-notes.md`. Its SHA-256 remains `9370253e19b7cf36ecc3268917f3b5f8398c8a78aaefc5f5f0caf32c4b5d4d5d`, identical to the pre-update backup. The file is preserved and excluded from this change. A clean-checkout verification excludes this local-only file without rewriting it; the result will be recorded before acceptance.

Independent review found and drove fixes for descriptor tracking, cache-policy verification, legacy cache identity, SDK network interception and normalized Blob metadata validation. A browser assertion was corrected to compare selected rendition identity and encoded dimensions: responsive `naturalWidth`/`naturalHeight` are density-corrected and rounded, rather than exact encoded pixels.

No merge, push, deployment, legacy deletion, billing change or project permission change is included. The uploaded renditions do not change the currently deployed site's references until release.
