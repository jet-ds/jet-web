# Jet's Ghost 2.1.0 consolidation and residue audit

This record is separate from feature qualification. It documents the local consolidation of the approved Jet's Ghost implementation into the canonical `/Users/jet/jet-web` checkout and the disposition of modernization-only residue. It contains no user-authored draft content.

## Canonical integration identity

| Item | Evidence |
| --- | --- |
| Implementation commit integrated | `bba3045a801df686dbdef1c19b4fa40edf6a2dbb` |
| Implementation tree | `bd7bb49528f539346e0e902c91463e4d388c4e35` |
| Canonical checkout | `/Users/jet/jet-web` |
| Canonical integration branch | `codex/jets-ghost-2.1-canonical` during verification; final local branch name pending cleanup |
| Required runtime | Node `24.x`; final local gates use the bundled Node `24.14.0` runtime |
| Canonical bootstrap | Complete. The canonical checkout points to the exact implementation commit and tree. |
| Full canonical gate | Passed on the residue tree under bundled Node `24.14.0`: clean `npm ci`; 44 Vitest files and 577 tests; 208 Playwright checks with 20 intentional project skips; documentation and content verification; static build; production-artifact isolation; an additional production build; and `git diff --check`. |
| Temporary-worktree cleanup | Pending successful canonical verification and preservation checks. |

The original canonical checkout had no staged or unstaged tracked changes. Its pre-existing nonignored user-authored content was inventoried by path and filesystem metadata in a private mode-`0700` Git-state directory without opening or hashing its contents. A separate pre-existing QA scratch file in the temporary implementation worktree is likewise inventoried without opening or hashing it and will remain uncommitted under canonical `Untracked/` before the temporary worktree is removed.

## Residue dispositions

| Category | Disposition | Reason and owner |
| --- | --- | --- |
| Canonical `/chatbot/` route | Retain | Permanent first-class Jet's Ghost route. |
| `/tools/chatbot/` redirect | Retain | Permanent legacy redirect to canonical `/chatbot/`. |
| Dormant `/tools/` route | Retain | Intentional noindexed placeholder, outside navigation and sitemap. |
| Retired hosted generation endpoint | Absent | `/api/chat` has no handler or build artifact; containment remains covered by static-boundary and deployment tests. |
| Legacy browser RAG runtime | Absent | Replaced by the immutable corpus, MiniSearch rank-and-pack, and LiteRT-LM runtime. |
| Archive migration utility and unit test | Remove | One-time archive adoption is complete; the committed archive and manifest are the durable result. |
| Core 1.0 baseline-capture utility and tests | Remove | One-time modernization comparison tooling; the committed baseline evidence remains immutable. |
| Core 2.0 Blob-containment utility and tests | Remove | Hosted-chatbot containment is complete; committed sanitized containment evidence remains the historical record. |
| Core 2.0 production-containment verifier and tests | Remove | Superseded by the permanent static-boundary, production-artifact, deployment-route, and release readback suites. |
| Preview-toolbar routing test | Remove | It existed only to support the retired baseline-capture path. |
| Vercel evidence sanitizer and unit test | Retain | Permanent safe projection and secret-scanning boundary for Preview and Production deployment readback. |
| Model-delivery verifier and tests | Retain | Permanent trusted-origin, redirect-bound, byte-count, and qualification-hash verifier for the pinned model. |
| Production-artifact verifier | Retain | Permanent release gate proving no fake-runtime marker or incomplete runtime/license bundle reaches an ordinary build. |
| Content and documentation verifiers | Retain | Permanent publication, assistant-eligibility, tracked-content, and canonical-doc-link gates. |
| Fake runtime and scenario modules | Retain | Permanent deterministic browser-test infrastructure owned by the Jet's Ghost test suite. The test-build flag, localhost hostname, explicit query, and production-artifact rejection gates remain mandatory. |
| Browser, accessibility, lifecycle, and deployment suites | Retain | Permanent regression and release infrastructure for the local-first assistant and site-wide contracts. |
| Real-model qualification harness and fixed six-case fixture | Retain | Permanent opt-in release qualification; it cannot execute in ordinary test or production paths. |
| Obsolete generated chatbot artifact configuration | Remove locally | Untracked output of the retired Blob RAG build; no tracked executable path consumes it. |
| Build, dependency, test-output, and Superpowers scratch directories | Remove with temporary worktree or regenerate locally | Disposable implementation output, not durable project state. |
| Image-staging inputs and Vercel project link | Retain locally | Intentional authoring and deployment configuration, excluded from Git and unrelated to retired chatbot residue. |
| User-owned draft and QA files | Preserve uncommitted | Never inspected, staged, published, added to the assistant corpus, or deleted during consolidation. |
| Active modernization and Jet's Ghost specs/plans | Retain | They remain the architecture record and active release runbook through the 2.1.0 gate. Historical superseded material is already under `docs/archive/`. |
| Core baseline and containment evidence | Retain | Immutable historical evidence for the completed 2.0.0 containment and modernization release. |
| Dependency advisory refresh | Retain updated lockfile | `npm audit fix` updated packages only within declared compatible ranges, removing the critical and all moderate advisories; the remaining Astro-major advisories are assessed below. |

