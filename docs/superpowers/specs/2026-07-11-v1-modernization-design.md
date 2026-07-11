# Jet Web v1 Modernization Design

**Status:** Review draft

**Date:** 2026-07-11

**Canonical target:** Existing Astro, MDX, and Vercel application

**Companion design:** [Jet's Ghost Local Assistant](./2026-07-11-jets-ghost-local-assistant-design.md)

## Executive decision

Modernize the existing `jet-web` application in place. The current Astro, MDX, Tailwind, React-island, and Vercel foundation fits the scale and purpose of the site. A separate Cloudflare and EmDash rebuild would add migration and platform risk without solving a demonstrated editorial requirement.

This is a targeted structural modernization, not a redesign. The public identity of the site—its information architecture, OKLCH palette, Utopia spacing, typography, Liquid Glass navigation, Grainient hero, writing, and editorial tone—remains intact.

`docs/project-spec-v2.md` and the related migration material become superseded historical records. A CMS or platform migration can be reconsidered only when a concrete editorial workflow requires it.

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
- The local checkout predates the merged Grainient performance commit, so work must start from the current remote baseline without discarding the existing untracked files.
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

## Immediate production containment

Containment is the first implementation milestone and is performed before feature refactoring.

1. Revoke the current OpenRouter key at OpenRouter so existing deployments lose access immediately.
2. Remove `OPENROUTER_API_KEY` from Vercel Development, Preview, and Production environments.
3. Delete the public `d70520113a820db7` manifest, chunk payload, and embedding payload that contain the Codex draft.
4. Remove the active `/api/chat` implementation and deploy a static build in which the endpoint returns 404.
5. Remove the generated chatbot artifact config from the runtime dependency graph.
6. Verify the old artifact URLs return 404 and `POST /api/chat` cannot invoke generation.
7. Delete the remaining obsolete objects under the Blob `chatbot/` prefix after recording their pathname inventory in the implementation evidence. Git history and archived design documents are the preservation mechanism.

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

## Core modernization workstreams

### 1. Canonical documentation

- This design and its companion become the active target specifications.
- Add a superseded banner and links to `docs/project-spec-v2.md` and `docs/v2-migration-log.md`.
- Mark the old RAG architecture, implementation plan, implementation log, and v1.5 enhancement spec as historical implementation records.
- Update `README.md` to describe `src/data`, actual commands, current deployment, content status, and measured—not asserted—quality claims.
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
- Respond to runtime reduced-motion preference changes.
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

1. Begin from the fetched `origin/main` baseline while preserving all user-owned untracked files.
2. Perform credential/artifact containment before deploying any unchanged build.
3. Introduce the explicit content contract and migrate tracked entries before replacing filters.
4. Make the build pure before adding the new knowledge package.
5. Establish automated verification before broad component or accessibility changes.
6. Complete the core modernization release independently of Jet's Ghost.
7. Implement and release Jet's Ghost through its separate plan.
8. Remove historical runtime dependencies only after no active code imports them.

## Release criteria

The core modernization is complete when:

- the OpenRouter key is revoked and absent from Vercel;
- the draft-bearing public artifacts return 404;
- `/api/chat` is absent in production;
- all public and assistant content follows the explicit status policy;
- production verification rejects untracked published entries;
- `npm run build` makes no remote writes and changes no tracked file;
- `npm run verify` passes on Node 22 in CI;
- the site deploys as static output with a true `/chatbot` 301 redirect;
- the DOI-backed SSRN action is the only research action;
- `origin/main` Grainient performance behavior is preserved and reduced motion is supported;
- representative routes pass browser smoke and automated accessibility checks;
- active documentation identifies modernized v1 as canonical and v2 as superseded;
- the visual and editorial character remains materially unchanged.

## Risks and mitigations

### Dirty working tree during baseline synchronization

The repository contains user-owned untracked drafts and specifications. Implementation must use non-destructive Git operations, inventory those files before changing branches or worktrees, and never stage them implicitly.

### Static adapter removal changes redirect behavior

Move the redirect to Vercel configuration and verify its HTTP status before removing the server adapter.

### Content-state migration accidentally unpublishes content

Add failing policy tests first, migrate every tracked entry explicitly, and compare the pre/post public route manifest before deployment.

### Accessibility work changes the site's character

Restrict visual changes to focus visibility, semantics, motion preferences, and verified contrast defects. Preserve layouts, colors, type, spacing, and animation character for users without reduced-motion preferences.

### Documentation sprawl continues

Every historical document receives a visible status and canonical successor link. New implementation decisions update these Superpowers specifications rather than creating another competing architecture document.

## References

- Existing project specification: `docs/project-spec.md`
- Superseded platform proposal: `docs/project-spec-v2.md`
- Historical RAG architecture: `docs/rag-chatbot-architecture.md`
- Jet's Ghost companion design: `docs/superpowers/specs/2026-07-11-jets-ghost-local-assistant-design.md`
- Timesheet local-assistant research rollout: `019f1533-9ec8-7b32-b80c-fe27b684a5f6`
