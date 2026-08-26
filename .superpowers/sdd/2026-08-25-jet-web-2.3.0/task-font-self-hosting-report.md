# Task report: self-host site fonts

## Scope and implementation

- Base commit: `1686959` (`fix(analytics): harden consent and route measurement`).
- Added exact production dependencies: `@fontsource/brawler@5.3.0`, `@fontsource-variable/work-sans@5.3.0`, and `@fontsource-variable/jetbrains-mono@5.3.0`.
- Added `src/styles/fonts.css`, using only Latin normal WOFF2 files. Brawler remains discrete `400` and `700`; Work Sans and JetBrains Mono use their local variable files over the required `400 700` range, which supplies `400`, `500`, `600`, and `700` without shipping italic or non-Latin subsets. Every declaration preserves `font-display: swap` and the established family names.
- Imported that stylesheet from `src/styles/global.css`; removed the Google stylesheet and both preconnects from `src/components/layout/BaseLayout.astro`.
- Removed the now-obsolete Google Fonts exception from `tests/e2e/egregore.spec.ts`'s request allowlist. No permanent Google-domain browser test was retained.
- Extended the public `/licenses/THIRD_PARTY_NOTICES.md` surface with each font family, exact package/version, author attribution, and the SIL Open Font License 1.1. Fontsource is identified only as a build-time package source, never as the font author.

## Registry and license evidence

On 2026-08-26, `npm view` returned version `5.3.0` and `OFL-1.1` for all three required packages. Installed package metadata and license files identify the Brawler Project Authors (2011), Work Sans Project Authors (2019), and JetBrains Mono Project Authors (2020).

## RED → GREEN

1. A temporary `tests/e2e/font-self-hosting.development.spec.ts` observed five Google Fonts requests from the prior homepage and failed as expected.
2. After the local imports and head cleanup, the same temporary browser check passed with no Google Fonts request.
3. The temporary test was removed before finalization, as requested.

## Verification

- `npx prettier --check package.json package-lock.json src/styles/fonts.css src/styles/global.css src/components/layout/BaseLayout.astro THIRD_PARTY_NOTICES.md tests/e2e/egregore.spec.ts` — pass.
- `npm run check` — pass: 0 errors, 0 warnings, 0 hints.
- `npm run build` — pass; content verification passed (10 entries, 10 tracked assistant sources).
- Built-artifact inspection — no `fonts.googleapis.com` or `fonts.gstatic.com` reference in `dist`; the emitted CSS references four local WOFF2 assets for Brawler 400/700, Work Sans variable Latin, and JetBrains Mono variable Latin.
- `npm run capture:og -- --output=public/images/font-self-hosting-check.jpg` — pass, exercising the existing Brawler and Work Sans font-readiness contract; its temporary output was removed from the repository.
- `PLAYWRIGHT_FORCE_FRESH_SERVER=1 npx playwright test tests/e2e/egregore.spec.ts --project=chromium` — pass: 7/7.
- `npm run test -- tests/unit/egregore/licenses.test.ts` — pass: 5/5.
- `npm audit --omit=dev` — 0 vulnerabilities.
- `npm audit` — 0 vulnerabilities.

An initial Egregore run failed only because it overlapped the OG capture's independent build/preview lifecycle; the clean, sequential rerun above passed.

## Self-review

- Verified exact pinned dependency versions in both `package.json` and `package-lock.json`.
- Verified that added font assets are local, Latin-only, normal-style WOFF2 files and that no italic or unrelated-script assets are emitted.
- Verified that requested family names, requested weight coverage, `font-display: swap`, and the OG readiness checks remain intact.
- Verified the active analytics/privacy and carousel changes were neither staged nor included in this task's commit.

## Commit

`feat(fonts): self-host site typography`

## Node 24 verification review (2026-08-26)

All commands in this review ran with `/Users/jet/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin` first in `PATH`:

- `node --version` — `v24.19.0`.
- `npx prettier --check package.json package-lock.json src/styles/fonts.css src/styles/global.css src/components/layout/BaseLayout.astro THIRD_PARTY_NOTICES.md tests/e2e/egregore.spec.ts` — pass.
- `npm run check` — pass: 0 errors, 0 warnings, 0 hints.
- `npm run test -- tests/unit/egregore/licenses.test.ts` — pass: 5/5.
- `npm audit --omit=dev` and `npm audit` — both report 0 vulnerabilities.
- `npm run build` — pass; build inspection again found no Google Fonts URL and emitted exactly the four expected local Latin WOFF2 assets.
- `npm run capture:og -- --output=public/images/font-self-hosting-node24-check.jpg` — pass, including the existing font-readiness checks; the temporary output was moved outside the repository.
- `PLAYWRIGHT_FORCE_FRESH_SERVER=1 npx playwright test tests/e2e/egregore.spec.ts --project=chromium` — pass: 7/7. The request allowlist therefore accepted only the post-self-hosting local font asset path, with the obsolete Google font exception absent.

## Concern resolution

The initial Node 26 provenance concern is resolved by the clean Node `v24.19.0` re-run above. Vite continues to emit its pre-existing esbuild deprecation warnings, but `astro check` reports 0 project diagnostics.
