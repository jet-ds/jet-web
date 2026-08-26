# Jet Web 2.3.0 search polish verification

**Scope:** Pre-release Blog search recall and input presentation only.

## Root cause and accepted contract

The original matcher required each query token to equal a complete indexed
token. That created deterministic dead zones while typing a longer word:
`Spider` matched the title token, but `Sp` through `Spide` did not; similarly,
`Spider-M` and `Spider-Ma` did not match until the second token was complete.

Search now applies one-way indexed-token prefix matching for eligibility. Its
ranking tuple retains exact field matches ahead of prefix-only matches, then
uses the existing publication-date and normalized-ID tie-breakers. This makes
incremental typing responsive without introducing edit-distance guesses,
semantic search, a hosted service, or another dependency.

The visible placeholder was removed. The field renders a left-aligned,
decorative magnifying-glass icon while retaining the visible `Search blog
posts` label and a programmatic description of the searchable fields and
live-update behavior.

## TDD and verification evidence

All authoritative commands used Node `v24.18.0` and npm `11.16.0` from
`/opt/homebrew/opt/node@24/bin`.

| Boundary                       | Result                                                                                                                                                                                                                                                                                                                                                                         |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Exact-token mutation RED       | `npm test -- tests/unit/content/blogSearch.test.ts` failed the two new incremental-prefix and exact-over-prefix cases; 14 existing cases remained green.                                                                                                                                                                                                                       |
| Restored implementation GREEN  | The same focused file passed 16 of 16.                                                                                                                                                                                                                                                                                                                                         |
| Focused deterministic boundary | `npm test -- tests/unit/content/blogSearch.test.ts tests/unit/content/collectionFilters.test.ts` passed 19 of 19.                                                                                                                                                                                                                                                              |
| Focused browser boundary       | `PLAYWRIGHT_FORCE_FRESH_SERVER=1 npm run verify:browser -- tests/e2e/collection-filters.spec.ts` passed 6 of 6 across desktop and mobile Chromium. This includes no-JavaScript Blog/Works access, search URL/history/focus/clear behavior, the icon/no-placeholder accessible control, and Works filter semantics.                                                             |
| Rendered inspection            | The search control was inspected at 1440px in light mode and 360px in dark mode. The icon remained visible, the field had no placeholder, and the input stayed within the compact viewport. Temporary screenshots were kept outside the repository and the inspection server was stopped.                                                                                      |
| Real published corpus          | A Node 24 readback placed `spider-man-brand-new-day` first for `S`, `Sp`, `Spi`, `Spid`, `Spide`, `Spider`, `Spider-`, `Spider-M`, `Spider-Ma`, and `Spider-Man`.                                                                                                                                                                                                              |
| Repository gate                | `npm run verify` exited 0 on the shared pre-RC candidate: formatting and lint passed; Astro reported 0 errors, 0 warnings, and the separately owned Zod deprecation hint; 61 Vitest files and 732 tests passed; 11 documentation files and 92 links passed; 9 content entries and 9 assistant sources passed; 16 pages built; structured data and production artifacts passed. |

## Ranking trade-off

Prefix search intentionally favors predictable recall over typo correction.
Very short queries can return several records, but title phrase/token positions
and exact-over-prefix ordering keep stronger matches ahead of metadata-only
matches. Misspellings remain unmatched rather than producing opaque fuzzy
results.
