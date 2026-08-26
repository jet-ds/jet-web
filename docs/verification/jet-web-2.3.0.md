# Jet Web 2.3.0 verification record

**Status:** Task 1 dependency refresh evidence and Task 10 pre-perturbation test
contract evidence recorded. Counts in this document are dated observations, not
permanent dependency, security, coverage, or suite-size assertions.

## Immutable baseline

| Field                       | Verified value                                                                                |
| --------------------------- | --------------------------------------------------------------------------------------------- |
| Canonical repository        | `/Users/jet/jet-web`                                                                          |
| Implementation branch       | `codex/jet-web-2.3.0`                                                                         |
| Task-start commit           | `46442860b88c568546fc0a396001a7d668fb149e`                                                    |
| `origin/main` at task start | `d87a8709141d1f843c80971587ecec734c7fd7a4`                                                    |
| Workspace at task start     | Clean; `git status --short` reported no dirty paths.                                          |
| Runtime                     | Node `v24.18.0`; npm `11.16.0`                                                                |
| Node contract               | `package.json` declares `24.x`; `.nvmrc` and both routine GitHub Actions jobs select Node 24. |

The task-start commit contains the approved 2.3.0 design and plan. Commit
`1a4406b` adds those documents on top of `d87a870`; commit `4644286` clarifies
their execution boundaries. `git merge-base --is-ancestor d87a870 HEAD`
returned success before any task mutation.

The baseline configuration inspection found a static Astro build, the existing
React/MDX/Tailwind integrations, Playwright's built-site browser boundary, and
Vitest's jsdom unit/integration boundary. No server adapter, hosted generation
fallback, runtime/model switch, or configuration change is part of this task.

## Baseline direct dependency matrix

The following versions were read from `package.json` before mutation.

### Runtime dependencies

| Package                                    | Baseline                     |
| ------------------------------------------ | ---------------------------- |
| `@astrojs/mdx`                             | `7.0.3`                      |
| `@astrojs/partytown`                       | `2.1.7`                      |
| `@astrojs/react`                           | `6.0.1`                      |
| `@litert-lm/core`                          | `0.14.0`                     |
| `@vercel/blob`                             | `2.6.1`                      |
| `astro`                                    | `7.1.3`                      |
| `dotenv`                                   | `17.4.2`                     |
| `framer-motion`                            | `12.42.2`                    |
| `gray-matter`                              | `^4.0.3`                     |
| `lucide-react`                             | `1.25.0`                     |
| `minisearch`                               | `7.2.0`                      |
| `ogl`                                      | `^1.0.11`                    |
| `react` / `react-dom`                      | `19.2.7` / `19.2.7`          |
| `remark-gfm`                               | `4.0.1`                      |
| `remark-mdx` / `remark-parse`              | `3.1.1` / `11.0.0`           |
| `stemmer` / `unified` / `unist-util-visit` | `2.0.1` / `11.0.5` / `5.1.0` |

### Development dependencies

| Package                                                                           | Baseline                                 |
| --------------------------------------------------------------------------------- | ---------------------------------------- |
| `@astrojs/check` / `@astrojs/rss` / `@astrojs/sitemap`                            | `0.9.9` / `4.0.19` / `3.7.3`             |
| `@axe-core/playwright` / `@playwright/test`                                       | `4.12.1` / `1.61.1`                      |
| `@eslint/js` / `eslint` / `eslint-plugin-astro`                                   | `9.39.5` / `9.39.5` / `1.7.0`            |
| `@tailwindcss/typography` / `@tailwindcss/vite` / `tailwindcss`                   | `0.5.20` / `4.3.3` / `4.3.3`             |
| `@testing-library/jest-dom` / `@testing-library/react`                            | `7.0.0` / `16.3.2`                       |
| `@types/mdast` / `@types/react` / `@types/react-dom`                              | `4.0.4` / `19.2.17` / `19.2.3`           |
| `@webgpu/types`                                                                   | `0.1.71`                                 |
| `cross-env`                                                                       | `10.1.0`                                 |
| `esbuild`                                                                         | `0.28.1`                                 |
| `eslint-config-prettier` / `eslint-plugin-jsx-a11y` / `eslint-plugin-react-hooks` | `10.1.8` / `6.10.2` / `7.1.1`            |
| `globals` / `jsdom`                                                               | `17.7.0` / `29.1.1`                      |
| `prettier` / `prettier-plugin-astro`                                              | `3.9.5` / `0.14.1`                       |
| `tsx` / `typescript` / `typescript-eslint` / `vitest`                             | `4.23.1` / `6.0.3` / `8.64.0` / `4.1.10` |

