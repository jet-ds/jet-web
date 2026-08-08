# Jet Web v1 Modernization Design

**Status:** Approved for implementation

**Date:** 2026-07-11

**Last revised:** 2026-07-13

**Canonical target:** Existing Astro, MDX, and Vercel application

**Companion design:** [Jet's Ghost Local Assistant](./2026-07-11-jets-ghost-local-assistant-design.md)

**Implementation plan:** [Jet Web v1 Modernization](../plans/2026-07-11-v1-modernization.md)

**Approved Jet's Ghost interface:** [`docs/jets-ghost-chat-experience.md`](../../jets-ghost-chat-experience.md), implemented as the 2.1.0 prototype in commit `d406ed46dfc7cccfa95d0003fcae30f5b9373690`

## Executive decision

Modernize the existing `jet-web` application in place. The current Astro, MDX, Tailwind, React-island, and Vercel foundation fits the scale and purpose of the site. A separate Cloudflare and EmDash rebuild would add migration and platform risk without solving a demonstrated editorial requirement.

This is a targeted structural modernization, not a redesign. The public identity of the site—its information architecture, OKLCH palette, Utopia spacing, typography, Liquid Glass navigation, Grainient hero, writing, and editorial tone—remains intact.

`docs/project-spec-v2.md` and the related migration material become superseded historical records under `docs/archive/`. A CMS or platform migration can be reconsidered only when a concrete editorial workflow requires it.

## Scope decomposition

The modernization consists of two independently releasable systems:

1. **Core site modernization** — production containment, content policy, deterministic builds, static deployment, verification, accessibility, SEO, consistency, and repository hygiene.
2. **Jet's Ghost local assistant** — a local Gemma 4 E2B runtime, durable versioned knowledge package, deterministic MiniSearch rank-and-pack, citations, and product qualification.

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

### Chosen: modernize v1 and give Jet's Ghost one durable retrieval path

Keep Astro, MDX, semantic design tokens, React islands, and Vercel. Replace implicit content state with an explicit policy, make the build pure, remove the server generation boundary, and implement Jet's Ghost as an optional local feature behind a stable corpus, deterministic MiniSearch rank-and-pack, citation, and runtime pipeline.

This approach has the smallest migration surface and creates a credible long-term architecture without assuming the corpus remains small.

### Milestone handoff for the approved Jet's Ghost interface

Core modernization `2.0.0` and Jet's Ghost `2.1.0` deliberately own different route states:

- During `2.0.0` containment, the approved interface prototype from commit `d406ed46dfc7cccfa95d0003fcae30f5b9373690` remains noindexed at `/tools/chatbot/`. Vercel normalizes `/chatbot` to `/chatbot/`, then one explicit rule redirects `/chatbot/` to `/tools/chatbot/`. The prototype is preserved as inert product-design code: it has no production corpus, model, engine, or hosted generation path. The core trailing-slash correction does not reverse or index it early.
- During `2.1.0` integration, `/chatbot/` becomes the `200` semantic production route with emitted canonical URL `https://jetsanchez.com/chatbot/`; platform normalization owns `/chatbot` to `/chatbot/` and `/tools/chatbot` to `/tools/chatbot/`, while one explicit legacy rule redirects `/tools/chatbot/` to `/chatbot/`. Ghost replaces Tools in the existing dock slot; and `/tools/` becomes dormant, noindexed, absent from the sitemap, and absent from primary navigation.

The companion design and plan own that coordinated reversal. Canonical URLs, sitemap policy, structured data, dock and no-script navigation, deployment assertions, and containment/regression tests change together; the interface is integrated rather than redesigned.

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

Containment is the first implementation milestone and is performed before feature refactoring. Revoking the active OpenRouter key is the first external mutation after the existing Vercel project and non-secret OpenRouter key record are identified; it occurs before worktree setup, dependency installation, baseline capture, or repository edits. The non-secret revocation readback is held in private mode-restricted operator state, then sanitized and committed only after the evidence tooling exists.

1. Revoke the current OpenRouter key at OpenRouter so existing deployments lose access immediately.
2. Remove `OPENROUTER_API_KEY` from Vercel Development, Preview, and Production environments.
3. Delete the public `d70520113a820db7` manifest, chunk payload, and embedding payload that contain the Codex draft.
4. Remove the active `/api/chat` implementation and deploy a static build in which the endpoint returns 404.
5. Remove the generated chatbot artifact config from the runtime dependency graph.
6. Verify the old artifact URLs return 404 and `POST /api/chat` cannot invoke generation.
7. Delete the remaining obsolete objects under the Blob `chatbot/` prefix after recording their pathname inventory in the implementation evidence. Git history and archived design documents are the preservation mechanism.

Initial containment readback is an assertion, not a visual inspection. Evidence records the complete pre-delete Blob pathname inventory, proves the prefix is empty afterward, probes every recorded URL, requires exactly `404` for `POST /api/chat`, requires exactly `308` and `Location: /tools/chatbot` for the Task 3 containment redirect as deployed, proves the credential name is absent from every Vercel scope, and identifies the production deployment ID plus Git commit that produced the response. The later Task 10 canonical work preserves that historical evidence while moving the explicit rule to slashful source `/chatbot/` and destination `/tools/chatbot/` before the final `2.0.0` release gate.

Raw Vercel CLI/API responses are transient secrets-adjacent inputs, never repository evidence. Each is written only to a mode-`0600` temporary file created under a mode-`0700` temporary directory, transformed into a schema-allowlisted projection, scanned recursively for forbidden keys and secret-like values, and deleted before any `git add`. Committed environment evidence contains names, types, scopes, targets, and optional Git branches only; it never contains values, encrypted values, headers, cookies, build environment objects, or provider response residue.

Containment must not redeploy the existing remote-writing build unchanged, because that build can publish a new artifact generation as a side effect.

Previously cached public data cannot be recalled from a visitor's browser. Containment prevents further retrieval and removes the live production path; it cannot erase copies already downloaded.

## Build and deployment architecture

### Runtime mode

After `/api/chat` is removed, the site returns to static Astro output. No `/api/chat` handler or build artifact exists in the final core `2.0.0` release. Because the global Vercel trailing-slash policy still normalizes the absent slashless path, `POST /api/chat` returns exact `308` to `https://jetsanchez.com/api/chat/`; a second manual `POST /api/chat/` terminates at exact `404` with no `Location`. Task 3 first deploys `/chatbot` as a true platform redirect to the approved noindexed prototype at `/tools/chatbot` through `vercel.json`, allowing the old `src/pages/chatbot.astro`, its server-rendering exception, and the Vercel server adapter to be removed if no other dynamic route remains. That pre-trailingSlash state remains historical evidence. Task 10 retains the interim direction with one explicit `/chatbot/` to `/tools/chatbot/` rule; Vercel owns the preceding `/chatbot` to `/chatbot/` normalization, and `/tools/chatbot/` terminates at `200` with no redirect. The companion `2.1.0` plan later moves the prototype to static `/chatbot/` and reverses the explicit legacy rule without reintroducing a server adapter.

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

- Pin the supported runtime to Node.js `24.x` in `package.json` and a repository version file.
- Keep `package-lock.json` authoritative and use `npm ci` in CI.
- Run the GitHub Actions workflow on pull requests, pushes to `main`, manual dispatch, and a daily `17 18 * * *` schedule (`02:17` Asia/Manila). The two stable jobs are `verify` and `browser`; scheduled runs use the latest default-branch commit and cannot be cancelled by ordinary push activity.
- Require both `verify` and `browser` on `main`, bound to GitHub Actions with strict up-to-date checks and administrator enforcement. Force pushes and branch deletion remain disabled; this single-maintainer repository does not require an artificial human approval count.
- The production deployment consumes only an exact commit that passed both routine jobs. The roughly 2 GB real-model qualification remains a separate release-only gate and never enters routine or nightly CI.
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
- Node 24 setup;
- authoritative commands;
- content authoring and explicit publication/assistant policy;
- image workflow;
- Jet's Ghost local-first status and model disclosure;
- verification and deployment expectations;
- links to the canonical Superpowers designs and maintained operational docs.

The implemented image workflow is part of canonical `AGENTS.md`, not a separate active guide. It covers the existing `blog`, `works`, and `about` staging lanes; every format accepted by the upload script; `16:9` featured-content guidance; the About page's `3:4` portrait guidance; the explicit Vercel Blob upload mutation; environment requirements; current `src/data/` frontmatter; alt text; verification; replacement/removal; and cleanup. After that material is integrated, move both `docs/image-workflow.md` and the duplicative publicly deployable `public/images-staging/README.md` into `docs/archive/site/workflows/`. Keep the empty `about/`, `blog/`, and `works/` staging directories through `.gitkeep` files so a fresh checkout retains the operational shape without creating another documentation authority. README links its Images section to `AGENTS.md`.

### Default OpenGraph image

Resolve the launch-era `TODO.md` rather than carrying it forward as an active backlog file. The default social image is a checked-in `1920x1080` JPEG captured from the homepage hero in its normal light theme. The capture uses a `1920x1080` viewport at device scale `1`, clears theme state, freezes Grainient animation timestamps at `iTime = 0`, requires the intended Brawler and Work Sans font faces to load, and waits for a capture-only WebGL draw signal rather than canvas insertion alone. It then captures the first viewport with the visible navigation dock. This produces the intended first-frame hero composition without depending on screenshot or remote-font fallback timing.

The asset lives at `public/images/og-default.jpg`. Default SEO props expose its absolute production URL, accurate dimensions, and descriptive alt text. Custom content images emit dimensions only when their real dimensions are known; the default image's dimensions are not asserted for unrelated assets. A checked-in capture script makes regeneration explicit, while automated tests verify the committed JPEG type, dimensions, size ceiling, default metadata, and built-page OpenGraph/Twitter tags. After those gates pass, move `TODO.md` into the historical archive as completed work.

## Core modernization workstreams

### 1. Canonical documentation

- This design and its companion become the active target specifications.
- Create `docs/archive/README.md` as the index of superseded specifications, completed TODOs, deferred concepts, superseded workflows, implementation logs, and retired research.
- Move the v1/v2 project specifications and migration logs into `docs/archive/site/`, and move retired RAG architecture/plans/logs/reviews/research into `docs/archive/jets-ghost/legacy-rag/`.
- The user has explicitly approved adoption and archival of all seven non-canonical untracked documentation artifacts: the four previously identified historical records (`EMBEDDING_STORAGE_RESEARCH.md`, `docs/jets-ghost-v1.5-spec.md`, `docs/rag-chatbot-implementation-review.md`, and `docs/liquid-glass-dock-v2-log.md`) plus three deferred design concepts under `Untracked/docs/`. Preserve each substantive body, record its source SHA-256, and add a generated status/successor banner plus archive-index context.
- The user intentionally removed the former local Lighthouse report and relocated the unpublished Codex article after Task 0. Preserve the immutable nine-entry Task 0 inventory as historical evidence and record a separate approved eight-entry Task 11 inventory snapshot for archive preconditions. Remove the seven obsolete source copies only after the archive is reachable from the released commit. Cleanup revalidates every source and tagged archived-body hash, operates on this exact allowlist, and proves the approved Task 11 inventory changed only by removal of those seven paths. The active unpublished Codex article remains at `Untracked/how-to-install-and-get-started-with-codex-cli-2026.mdx`; it is governed by the explicit content policy and is never included in production or the assistant corpus implicitly.
- Move completed Liquid Glass and launch implementation logs into `docs/archive/site/implementation-logs/` while retaining links from the archive index.
- Archive the deferred EmDash Newsroom, Page Analyzer, and Schema Visualizer concepts under the neutral `docs/archive/deferred-concepts/` taxonomy. The archive index records EmDash as a separate public-theme concept and Page Analyzer/Schema Visualizer as deferred site-Tools concepts, with accurate status and successor context for each. They remain available as historical inputs but are not canonical product commitments or active implementation authorities.
- After the default OpenGraph asset is implemented and verified, move the completed root `TODO.md` into `docs/archive/site/todos/` with its resolution and successor links.
- After the complete, corrected image workflow is present in `AGENTS.md`, move the two superseded image guides into `docs/archive/site/workflows/` with `AGENTS.md` as their canonical successor.
- Replace `README.md` with the professional structure defined in the repository-governance section.
- Update repository instructions after implementation so future agents use the new content and verification contracts.

### 2. Navigation and shared configuration

`NAV_ITEMS` in `src/config/site.ts` becomes authoritative for:

- Liquid Glass dock links and labels;
- structured navigation data;
- the no-script navigation fallback;
- active-route calculation.

Canonical human-facing hrefs in `NAV_ITEMS` end in `/`, except the root `/`. Active-route calculation normalizes that form without letting home match globally and continues to match nested routes such as `/blog/example/` to `/blog/`. Presentation-only properties such as gradients can live on the same typed item or in a keyed visual map, but route identity is not duplicated.

### 3. Research link correctness

The Recursive Convergence Hypothesis exposes one action:

```text
View on SSRN -> https://doi.org/10.2139/ssrn.5395309
```

The `Download PDF` action is removed. Citation text also uses the HTTPS DOI URL. No SSRN delivery endpoint is stored.

### 4. Grainient performance and reduced motion

- Before touching `Grainient.tsx`, prove commit `c423ffa` from PR #15 is an ancestor of the approved implementation baseline. The currently approved `d406ed46` baseline passes this check through merge commit `c0d158c`.
- Preserve the inherited PR #15 implementation rather than recreating it. If a future approved baseline fails the ancestry check, stop and reconcile PR #15 as a distinct reviewed change before reduced-motion work begins.
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
- When the mobile dock is closed, the controlled region is inert, hidden from the accessibility tree, and excluded from sequential focus. Opening removes those constraints; closing restores focus to the disclosure control.

#### Shared color and action contracts

- Preserve the existing numbered OKLCH brand, accent, and neutral scales. Semantic roles map to those steps rather than introducing one-off in-between colors: solid slate-blue interaction fill is `brand-base`; readable branded links and foreground text use `brand-text`; dark code blocks use the palette-derived `code-block-text` role.
- Broad blue section surfaces use the palette-mapped `section-brand` role in light and dark themes. This role remains distinct from `brand-subtle`, which is reserved for `soft` action fills; mustard remains available for deliberate accent actions without becoming a broad section background.
- One framework-neutral `.text-link` recipe serves primary `Link.astro` destinations, Blog/Works prose, and deliberate direct inline links. It owns the branded medium-weight foreground, resting and interactive decoration, focus-visible outline, and reduced-motion behavior. Cards, navigation/footer, actions, the Liquid Glass dock, citation markers, and source-disclosure controls retain their own interaction semantics.
- One framework-neutral `.action` taxonomy serves Astro, React, and plain HTML. Its variants are `brand`, `accent`, `soft`, `neutral`, `outline`, `ghost`, `filter`, `stop`, and `disabled`. Filter toggles use `aria-pressed` with the `filter` recipe; status dots and Stop controls use explicit status/control roles instead of background utilities named for text.
- Densities are `compact` and `default` at a 44×44px minimum target with an 8px radius, plus `immersive` at a 48×48px minimum target with a 12px radius. The existing Jet's Ghost primary controls define the immersive geometry and are not flattened to the smaller site recipe.
- Visible action labels use sentence case while proper names, platform names, and acronyms retain their established capitalization.
- The shared recipe owns focus-visible, hover, disabled, reduced-motion, and forced-colors behavior. React consumers use the same classes and may add only layout or typography modifiers.
- Browser accessibility coverage discovers every sitemap HTML route and adds `/chatbot/` and `/tools/`, then runs full axe including `color-contrast` in explicit light and dark themes. Existing canonical, sitemap-membership, and index-state assertions remain separate and unchanged.

### 6. SEO and web correctness

- Preserve the single WebPage structured-data owner in `BaseLayout` and content-specific entities in page layouts.
- Replace `any` in structured-data construction with a discriminated typed schema builder.
- Generate navigation structured data from `NAV_ITEMS`.
- Omit `twitter:creator` unless a real Twitter/X handle is configured; never derive it from a display name.
- Keep canonical URLs HTTPS-only and use trailing slashes for every human-facing HTML route. `/` remains stable. Extension-bearing machine endpoints such as `/rss.xml`, `/robots.txt`, sitemap XML, corpus JSON, and LiteRT `.js`/`.wasm` assets are never rewritten into HTML-style URLs. The removed `/api/chat` path has no handler or artifact, but the global Vercel policy still normalizes its slashless form once (`308` to `/api/chat/`) before the slash form terminates at `404` with no further redirect.
- Configure Astro with `trailingSlash: 'always'`, configure Vercel with `"trailingSlash": true`, and make `getCanonicalURL()` emit exactly one trailing slash for human-facing HTML routes. These settings have distinct build-output and platform-normalization roles and must agree.
- Require canonical tags, `og:url`, WebPage/content entity IDs and URLs, sitemap HTML entries, structured navigation, no-script navigation, and ordinary primary navigation to use the same trailing-slash identity.
- Require `/about` to return one permanent `308` directly to `/about/`. Require `/about/` to return `200`, expose `index, follow`, emit exact canonical and `og:url` `https://jetsanchez.com/about/`, link JSON-LD to that URL, and appear exactly once in the sitemap.
- Keep `/blog/the-future-of-ai/` and `/blog/building-with-astro/` retired. Their canonical paths return `404`; generic slashless normalization may precede the first path's final `404`, but neither route redirects to home or another content page. Both remain absent from repository internal-link targets, sitemap, and RSS.
- Verify sitemap, RSS, robots, canonical tags, Open Graph, Twitter cards, JSON-LD, redirect targets, and the retired-route exclusions against representative routes.
- Verify the default OpenGraph image is a checked-in `1920x1080` JPEG below the documented size ceiling, and that pages without a custom image emit its exact URL, dimensions, and alt text.
- Keep the approved prototype at `/tools/chatbot/` noindexed and out of the sitemap during core `2.0.0`. In `2.1.0`, keep `/tools/` dormant and excluded, move Jet's Ghost to semantic route `/chatbot` with canonical URL `https://jetsanchez.com/chatbot/`, and remove the exact chatbot exclusion only after the local-assistant release gate passes.

The live Google Search Console Page indexing report for `sc-domain:jetsanchez.com`, last updated `2026-06-30`, recorded 16 not-indexed URLs: six expected slashless alternate canonicals, three expected HTTP/www redirects, two intentionally retired blog routes, and five crawled/currently-not-indexed URLs (`/about/`, `/about`, `/chatbot`, `/chatbot/`, and `/rss.xml`). The extra `http://www` hop is not an indexing blocker and is not a modernization prerequisite. After the relevant exact Production verification passes, use live URL Inspection and request indexing once for canonical `/about/`; after the separate Jet's Ghost `2.1.0` Production readback and real-model smoke pass, do the same once for canonical `/chatbot/`. Never request indexing for the noindexed prototype, a Preview deployment, RSS, redirected or slashless alternates, or retired routes. Do not validate intentional `404`s, expected alternate-canonical exclusions, or expected HTTP/www redirect exclusions. Search Console validation and monitoring begin only after recrawl and report refresh; each release is judged first by exact production responses and metadata, not a stale report.

### 7. Dependency and dead-code cleanup

After the old chatbot runtime is disconnected, remove dependencies used only by that implementation, subject to an import audit:

- `@huggingface/transformers`
- `@petamoriken/float16`
- `idb`
- the legacy `minisearch` installation and its old index format
- the old retrieval worker and RRF modules
- the server generation service and API route

Retain `@vercel/blob` and `dotenv` only for the explicit image workflow. Retain `framer-motion` and `ogl` for the dock and Grainient. The Jet's Ghost design independently introduces pinned `@litert-lm/core`, MiniSearch, and stemmer dependencies with a new version-matched static index.

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

- home, about, blog index/detail, works index/detail, tools, contact, and RSS routes, using trailing slashes for human-facing HTML and preserving machine endpoint extensions;
- theme persistence;
- dock keyboard navigation and mobile disclosure;
- the interim core-`2.0.0` chain in which `/chatbot` normalizes to `/chatbot/`, `/chatbot/` redirects to noindexed `/tools/chatbot/`, and that destination terminates at `200`; plus the companion `2.1.0` reversal in which `/chatbot` normalizes to the canonical `200` document, `/tools/chatbot` normalizes to `/tools/chatbot/`, and one explicit legacy rule redirects that slashful path to `/chatbot/`;
- `/about` redirecting once to `/about/`, exact canonical/OG/JSON-LD/sitemap agreement on `/about/`, and both retired blog canonicals returning `404` while remaining absent from internal links, sitemap, and RSS;
- absence of published draft routes;
- SSRN DOI action;
- representative metadata and JSON-LD;
- reduced-motion Grainient behavior;
- the approved noindexed Jet's Ghost prototype or released activation flow, depending on milestone.

Browser regression tests run against the built static output through `astro preview`, not the development server. The checked-in suite includes each listed route and assertion, parses JSON-LD as JSON, verifies active navigation and mobile disclosure behavior, and installs its browser plus system dependencies in CI. Pull-request, `main`, manual, and nightly runs execute this same pair of routine jobs. Vercel-only redirect behavior is a separate deployment assertion with an exact status and destination.

Real-model Jet's Ghost evaluation is kept out of the routine CI path because it requires WebGPU and a roughly 2 GB model download. The companion design defines its separate release gate.

## Error and operational behavior

- A content-policy error fails the build with the entry path and violated rule.
- A missing image remains a build or validation failure according to the existing image workflow; it is not silently replaced.
- Failure to load analytics does not affect navigation or content.
- WebGL failure retains the existing visual fallback.
- Jet's Ghost failure never affects the site's static routes or primary navigation.
- No visitor prompt, response, or selected context is sent to analytics or a server.
- Production failures are diagnosable through CI output, Vercel deployment state, browser console checks, and deterministic reproduction from the deployed commit.

## Sequencing constraints

The later implementation plan must respect these dependencies:

1. Identify the existing Vercel project and non-secret OpenRouter key record, revoke that key immediately, verify it is revoked/disabled, and retain only the constrained private readback needed for later sanitization. This is the first external mutation.
2. Inventory the original dirty checkout, record the approved starting commit, and create a clean isolated worktree and branch from that exact commit. Never edit, stage, or build the user-owned untracked Codex draft or other untracked files in the original checkout.
3. Before any deployment or visual change, capture an immutable production baseline for representative routes, viewports, metadata, and the deployed commit/deployment identity.
4. Establish canonical `AGENTS.md`, record version `1.0.0`, Conventional Commits, and the no-attribution rule before subsequent commits.
5. Remove the inert Vercel credential variable, delete the draft-bearing and obsolete assistant artifacts, remove the endpoint, deploy the static containment build, and read every containment boundary back before further feature work.
6. Introduce the explicit content contract and migrate tracked entries before replacing filters.
7. Make the build pure before adding the new knowledge package.
8. Establish automated verification before broad component or accessibility changes.
9. Complete the trailing-slash canonical contract and its local/deployment assertions, then release the breaking core modernization as `2.0.0` independently of Jet's Ghost.
10. After exact core production verification, request Search Console indexing for `/about/` only; wait for recrawl/report refresh before interpreting or validating the report.
11. Integrate the approved Jet's Ghost interface without redesign, reverse the interim route and navigation state as one coordinated change, and release it through the separate plan as `2.1.0`.
12. Remove historical runtime dependencies only after no active code imports them.
13. Rewrite the README after its documented commands and architecture are implemented.
14. Resolve the default OpenGraph image TODO before archiving the completed TODO record and finalizing canonical documentation.

## Release criteria

The core modernization is complete when:

- the OpenRouter key is revoked and absent from Vercel;
- the draft-bearing public artifacts return 404;
- `/api/chat` is absent in production;
- all public and assistant content follows the explicit status policy;
- production verification rejects untracked published entries;
- `npm run build` makes no remote writes and changes no tracked or nonignored untracked source/configuration file;
- `npm run verify` passes on Node 24 in CI;
- the core-`2.0.0` site deploys as static output with Astro and Vercel trailing-slash settings aligned, exact canonical/OG/JSON-LD/navigation/sitemap agreement for HTML routes, extension-correct machine endpoints, and the documented interim `/chatbot` to `/chatbot/` to noindexed `/tools/chatbot/` chain with exact statuses and destinations, ready for the companion plan's coordinated reversal;
- `/about` redirects once with `308` to the verified indexable `/about/`; both retired blog canonicals return `404` and remain absent from internal links, sitemap, and RSS;
- after exact production verification, Search Console indexing is requested only for `/about/`, with report validation deferred until recrawl/report refresh and no requests or validation for the excluded classes above;
- the DOI-backed SSRN action is the only research action;
- `origin/main` Grainient performance behavior is preserved and reduced motion is supported;
- representative routes pass browser smoke and automated accessibility checks;
- active documentation identifies modernized v1 as canonical and v2 as superseded;
- every committed deployment/environment evidence file is a sanitizer-approved allowlisted projection, and every release readback artifact has a published SHA-256 that is verified after downloading it from the release;
- `AGENTS.md` is canonical, `CLAUDE.md` points to it, the recorded pre-modernization baseline is `1.0.0`, the released application is `2.0.0`, and commit instructions require Conventional Commits without agent attribution;
- the README is concise, professional, and accurate to the implemented system;
- the deterministic first-frame homepage hero is checked in as the verified default OpenGraph image and the completed TODO is archived;
- the visual and editorial character remains materially unchanged.

## Risks and mitigations

### Dirty working tree during baseline synchronization

The repository contains user-owned untracked drafts and specifications. Implementation must inventory them, create a clean worktree from the approved commit, leave the original checkout untouched, and stage only explicit paths. The only exceptions are the user-authorized, hash-verified archival copy and post-integration cleanup of the seven named non-canonical documentation artifacts. Cleanup hashes the manifest and every archived destination blob from the annotated release ref itself before removing originals; current-worktree copies are not sufficient evidence. The immutable Task 0 inventory and the later user-approved Task 11 inventory are both retained and validated. The active Codex article is not part of the allowlist and remains untouched. If the clean checkout cannot reproduce a build because a private untracked draft was previously affecting it, record that baseline defect instead of rewriting the draft.

### Static adapter removal or route reversal changes redirect behavior

Move the containment redirect to Vercel configuration and require its documented `308` status plus Task 3's exact `Location: /tools/chatbot` before removing the server adapter; that pre-trailingSlash response remains historical evidence. Task 10 later moves the still-interim explicit rule to `/chatbot/` with destination `/tools/chatbot/` as part of core canonical normalization, while Vercel owns `/chatbot` to `/chatbot/`. In `2.1.0`, reverse the single explicit slashful rule only in the same change that establishes canonical `https://jetsanchez.com/chatbot/` metadata and updates sitemap, navigation, and deployment tests. Keep one coherent Ghost route pattern: `/chatbot` normalizes to the canonical `200` `/chatbot/` document; `/tools/chatbot` normalizes to `/tools/chatbot/`; and the sole explicit legacy rule redirects `/tools/chatbot/` to `/chatbot/`.

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
- Approved Jet's Ghost 2.1.0 interface: `docs/jets-ghost-chat-experience.md` and commit `d406ed46dfc7cccfa95d0003fcae30f5b9373690`
- Timesheet local-assistant research rollout: `019f1533-9ec8-7b32-b80c-fe27b684a5f6`
- [Semantic Versioning 2.0.0](https://semver.org/spec/v2.0.0.html)
- [Conventional Commits 1.0.0](https://www.conventionalcommits.org/en/v1.0.0/)