## Direct dependency ownership

Every direct package remaining in the manifest has a current production, build, authoring, or verification owner.

| Package | Scope and permanent purpose |
| --- | --- |
| `@astrojs/mdx` | Production build integration for MDX content. |
| `@astrojs/partytown` | Production analytics worker integration. |
| `@astrojs/react` | Production React-island integration. |
| `@litert-lm/core` | Explicitly activated local Gemma runtime. |
| `@types/react` | React build-time type declarations. |
| `@types/react-dom` | React DOM build-time type declarations. |
| `@vercel/blob` | Explicit image-authoring upload command; never invoked by the build. |
| `astro` | Static site framework and build. |
| `dotenv` | Explicit image-authoring command configuration. |
| `framer-motion` | Dock and Jet's Ghost state/response motion. |
| `gray-matter` | Deterministic assistant-corpus frontmatter ingestion. |
| `lucide-react` | Shared interface icon set. |
| `minisearch` | Deterministic local rank-and-pack retrieval. |
| `ogl` | Grainient hero renderer. |
| `react` | Interactive islands and Jet's Ghost experience. |
| `react-dom` | React browser rendering. |
| `remark-gfm` | Assistant-corpus Markdown normalization. |
| `remark-mdx` | Assistant-corpus MDX parsing. |
| `remark-parse` | Assistant-corpus Markdown parsing. |
| `stemmer` | Versioned MiniSearch stemming implementation. |
| `unified` | Assistant-corpus syntax-tree pipeline. |
| `unist-util-visit` | Heading-aware assistant-corpus traversal. |
| `@astrojs/check` | Astro and TypeScript verification. |
| `@astrojs/rss` | Static RSS generation. |
| `@astrojs/sitemap` | Target-aware static sitemap generation. |
| `@astrojs/tailwind` | Tailwind integration for the static build. |
| `@axe-core/playwright` | Browser accessibility gate. |
| `@playwright/test` | Browser, deployment, and opt-in real-model qualification suites. |
| `@tailwindcss/typography` | MDX prose typography recipe. |
| `@testing-library/jest-dom` | Component-test assertions. |
| `@testing-library/react` | React component and hook verification. |
| `@types/mdast` | Corpus syntax-tree type declarations. |
| `@webgpu/types` | LiteRT/WebGPU type declarations. |
| `cross-env` | Cross-platform test-build and qualification environment commands. |
| `esbuild` | Production-artifact isolation verification. |
| `jsdom` | Vitest DOM environment. |
| `tailwindcss` | Semantic/Utopia design-system build. |
| `tsx` | TypeScript verification and authoring scripts. |
| `typescript` | Type checking and build tooling. |
| `vitest` | Unit, component, integration, and repository tests. |

The unused direct `mdast-util-to-string` dependency and unused `@vitest/coverage-v8` development dependency are removed from both package manifests.

## Dependency advisory review

The exact lockfile initially reported 25 advisories, including one critical development-only XML-parser advisory. A compatible-range `npm audit fix` updated 84 packages, added or removed their changed transitives, and reduced the result to four advisories: one high and three low, with no critical or moderate findings. The resolved direct versions now include `astro@5.18.2` and `@vercel/blob@2.6.1`.

The remaining high advisory is the aggregate Astro advisory and requires the breaking Astro 7 line to clear. This release is a static Astro build: it has no Astro server runtime, server islands, user-submitted build input, or public Vite development server. The affected `define:vars` value and component attributes are repository/environment-controlled rather than visitor-controlled, and the Windows-only esbuild development-server advisory is not part of the deployed surface. The remaining advisories are therefore recorded residual build-tool risk, not a concrete remotely reachable release prohibition for this exact static artifact. An Astro 7 migration remains separate major-version maintenance rather than an unreviewed change inside the Jet's Ghost release.

## Draft-agnostic execution

No current `src/`, `scripts/`, `tests/`, package/configuration file, or qualification fixture names or depends on the active untracked MDX draft. The former filename-specific archive utility and route assertions are removed. Publication and assistant-corpus safety remain enforced by generic tracked-content, explicit-status, assistant-eligibility, isolated-untracked-build, route-enumeration, RSS, sitemap, and corpus tests.

## Fake-runtime production boundary

The fake runtime remains reachable only when all of the following are true: the dedicated test-build flag was compiled in, the hostname is local, and the explicit fake-runtime query was supplied. Ordinary builds exclude the test-only import path, and `verify:production-artifacts` scans emitted output for forbidden seam markers. The final canonical gate must pass that verifier before release.

## Final cleanup result

Pending. This section will be updated only after the residue commit passes the full canonical gate, the user-owned metadata inventories are rechecked, the temporary worktree and integrated local branches are removed, and `/Users/jet/jet-web` is the sole durable Jet Web folder and registered worktree.