## Pre-mutation verification and audit snapshot

`npm ci` installed 864 packages and audited 865. The complete Node 24
`npm run verify` gate then passed: Prettier and ESLint were clean; Astro checked
173 files with 0 errors, warnings, or hints; 48 Vitest files and 556 tests
passed; 10 documents and 92 relative links were verified; the static build
produced 16 pages; and the production-artifact verifier confirmed the complete
runtime/license surfaces with no fake-runtime seam.

The audit observations captured immediately afterward were:

| Audit view           | Info | Low | Moderate | High | Critical | Total | Families                                                                |
| -------------------- | ---: | --: | -------: | ---: | -------: | ----: | ----------------------------------------------------------------------- |
| Full installed graph |    0 |   0 |        1 |    5 |        0 |     6 | `brace-expansion`, `fast-uri`, `js-yaml`, `nanoid`, `postcss`, `undici` |
| `--omit=dev` graph   |    0 |   0 |        2 |    2 |        0 |     4 | `js-yaml`, `nanoid`, `postcss`, `undici`                                |

The six families corresponded to
`GHSA-mh99-v99m-4gvg`/`GHSA-rgw5-rvv9-x895` (`brace-expansion`),
`GHSA-v2hh-gcrm-f6hx`/`GHSA-7p8r-x3mc-p8w7` (`fast-uri`),
`GHSA-5p4m-2wfm-xmqj` (`js-yaml`), `GHSA-2v37-7h3g-55p8`
(`nanoid`), `GHSA-fxqj-rqcc-2cmp` (`postcss`), and the then-current
Undici 6.x/7.x retry, cache-control, CRLF, and cookie advisories. All six were
transitive findings; none was a direct root dependency.

## Step 1b advisory-path binding

Before `package.json` or `package-lock.json` changed, the exact required
`npm explain`, full-tree, production-tree, and combined JSON-path commands ran.
`git diff -- package.json package-lock.json` was empty afterward. The JSON
snapshots were retained for the task run at:

- `/tmp/jet-web-2.3.0-resolved-tree-before.json`
- `/tmp/jet-web-2.3.0-production-tree-before.json`
- `/tmp/jet-web-2.3.0-advisory-paths-before.json`

The resolved binding was:

