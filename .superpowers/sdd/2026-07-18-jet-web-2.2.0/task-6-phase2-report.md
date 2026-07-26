# Task 6 Phase 2: Astro 7 core platform matrix

## Status

Phase 2 is complete on Node `v24.18.0` with npm `11.16.0`. This report records only the Astro 7/core-platform matrix; Lucide 1.x and jest-dom 7 remain for later phases.

## Installed graph

| Package | Installed version | Placement |
| --- | --- | --- |
| `astro` | `7.1.3` | dependency |
| `@astrojs/mdx` | `7.0.3` | dependency |
| `@astrojs/react` | `6.0.1` | dependency |
| `@astrojs/partytown` | `2.1.7` | dependency |
| `@astrojs/check` | `0.9.9` | devDependency |
| `@astrojs/rss` | `4.0.19` | devDependency |
| `@astrojs/sitemap` | `3.7.3` | devDependency |
| `typescript` | `6.0.3` | devDependency |
| `react`, `react-dom` | `19.2.7` | dependency |
| `@types/react` | `19.2.17` | devDependency only |
| `@types/react-dom` | `19.2.3` | devDependency only |
| `framer-motion` | `12.42.2` | dependency |
| `esbuild` | `0.28.1` | devDependency |
| `tsx` | `4.23.1` | devDependency |
| `@vercel/blob` | `2.6.1` | dependency |
| `dotenv` | `17.4.2` | dependency |
| `unist-util-visit` | `5.1.0` | dependency |
| `@litert-lm/core` | `0.14.0` | unchanged dependency |

`npm ls` confirmed the direct graph above. Astro transitively supplies `@astrojs/markdown-remark`; no direct compatibility dependency was added.

## RED to GREEN evidence

1. The first `npm run check` after installation failed with `LegacyContentConfigError`: Astro 7 rejects `src/content/config.ts`.
2. The loader configuration moved unchanged to `src/content.config.ts`; the schema comment and contributor guidance now point to the new canonical location.
3. The next Astro check had no errors, but surfaced three TypeScript 6 hints because React types deprecate `FormEvent`. The Egregore submit-handler types changed to the semantically correct `SubmitEvent`.
4. The resulting Astro check reported 166 files with 0 errors, 0 warnings, and 0 hints. The two Partytown diagnostics were cleared by adding explicit `is:inline` to the existing Partytown analytics scripts; their Partytown type and runtime behavior are unchanged.

The generated `dist/index.html` retains both `type="text/partytown"` analytics scripts, the GA4 loader URL, `send_page_view: false`, and the existing `astro:page-load` page-view handler.

## Verification

| Command | Result |
| --- | --- |
| `node --version`; `npm --version` | `v24.18.0`; `11.16.0` |
| `npm ci` | Passed; installed 864 packages from the lockfile |
| `npm run format:check` | Passed |
| `npm run lint` | Passed with zero warnings allowed |
| `npm run check` | Passed: 166 files, 0 errors, 0 warnings, 0 hints |
| `npx tsc --noEmit` | Passed |
| `npm test` | Passed: 46 files, 548 tests |
| `npm run verify:docs` | Passed: 8 documents, 94 relative links |
| `npm run build` | Passed: content policy plus 12 static pages |
| `npm run verify:build-purity` | Passed |
| `npm run verify:production-artifacts` | Passed; exact existing log wording and assertion were not changed |
| `npm run verify:browser` | 260-test complete matrix; one isolated Chromium failure, detailed below |
| `npx playwright test --last-failed` | Passed: the one failed image-card test passed without a source change |
| `npm ls` for the Phase 2 graph | Passed; direct versions match the table above |
| `npm audit --omit=dev` | Passed: 0 vulnerabilities |
| `git diff --check` | Passed before staging |

The browser matrix covers the maintained light/dark, compact/mobile, desktop, metadata, keyboard, accessibility, ClientRouter, filters, dock, and Egregore fake-runtime contracts. No rendered compatibility failure appeared that required a manual visual correction or an additional broad browser run.

## Isolated flake

The complete matrix recorded one failure in Chromium: `tests/e2e/site.spec.ts` — `image-backed content cards clip media and expose a visible keyboard boundary`. The immediate `--last-failed` retry passed in 2.4 seconds without any source change. It is recorded as an isolated test flake; no broad rerun was made, preserving the single complete browser-matrix run for this phase.

## Changed files

- `AGENTS.md`
- `README.md`
- `astro.config.mjs`
- `package.json`
- `package-lock.json`
- `src/content.config.ts` (moved from `src/content/config.ts`)
- `src/schemas/content.ts`
- `src/components/seo/GoogleAnalytics.astro`
- `src/features/egregore/EgregoreExperience.tsx`
- `docs/verification/jet-web-2.2.0.md`
- `.superpowers/sdd/2026-07-18-jet-web-2.2.0/task-6-phase2-report.md`

## Protected boundaries and concerns

- The Phase 1 Tailwind 4 compatibility bridge remains unchanged: the Vite plugin, JavaScript token owner, custom dark variant, explicit container-width compatibility, unlayered prose-link recipe, and `TableOfContents` reference are intact. No CSS-first `@theme` or semantic-token rewrite was introduced.
- `compressHTML: true` is explicit. Astro uses its default Sätteri renderer. There is no direct `@astrojs/markdown-remark` addition, CSP configuration, SSR adapter, TypeScript 7, model/runtime change or download, Lucide 1.x upgrade, jest-dom 7 upgrade, tracked screenshot, or terminal-environment configuration.
- The production-artifact verifier and its log wording were not edited.
- `npm ci` reports seven high-severity findings in the full installed tree, while `npm audit --omit=dev` reports zero production findings. No out-of-scope dependency upgrade was used to suppress the full-tree report.
- Vite 8 emits upstream deprecation notices from the React plugin's esbuild options. The browser runner also reports inherited `NO_COLOR`/`FORCE_COLOR` environment noise. Neither is addressed with repository configuration in this phase.
