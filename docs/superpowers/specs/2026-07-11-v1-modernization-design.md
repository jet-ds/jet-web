# Jet Web v1 Modernization Design

**Status:** Approved for planning

**Date:** 2026-07-11

**Canonical target:** Existing Astro, MDX, and Vercel application

**Companion design:** [Jet's Ghost Local Assistant](./2026-07-11-jets-ghost-local-assistant-design.md)

**Implementation plan:** [Jet Web v1 Modernization](../plans/2026-07-11-v1-modernization.md)

## Executive decision

Modernize the existing `jet-web` application in place. The current Astro, MDX, Tailwind, React-island, and Vercel foundation fits the scale and purpose of the site. A separate Cloudflare and EmDash rebuild would add migration and platform risk without solving a demonstrated editorial requirement.

This is a targeted structural modernization, not a redesign. The public identity of the site—its information architecture, OKLCH palette, Utopia spacing, typography, Liquid Glass navigation, Grainient hero, writing, and editorial tone—remains intact.

`docs/project-spec-v2.md` and the related migration material become superseded historical records under `docs/archive/`. A CMS or platform migration can be reconsidered only when a concrete editorial workflow requires it.

## Scope decomposition

The modernization consists of two independently releasable systems:

1. **Core site modernization** — production containment, content policy, deterministic builds, static deployment, verification, accessibility, SEO, consistency, and repository hygiene.
2. **Jet's Ghost local assistant** — a local Gemma 4 E2B runtime, durable knowledge package, pluggable context selection, citations, and evaluation.

The core site can ship without Jet's Ghost. Jet's Ghost depends on the core content policy and deterministic corpus generation, but the rest of the site does not depend on the model runtime.

## Goals

1. Make the existing repository the single canonical architecture.
2. Stop the current production chatbot exposure and remove draft-bearing public artifacts.
3. Make publication and assistant inclusion explicit, deny-by-default decisions.
4. Make ordinary builds repeatable, side-effect-free, and free of remote writes.
5. Return the public site to a static-first Astro deployment with no generation API.
6. Establish meaningful automated checks for content, TypeScript, builds, routes, accessibility, SEO, and critical interactions.
7. Resolve known correctness and consistency defects without changing the visual character.
8. Preserve the deployed Grainient performance improvements and add reduced-motion behavior.
9. Make documentation describe the architecture that actually governs future work.
10. Provide the stable content and deployment boundary required by the Jet's Ghost companion design.
11. Establish explicit repository governance through Semantic Versioning 2.0.0, Conventional Commits 1.0.0, and one canonical agent-instruction file.

## Non-goals

- No visual redesign or new brand system.
- No Cloudflare, EmDash, R2, or other CMS migration.
- No Tailwind 4 migration.
- No broad component-library rewrite.
- No conversion of static Astro components into React.
- No general-purpose website support bot.
- No server-hosted fallback for Jet's Ghost.
- No restoration of the current OpenRouter generation proxy.
- No dependency upgrade campaign unrelated to an affected workstream.
- No claim of performance or accessibility perfection without current measurements.

## Current baseline

### Strengths to preserve

- Astro static generation and MDX content collections match the site's publishing model.
- React is mostly confined to interactive islands.
- The OKLCH semantic tokens and Utopia fluid spacing form a distinctive, coherent design system.
- `BaseLayout` centralizes canonical metadata and structured-data composition.
- Blog and works routes use typed content collections.
- The Liquid Glass dock, Grainient hero, and theme behavior are intentional product identity.
- Vercel Blob remains a reasonable explicit image-upload destination.
- `origin/main` already contains Grainient's 24fps cap plus hidden/offscreen pausing from commit `c423ffa`.

### Risks this design resolves

- `npm run build` currently generates embeddings, uploads three artifacts to Vercel Blob, and writes a build-specific runtime config.
- The content schema defaults `draft` to `false`, allowing an untracked active draft to enter a locally generated public assistant corpus.
- The currently referenced public corpus `d70520113a820db7` contains the active Codex article.
- `/api/chat` accepts visitor-supplied context and forwards it through a production OpenRouter credential with ineffective in-memory serverless rate limiting.
- Removing a Vercel environment variable alone does not remove it from an already-built production function.
- The repository has no checked-in unit-test, browser-test, lint, or CI system.
- Navigation definitions are duplicated between `src/config/site.ts`, `LiquidGlassDock.tsx`, `BaseLayout.astro`, and the no-script fallback.
- The research work contains a nonfunctional `Download PDF` action and uses an HTTP DOI URL.
- The earlier audit checkout predated the merged Grainient performance commit; the reviewed documentation head now descends from `origin/main` commit `c0d158c`, which contains `c423ffa`. Implementation must preserve that ancestry without disturbing existing untracked files.
- The README contains stale paths and unverified performance claims.
- The v1, v2, RAG, and migration documents describe competing target architectures.

## Chosen approach and rejected alternatives

### Chosen: modernize v1 and separate durable knowledge from retrieval

Keep Astro, MDX, semantic design tokens, React islands, and Vercel. Replace implicit content state with an explicit policy, make the build pure, remove the server generation boundary, and implement Jet's Ghost as an optional local feature behind stable corpus and runtime interfaces.

This approach has the smallest migration surface and creates a credible long-term architecture without assuming the corpus remains small.

### Rejected: proceed with the Cloudflare and EmDash v2 rebuild

This would replace a fitting content architecture with a young CMS and introduce a second repository, content migration, Portable Text rendering, R2, deployment migration, and new chatbot indexing triggers. Those costs are not supported by a present editorial need.

### Rejected: retain the current RAG runtime and only swap OpenRouter for Gemma

That would make visitors load both a query-embedding model and a multi-gigabyte generation model while preserving Blob publication, duplicated loading, IndexedDB state, a worker, BM25, cosine ranking, and reciprocal-rank fusion. It treats one retrieval implementation as permanent architecture and leaves the build/content boundary brittle.

## Target system model

```text
Tracked MDX content
  -> Astro Loader API and required schemas
  -> shared publication predicates
  -> pages, RSS, sitemap, structured data
  -> versioned Jet's Ghost knowledge package

Static Astro output
  -> Vercel CDN
  -> React islands only for interactive experiences
  -> no production generation API
```

The only routine remote-writing workflow is the explicit image upload command. Site and assistant builds write to local build output only.

## Content policy

### Required schema

Both blog and works entries use an explicit publication state:

```ts
type PublicationStatus = 'draft' | 'published';

interface PublicationFields {
  status: PublicationStatus;
  assistant: boolean;
}
```

Rules:

- `status` is required and has no default.
- `assistant` defaults to `false`.
- The legacy `draft` field is removed after all tracked content is migrated.
- A public page is generated only when `status === 'published'`.
- An assistant source is included only when `status === 'published' && assistant === true`.
- Works and blog entries follow the same policy.
- Draft entries remain available to local authoring tools but do not produce public routes, RSS items, sitemap entries, homepage cards, or assistant sources.
- Every published entry must be tracked by Git when running the production verification command. This prevents `vercel --prod` or another local deployment path from silently publishing an untracked file.

### Shared predicates

Every consumer imports the same pure functions:

```ts
isPublished(entry): boolean
isAssistantEligible(entry): boolean
```

No page, feed, script, or assistant module reimplements `data.draft !== true` or an equivalent condition.

### Production verification

`npm run verify:content` fails when:

- an entry lacks `status`;
- an unsupported status is present;
- an assistant-enabled entry is not published;
- a published entry is not tracked by Git;
- a published link uses an invalid URL;
- a canonical source ID or URL is duplicated;
- a generated assistant source does not satisfy the shared eligibility predicate.

The validator receives each record's repository-relative source path, canonical ID, canonical URL, raw publication fields, parsed link URLs, and Git-tracked state. Schema parsing and policy validation are separate gates: malformed or missing publication fields must be reported with the source path rather than disappearing during collection loading. The Jet's Ghost package generator uses the same Git-tracking adapter and independently fails if an included source is absent from the verified tracked-path set.

## Immediate production containment

Containment is the first implementation milestone and is performed before feature refactoring.

1. Revoke the current OpenRouter key at OpenRouter so existing deployments lose access immediately.
2. Remove `OPENROUTER_API_KEY` from Vercel Development, Preview, and Production environments.
3. Delete the public `d70520113a820db7` manifest, chunk payload, and embedding payload that contain the Codex draft.
4. Remove the active `/api/chat` implementation and deploy a static build in which the endpoint returns 404.
5. Remove the generated chatbot artifact config from the runtime dependency graph.
6. Verify the old artifact URLs return 404 and `POST /api/chat` cannot invoke generation.
7. Delete the remaining obsolete objects under the Blob `chatbot/` prefix after recording their pathname inventory in the implementation evidence. Git history and archived design documents are the preservation mechanism.

Containment readback is an assertion, not a visual inspection. Evidence records the complete pre-delete Blob pathname inventory, proves the prefix is empty afterward, probes every recorded URL, requires exactly `404` for `POST /api/chat`, requires exactly `308` and `Location: /tools/chatbot` for the legacy redirect, proves the credential name is absent from every Vercel scope, and identifies the production deployment ID plus Git commit that produced the response.

Containment must not redeploy the existing remote-writing build unchanged, because that build can publish a new artifact generation as a side effect.

Previously cached public data cannot be recalled from a visitor's browser. Containment prevents further retrieval and removes the live production path; it cannot erase copies already downloaded.

## Build and deployment architecture

### Runtime mode

After `/api/chat` is removed, the site returns to static Astro output. The legacy `/chatbot` route becomes a true platform redirect to `/tools/chatbot` through `vercel.json`, allowing `src/pages/chatbot.astro`, its server-rendering exception, and the Vercel server adapter to be removed if no other dynamic route remains.

### Deterministic scripts

The command contract becomes:

```text
npm run dev             local Astro development
npm run check           Astro and TypeScript validation
npm run test            unit and component tests
npm run test:e2e        browser smoke and accessibility tests
npm run verify:content  publication and assistant-policy validation
npm run build           pure production build with no network writes
npm run verify          check + tests + content verification + build
npm run upload-image    explicit Vercel Blob image mutation
```

Downloading external model or font assets during a browser session is runtime behavior, not a build mutation.

### Version and CI policy

- Pin the supported runtime to Node.js `22.x` in `package.json` and a repository version file.
- Keep `package-lock.json` authoritative and use `npm ci` in CI.
- Add a GitHub Actions workflow that runs `npm ci` and `npm run verify` on pull requests and pushes to `main`.
- The production deployment consumes only a commit that passed the same verification command.
- A build failure must not leave uploaded artifacts or modify tracked source files.
- Build-purity verification snapshots tracked-file hashes and `git status --porcelain=v1 -uall` before and after the build, excluding only declared build outputs. It covers staged, unstaged, and untracked source/configuration changes.

## Repository governance and public documentation

### Canonical agent instructions

`AGENTS.md` becomes the regular, canonical instruction file. `CLAUDE.md` becomes a relative symbolic link to `AGENTS.md` for compatibility with tools that look for the older filename.

The current direction is inverted:

```text
AGENTS.md    regular canonical file
CLAUDE.md -> AGENTS.md
```

No instruction is maintained independently in both files.

### Semantic Versioning 2.0.0

- Record `1.0.0` in `package.json` and `package-lock.json` as the product baseline before modernization changes begin.
- Treat `package.json` as the authoritative application version.
- Apply [Semantic Versioning 2.0.0](https://semver.org/spec/v2.0.0.html) to tagged application releases.
- Increment `MAJOR` for an intentionally incompatible public route, content contract, knowledge-package schema, or supported integration contract.
- Increment `MINOR` for a backward-compatible public feature, route, tool, content type, or assistant capability.
- Increment `PATCH` for backward-compatible fixes, accessibility improvements, performance work, internal refactors, and operational corrections included in a release.
- Content-only and documentation-only deployments do not require a version change unless they accompany a versioned application release.
- Use `v<major>.<minor>.<patch>` for Git release tags.

This modernization intentionally removes the hosted `/api/chat` contract and replaces the legacy `draft` authoring contract with required `status`. It therefore releases as `2.0.0`, not a patch to `1.0.0`. Jet's Ghost is then a backward-compatible public feature on that core and targets `2.1.0`.

### Conventional Commits 1.0.0

- All non-merge commits follow [Conventional Commits 1.0.0](https://www.conventionalcommits.org/en/v1.0.0/).
- Use the form `type(optional-scope)!: description`.
- Supported common types are `feat`, `fix`, `docs`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, and `revert`.
- Use `!` and a `BREAKING CHANGE:` footer for incompatible changes.
- Keep commit bodies focused on intent, relevant constraints, and verification.
- Do not require Claude, Codex, agent, co-author, or generated-by attribution in commit messages.

### README

Rewrite `README.md` as concise professional project documentation after the implementation commands and architecture are true. Remove decorative emoji, launch-era marketing language, unsupported Lighthouse and bundle claims, stale `src/content` paths, and generic tutorial material.

The README contains only:

- project purpose and production URL;
- architecture summary;
- Node 22 setup;
- authoritative commands;
- content authoring and explicit publication/assistant policy;
- image workflow;
- Jet's Ghost local-first status and model disclosure;
- verification and deployment expectations;
- links to the canonical Superpowers designs and maintained operational docs.

## Core modernization workstreams

### 1. Canonical documentation

- This design and its companion become the active target specifications.
- Create `docs/archive/README.md` as the index of superseded specifications, completed implementation logs, and retired research.
- Move the v1/v2 project specifications and migration logs into `docs/archive/site/`, and move retired RAG architecture/plans/logs/reviews/research into `docs/archive/jets-ghost/legacy-rag/`.
- The user has explicitly approved adoption and archival of superseded untracked documents such as `docs/jets-ghost-v1.5-spec.md`, `docs/rag-chatbot-implementation-review.md`, and `EMBEDDING_STORAGE_RESEARCH.md`. Preserve each substantive body, record its source SHA-256, add status/successor context in the archive, and remove the obsolete untracked source copy only after the archived copy is committed and its body hash is verified.
- Move completed Liquid Glass and launch implementation logs into `docs/archive/site/implementation-logs/` while retaining links from the archive index.
- Do not archive unrelated untracked specifications merely because they are untracked. The EmDash Newsroom exercise and Page Analyzer/Schema Visualizer proposals remain separate active drafts unless a later decision supersedes them.
- Replace `README.md` with the professional structure defined in the repository-governance section.
- Update repository instructions after implementation so future agents use the new content and verification contracts.

### 2. Navigation and shared configuration

`NAV_ITEMS` in `src/config/site.ts` becomes authoritative for:

- Liquid Glass dock links and labels;
- structured navigation data;
- the no-script navigation fallback;
- active-route calculation.

Presentation-only properties such as gradients can live on the same typed item or in a keyed visual map, but route identity is not duplicated.

### 3. Research link correctness

The Recursive Convergence Hypothesis exposes one action:

```text
View on SSRN -> https://doi.org/10.2139/ssrn.5395309
```

The `Download PDF` action is removed. Citation text also uses the HTTPS DOI URL. No SSRN delivery endpoint is stored.

### 4. Grainient performance and reduced motion

- Start from `origin/main`, which includes `c423ffa`.
- Preserve the 24fps cap, offscreen pause, hidden-document pause, WebGL fallback, theme behavior, and visual parameters.
- When `prefers-reduced-motion: reduce` is active, render a static first frame or the existing non-WebGL fallback and do not maintain an animation loop.
- Treat reduced motion as renderer lifecycle state. If reduction is active initially, do not create the WebGL renderer; switching reduction off initializes one when visible, while switching it on cancels RAF, releases the renderer, and restores the static fallback.
- Respond to runtime reduced-motion preference changes in both directions.
- Verify no animation resumes while offscreen or hidden.

### 5. Navigation accessibility

- Dock links expose `aria-current="page"` for the active destination.
- Every interactive element has a visible keyboard focus treatment using semantic tokens.
- Tooltip-only information is also available through accessible names.
- Mobile open/close state exposes `aria-expanded` and a controlled-region relationship.
- Motion respects reduced-motion preferences without removing navigation functionality.
- The no-script navigation is generated from the same route data.

### 6. SEO and web correctness

- Preserve the single WebPage structured-data owner in `BaseLayout` and content-specific entities in page layouts.
- Replace `any` in structured-data construction with a discriminated typed schema builder.
- Generate navigation structured data from `NAV_ITEMS`.
- Omit `twitter:creator` unless a real Twitter/X handle is configured; never derive it from a display name.
- Keep canonical URLs HTTPS-only.
- Verify sitemap, RSS, robots, canonical tags, Open Graph, Twitter cards, and JSON-LD against representative routes.
- Keep `/tools/chatbot` noindexed while it is an unavailable placeholder; index it only after the local assistant release gate passes.

### 7. Dependency and dead-code cleanup

After the old chatbot runtime is disconnected, remove dependencies used only by that implementation, subject to an import audit:

- `@huggingface/transformers`
- `@petamoriken/float16`
- `idb`
- `minisearch`
- the old retrieval worker and RRF modules
- the server generation service and API route

Retain `@vercel/blob` and `dotenv` only for the explicit image workflow. Retain `framer-motion` and `ogl` for the dock and Grainient. The Jet's Ghost design introduces `@litert-lm/core` independently.

### 8. Verification system

Use Vitest for pure TypeScript and React behavior, Playwright for browser flows, and `@axe-core/playwright` for automated accessibility signals.

Minimum unit coverage protects:

- content eligibility predicates;
- content-policy failures;
- date sorting and formatting;
- SEO title, canonical, and schema builders;
- navigation active-state behavior;
- Grainient loop-state decisions as pure logic;
- Jet's Ghost domain contracts defined in the companion design.

Minimum browser coverage protects:

- home, about, blog index/detail, works index/detail, tools, contact, and RSS routes;
- theme persistence;
- dock keyboard navigation and mobile disclosure;
- `/chatbot` permanent redirect;
- absence of published draft routes;
- SSRN DOI action;
- representative metadata and JSON-LD;
- reduced-motion Grainient behavior;
- Jet's Ghost placeholder or released activation flow, depending on milestone.

Browser regression tests run against the built static output through `astro preview`, not the development server. The checked-in suite includes each listed route and assertion, parses JSON-LD as JSON, verifies active navigation and mobile disclosure behavior, and installs its browser plus system dependencies in CI. Vercel-only redirect behavior is a separate deployment assertion with an exact status and destination.

Real-model Jet's Ghost evaluation is kept out of the routine CI path because it requires WebGPU and a roughly 2 GB model download. The companion design defines its separate release gate.

## Error and operational behavior

- A content-policy error fails the build with the entry path and violated rule.
- A missing image remains a build or validation failure according to the existing image workflow; it is not silently replaced.
- Failure to load analytics does not affect navigation or content.
- WebGL failure retains the existing visual fallback.
- Jet's Ghost failure never affects static routes or the rest of the Tools hub.
- No visitor prompt, response, or selected context is sent to analytics or a server.
- Production failures are diagnosable through CI output, Vercel deployment state, browser console checks, and deterministic reproduction from the deployed commit.

## Sequencing constraints

The later implementation plan must respect these dependencies:

1. Inventory the original dirty checkout, record the approved starting commit, and create a clean isolated worktree and branch from that exact commit. Never edit, stage, or build the user-owned untracked Codex draft or other untracked files in the original checkout.
2. Before any deployment or visual change, capture an immutable production baseline for representative routes, viewports, metadata, and the deployed commit/deployment identity.
3. Establish canonical `AGENTS.md`, record version `1.0.0`, Conventional Commits, and the no-attribution rule before subsequent commits.
4. Perform credential/artifact containment before deploying any unchanged build.
5. Introduce the explicit content contract and migrate tracked entries before replacing filters.
6. Make the build pure before adding the new knowledge package.
7. Establish automated verification before broad component or accessibility changes.
8. Complete and release the breaking core modernization as `2.0.0` independently of Jet's Ghost.
9. Implement and release Jet's Ghost through its separate plan as `2.1.0`.
10. Remove historical runtime dependencies only after no active code imports them.
11. Rewrite the README after its documented commands and architecture are implemented.

## Release criteria

The core modernization is complete when:

- the OpenRouter key is revoked and absent from Vercel;
- the draft-bearing public artifacts return 404;
- `/api/chat` is absent in production;
- all public and assistant content follows the explicit status policy;
- production verification rejects untracked published entries;
- `npm run build` makes no remote writes and changes no tracked or nonignored untracked source/configuration file;
- `npm run verify` passes on Node 22 in CI;
- the site deploys as static output with an exact `/chatbot` 308 redirect to `/tools/chatbot`;
- the DOI-backed SSRN action is the only research action;
- `origin/main` Grainient performance behavior is preserved and reduced motion is supported;
- representative routes pass browser smoke and automated accessibility checks;
- active documentation identifies modernized v1 as canonical and v2 as superseded;
- `AGENTS.md` is canonical, `CLAUDE.md` points to it, the recorded pre-modernization baseline is `1.0.0`, the released application is `2.0.0`, and commit instructions require Conventional Commits without agent attribution;
- the README is concise, professional, and accurate to the implemented system;
- the visual and editorial character remains materially unchanged.

## Risks and mitigations

### Dirty working tree during baseline synchronization

The repository contains user-owned untracked drafts and specifications. Implementation must inventory them, create a clean worktree from the approved commit, leave the original checkout untouched, and stage only explicit paths. The only exception is the user-authorized, hash-verified archival copy and post-integration cleanup of four named historical documents; it never includes active content or active tool specifications. If the clean checkout cannot reproduce a build because a private untracked draft was previously affecting it, record that baseline defect instead of rewriting the draft.

### Static adapter removal changes redirect behavior

Move the redirect to Vercel configuration and require its documented `308` status plus exact `Location` before removing the server adapter.

### Content-state migration accidentally unpublishes content

Add failing policy tests first, migrate every tracked entry explicitly, and compare the pre/post public route manifest before deployment.

### Accessibility work changes the site's character

Restrict visual changes to focus visibility, semantics, motion preferences, and verified contrast defects. Preserve layouts, colors, type, spacing, and animation character for users without reduced-motion preferences.

Capture the comparison screenshots and representative metadata from the pre-implementation production deployment before containment or intermediate deployments can change that surface. All release comparisons use this fixed evidence rather than whichever deployment is current at the end.

### Documentation sprawl continues

Every historical document receives a visible status and canonical successor link. New implementation decisions update these Superpowers specifications rather than creating another competing architecture document.

## References

- Archived original project specification: `docs/archive/site/project-spec-v1.md`
- Archived superseded platform proposal: `docs/archive/site/project-spec-v2.md`
- Archived historical RAG architecture: `docs/archive/jets-ghost/legacy-rag/rag-chatbot-architecture.md`
- Jet's Ghost companion design: `docs/superpowers/specs/2026-07-11-jets-ghost-local-assistant-design.md`
- Timesheet local-assistant research rollout: `019f1533-9ec8-7b32-b80c-fe27b684a5f6`
- [Semantic Versioning 2.0.0](https://semver.org/spec/v2.0.0.html)
- [Conventional Commits 1.0.0](https://www.conventionalcommits.org/en/v1.0.0/)