| Advisory node            | Root-dependent chain observed before mutation                                                                                                        | Root relationship                                   | Reachability classification                                               |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- | ------------------------------------------------------------------------- |
| `brace-expansion@1.1.16` | `eslint@9.39.5` / `eslint-plugin-jsx-a11y@6.10.2` -> `minimatch@3.1.5` -> node                                                                       | Transitive from direct dev dependencies             | Build/development-only; absent from `npm ls --omit=dev --all`.            |
| `brace-expansion@5.0.7`  | `typescript-eslint@8.64.0` -> `@typescript-eslint/typescript-estree@8.64.0` -> `minimatch@10.2.5` -> node                                            | Transitive from a direct dev dependency             | Build/development-only; absent from the production-only tree.             |
| `fast-uri@3.1.3`         | `@astrojs/check@0.9.9` -> `@astrojs/language-server@2.16.12` -> `volar-service-yaml@0.0.71` -> `yaml-language-server@1.23.0` -> `ajv@8.20.0` -> node | Transitive from a direct dev dependency             | Build/development-only; absent from the production-only tree.             |
| `js-yaml@4.3.0`          | `astro@7.1.3` -> node; `@astrojs/mdx@7.0.3` -> `@astrojs/internal-helpers@0.10.1` -> node; an additional ESLint path was dev-only                    | Transitive from direct runtime and dev dependencies | Production-reachable in the installed dependency graph through Astro/MDX. |
| `js-yaml@3.15.0`         | `gray-matter@4.0.3` -> node                                                                                                                          | Transitive from a direct runtime dependency         | Production-reachable in the installed dependency graph.                   |
| `nanoid@3.3.16`          | `astro@7.1.3` / `@astrojs/react@6.0.1` -> `vite@8.1.5` -> `postcss@8.5.19` -> node; an additional ESLint-plugin path was dev-only                    | Transitive from direct runtime and dev dependencies | Production-reachable through the Astro/React Vite graph.                  |
| `postcss@8.5.19`         | `astro@7.1.3` / `@astrojs/react@6.0.1` -> `vite@8.1.5` -> node; additional Tailwind, Vitest, and ESLint-plugin paths were dev-only                   | Transitive from direct runtime and dev dependencies | Production-reachable through the Astro/React Vite graph.                  |
| `undici@6.27.0`          | `@vercel/blob@2.6.1` -> node                                                                                                                         | Transitive from a direct runtime dependency         | Production-reachable in the installed dependency graph.                   |
| `undici@7.28.0`          | `jsdom@29.1.1` -> node                                                                                                                               | Transitive from a direct dev dependency             | Build/development-only; absent from the production-only tree.             |

No advisory was a stale audit node: every reported node existed in the full
resolved tree. The production classification above means present in the
`--omit=dev` install graph; the deployed site remains static output and does not
execute these Node packages in the visitor browser.

## Reviewed update boundary

The approved matrix updates Astro and its MDX/React integrations, React, Vercel
Blob, Lucide, the listed same-major development tools, and adds exact
`react-markdown@10.1.0` plus exact dev-only `sharp@0.35.3`. It retains exact
`remark-gfm@4.0.1`, TypeScript `6.0.3`, Tailwind `4.3.3`, Framer Motion
`12.42.2`, and LiteRT-LM `0.14.0`. ESLint 10, `eslint-plugin-astro` 3, jsdom 30,
Framer Motion 13, TypeScript 7, and LiteRT-LM 0.16 remain excluded.

## Final dependency and audit disposition

The two exact install commands applied the reviewed direct matrix. The required
non-forcing `npm audit fix --package-lock-only` then refreshed only compatible
lockfile resolutions; it added no override or resolution block. Review of the
complete package-entry version diff found no hidden direct major update. The
larger transitive movement belongs to the approved Astro 7.2.6, Astro Check
0.9.10, TypeScript-ESLint 8.68.0, and their coupled compiler, Markdown, Satteri,
Volar, Yargs, and platform-package graphs. The direct excluded lines remain
ESLint 9.39.5, `eslint-plugin-astro` 1.7.0, jsdom 29.1.1, Framer Motion 12.42.2,
TypeScript 6.0.3, and LiteRT-LM 0.14.0.

The root graph readback after a clean `npm ci` reported:

| Boundary                                                | Final version                                                                     |
| ------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Astro / MDX / React integration                         | `7.2.6` / `7.0.8` / `6.0.4`                                                       |
| React / React DOM                                       | `19.2.8` / `19.2.8`                                                               |
| Vercel Blob / Lucide React                              | `2.8.0` / `1.34.0`                                                                |
| React Markdown / Remark GFM                             | `10.1.0` / `4.0.1`                                                                |
| Astro Check / Axe Playwright / Playwright               | `0.9.10` / `4.13.0` / `1.62.1`                                                    |
| jest-dom / React types / React DOM types / WebGPU types | `7.0.1` / `19.2.18` / `19.2.5` / `0.1.72`                                         |
| esbuild / globals / Prettier / tsx                      | `0.28.2` / `17.11.0` / `3.9.6` / `4.23.12`                                        |
| TypeScript-ESLint / Vitest                              | `8.68.0` / `4.1.11`                                                               |
| Protected pins                                          | TypeScript `6.0.3`; Tailwind `4.3.3`; Framer Motion `12.42.2`; LiteRT-LM `0.14.0` |

### Advisory closure

The clean install contained the following patched resolutions. The full audit
and the `--omit=dev` audit each reported 0 known vulnerabilities on 2026-08-25.

| Initial family    | Patched installed resolution(s) | Disposition                                                                                                                         |
| ----------------- | ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `brace-expansion` | `1.1.18`, `5.0.9`               | Both development-only paths upgraded beyond the reported ranges.                                                                    |
| `fast-uri`        | `3.1.6`                         | Astro Check/YAML-language-service path upgraded.                                                                                    |
| `js-yaml`         | `3.15.1`, `4.3.1`               | Gray Matter and Astro/MDX/ESLint paths upgraded.                                                                                    |
| `nanoid`          | `3.3.18`                        | PostCSS child upgraded.                                                                                                             |
| `postcss`         | `8.5.26`                        | Shared Astro/React/Tailwind/Vitest/ESLint-plugin resolution upgraded.                                                               |
| `undici`          | `6.28.0`, `7.29.0`              | Vercel Blob production path and jsdom development path upgraded. Astro 7.2.6 also introduces clean `undici@8.10.0` through Unifont. |

No residual-risk exception or upstream-blocked advisory remains for this dated
graph.

### Sharp disposition

`sharp@0.35.3` is exact and direct in `devDependencies`, making the repository's
remote-image metadata decoder explicit instead of relying on Astro's optional
copy. Its package and lock metadata declare Apache-2.0 and Node `>=20.9.0`.
The package exposes a manual `build` script but no `preinstall`, `install`, or
`postinstall` lifecycle script; accordingly, the clean npm allow-scripts report
did not list Sharp. It uses platform-specific optional binary packages, the
clean install succeeded on Node 24, and both audit views reported zero findings.

### Task gate

The first post-refresh `npm run verify` attempt intentionally remains recorded:
it stopped at `format:check` because this newly created record had not yet been
formatted. `npx prettier --check` reproduced that exact single-file failure;
`npx prettier --write docs/verification/jet-web-2.3.0.md` fixed the source, and
the focused Prettier check then passed. The complete final gate result is
recorded after the final-file-set rerun below.

| Check                                       | Result                                                                                                                                                                                                                                                    |
| ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm ci`                                    | Passed; installed 849 packages and audited 850.                                                                                                                                                                                                           |
| `npm audit`                                 | Passed; 0 known vulnerabilities.                                                                                                                                                                                                                          |
| `npm audit --omit=dev`                      | Passed; 0 known vulnerabilities.                                                                                                                                                                                                                          |
| Exact root/version readback                 | Passed; reviewed matrix and protected pins matched.                                                                                                                                                                                                       |
| `npm run verify` against the final file set | Passed: formatting and lint were clean; Astro checked 173 files with 0 diagnostics; 48 Vitest files and 556 tests passed; 10 documents and 92 links were verified; 16 pages built; production artifacts were complete and contained no fake-runtime seam. |

## Task 10 pre-perturbation test-contract audit

Before editing, every tracked test block was catalogued with its observable
contract, narrowest adequate boundary, failure value, and a keep, merge, demote,
delete, or refactor disposition. That temporary working inventory was reviewed
but deliberately not retained as repository policy: it was evidence for this
slice, while the surviving tests remain the executable contracts.

### Dated suite observations

| Boundary                       | Before compaction                                                                 | Reviewed candidate                                       | Interpretation                                                                                                                                                                                                            |
| ------------------------------ | --------------------------------------------------------------------------------- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Regular Vitest suite           | 57 files, 695 cases, 13.30 seconds                                                | 56 files, 693 cases, 9.30 seconds                        | Two fixed-current-record SEO cases and their duplicate image scan were removed or demoted to the shared schema owner; broad deterministic policy, resolver, runtime, license, build, CI, and deployment coverage remains. |
| Routine browser source cases   | 177 across 5 files                                                                | 29 across the same 5 files                               | Browser ownership is limited to behavior that requires a real navigation, focus, pointer, responsive/computed-layout, animation, no-JavaScript, or composed accessibility boundary.                                       |
| Routine browser project cases  | 354 total; 292 passed, 55 project-mismatch skips, 7 known failures in 1.9 minutes | 37 total; 37 passed, 0 skipped, 0 failed in 20.3 seconds | Project declarations now express desktop/mobile ownership without conditional mismatch skips; retries remain zero. These counts are observations, not preservation targets.                                               |
| Production deployment boundary | 8 cases                                                                           | 8 cases                                                  | Production-only redirect/header behavior remains separate from built-site Playwright coverage.                                                                                                                            |
| Real-model qualification       | One explicitly opt-in conditional skip                                            | One explicitly opt-in conditional skip                   | The approximately 2 GB operator qualification retains its documented manual value and remains outside routine CI.                                                                                                         |

The candidate removes 3,620 net lines from the tracked diff before this record
and replaces repetition with narrower artifact and configuration owners. Test
count and line reduction were not goals: each deletion or merge had to leave a
named durable contract at the lowest boundary that could detect a meaningful
failure.

### Surviving routine browser ownership

| File                         | Source cases | Routine project cases | Browser-only failure value                                                                                                                                                                                                                                             |
| ---------------------------- | -----------: | --------------------: | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `accessibility.spec.ts`      |            5 |                     5 | Representative theme-aware axe scans, keyboard-visible dominant destinations, rendered link contrast, Grainient disposal under reduced motion, and sequential mobile disclosure focus.                                                                                 |
| `collection-filters.spec.ts` |            3 |                     6 | No-JavaScript collection availability, real URL/history behavior for Blog search, and native Works filter state across desktop and mobile.                                                                                                                             |
| `egregore.spec.ts`           |            9 |                     9 | Inert model-authored markup; whole-browser consent, request-privacy, and lazy-runtime staging; responsive lifecycle geometry; representative recovery; persisted dock choice; reduced motion; cancel/reload; sticky conversation following; and ClientRouter teardown. |
| `homepage-carousel.spec.ts`  |            6 |                     8 | Canonically ordered no-JavaScript destinations, finite manual looping and focus, pointer/scroll arbitration, responsive transformed geometry, real mobile hit/actionability at each visible depth, and idle/reduced-motion behavior.                                   |
| `site.spec.ts`               |            6 |                     9 | Compact navigation/dock separation, responsive hub geometry, desktop sticky reading navigation, mobile disclosure/dock/fragment focus, persisted theme/navigation state, and theme-aware image readiness.                                                              |

Assertions about exact current entries, fixed card counts, incidental copy,
private CSS classes or wrappers, collaborator call order, historical pixel
bands, and duplicated fake-runtime scenarios were deleted, merged, or moved to
deterministic owners. The regular suite was treated conservatively: the only
deleted file, `tests/unit/seo/contentMetadata.test.ts`, encoded a fixed title
inventory and historical length heuristic; its general image requirement
already belongs to the shared content schema.

### Carry resolution and operational owners

| Prior carry                                      | Root-cause disposition                                                                                                                                                                                     |
| ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Hidden Homepage fallback selected as a card      | Tests now select the active public destination and observable card geometry instead of enhancement-hidden markup.                                                                                          |
| Theme-aware Work image assertion                 | The browser owner observes a ready, visible image through a theme transition rather than requiring a particular number of image nodes.                                                                     |
| Legacy Egregore renderer/license inventory       | The retained tests derive the runtime and notice surface from the current release contract; built artifacts remain the operational owner.                                                                  |
| Parallel Egregore load failures and timing waits | One fresh foreground server owns each run, and test-owned release signals synchronize fake-runtime lifecycle changes without cadence sleeps or larger timeouts.                                            |
| Exact fake-scenario method order                 | Authorization and method membership are asserted at the deterministic boundary; the browser privacy traversal separately proves pre-load, post-load/pre-prompt, and post-prompt staging.                   |
| Chromium CDP `lvh`/`svh` emulation               | Current Chromium no longer honors that synthetic override. The emitted Egregore artifact now proves the standardized `100svh` shell contract, while real small-viewport browser geometry proves usability. |
| Reused or detached Playwright server             | `PLAYWRIGHT_FORCE_FRESH_SERVER=1` disables reuse, and both routine and release configurations own a foreground build-and-preview process with zero retries.                                                |

`playwright.release.config.ts` adds an explicit current Chromium, Firefox, and
WebKit release matrix. Routine CI remains Chromium plus mobile Chromium. Static
configuration tests bind the release project names to their actual engines,
zero retries, and the build-owned server command/environment. Built-artifact
tests also derive the ordered no-script, Footer, dock, and JSON-LD navigation
projections from `NAV_ITEMS`, including wrong-label and divergent-destination
regressions, rather than freezing current page copy in a browser test.

### RED, GREEN, and contract revalidation

The repaired candidate was challenged with temporary local mutations before
approval. Eager conversation creation during `Load Egregore`, reversed
no-JavaScript carousel destinations, and autoplay for ordinary motion
preferences each failed its intended focused browser assertion. Restoring the
product contracts returned all three cases green. The final assertions require
conversation creation, token counting, and generation to remain absent until
the visitor sends a prompt; compare fallback destinations to resolver-derived
canonical order; and prove ten minutes of idle stability for both ordinary and
reduced-motion visitors while preserving manual operation.

Two independent reviewers rejected earlier candidates where browser-only
privacy, recovery, responsive geometry, mobile actionability, navigation
projection, and history contracts had been over-demoted or privately coupled.
After bounded repairs and repeated targeted review, both reviewers approved the
same frozen candidate with no remaining findings. The pre-commit Node 24 gates
on that candidate are recorded below; subsequent isolated perturbation and
multi-engine qualification are recorded in the final Task 10 section.

| Pre-commit gate                | Result                                                                                                                                                                                                                                                                                                                                                 |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Focused mutation RED           | 3 of 3 intentional defects detected at their intended browser owners.                                                                                                                                                                                                                                                                                  |
| Focused repaired browser cases | 3 of 3 passed.                                                                                                                                                                                                                                                                                                                                         |
| Focused deterministic owners   | 3 files and 91 tests passed.                                                                                                                                                                                                                                                                                                                           |
| Complete `npm run verify`      | Passed on Node `v24.19.0` and npm `11.12.1` in 25.15 seconds: formatting and lint were clean; Astro checked 198 files with 0 diagnostics; 56 Vitest files and 693 tests passed in 9.30 seconds; 11 documents and 92 relative links passed; content policy verified 9 entries and 9 assistant sources; 16 pages built; and production artifacts passed. |
| Forced-fresh routine browser   | Passed 37 of 37 on the first attempt with 0 skips in 20.3 seconds (20.62 seconds wall time); the build-owned server exited and left no port `4321` listener.                                                                                                                                                                                           |
| Browser listing and skip scan  | 37 routine project cases in 5 files; 0 routine skips or orphaned project cases. The sole skip is the documented manual real-model opt-in.                                                                                                                                                                                                              |
