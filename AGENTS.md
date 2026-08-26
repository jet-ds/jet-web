# jetsanchez.com contributor instructions

`AGENTS.md` is the canonical repository guide for human and automated contributors. `CLAUDE.md` is a compatibility symlink to this file.

## Project

jetsanchez.com is Jet Sanchez's personal website, writing archive, research portfolio, and home for local-first AI experiments. It uses Astro 7, MDX, React 19 islands, Tailwind CSS 4, strict TypeScript 6, and Vercel static hosting.

Primary routes are Home, About, Blog, Works, Egregore, and Contact. Egregore is released at canonical `/chatbot/`; its local runtime remains behind explicit visitor actions. `/tools/` remains a dormant, noindexed route outside primary navigation.

## Runtime and commands

Use Node.js 24.x and npm. `package.json` is authoritative for executable commands.

The supported browser floor is Chrome 111+, Safari 16.4+, and Firefox 128+.

```bash
npm install
npm run dev
npm run check
npm run test
npm run test:e2e
npm run verify:content
npm run verify:docs
npm run verify:build-purity
npm run build
npm run preview
npm run verify
```

Other intentional commands include `verify:browser`, `verify:production`, `validate-images`, `upload-image`, and `capture:og`. Do not document or invoke a script that is not present in `package.json`.

The production build is pure. `npm run build` may validate repository inputs and write local build output, but it must not upload files, modify credentials, call deployment APIs, or perform any other external write.

## Architecture

- Prefer Astro components for static presentation and React only for stateful browser interactions.
- Content sources live in `src/data/blog/` and `src/data/works/`; loaders are defined in `src/content.config.ts`, with shared schemas in `src/schemas/content.ts`.
- Use `getCollection()` and `getEntry()` for type-safe content access.
- `src/features/collections/resolveCollections.ts` owns published Blog and Works membership, canonical ordering, Homepage selection, and serializable display records. Hubs, Homepage sections, detail navigation, `ItemList` schema, and generated discovery surfaces consume those resolved orders rather than defining local comparators.
- Shared site metadata and navigation live in `src/config/site.ts`; `NAV_ITEMS` owns the shared route and label contract for the dock, no-script navigation, JSON-LD navigation, and Footer Quick Links.
- `BaseLayout` owns the page-level WebPage schema. Content pages add their specific linked schema, such as BlogPosting, ScholarlyArticle, SoftwareApplication, or CreativeWork.
- `/llms.txt` is generated from the publication-aware Blog and Works resolvers. Built-route structured-data verification discovers emitted HTML routes and validates their canonical, page-identity, visible-destination, and finite `ItemList` relationships without a named-route inventory.
- Use trailing-slash canonical URLs throughout page metadata, navigation, sitemap output, and structured data.
- Vercel serves the static Astro output. Do not add a server adapter or hosted generation fallback without a newly approved architecture decision.

## Code conventions

- Use 2-space indentation, LF line endings, single quotes in TypeScript, double quotes for JSX attributes, and semicolons.
- Keep TypeScript strict. Avoid `any`; when an external boundary requires it, narrow the value immediately and explain the exception.
- Name components with PascalCase, utilities and hooks with camelCase, hooks with a `use` prefix, and MDX content with kebab-case.
- Keep components focused and prefer composition over prop drilling.
- Preserve semantic HTML, keyboard access, visible focus, descriptive labels, reduced-motion behavior, and responsive layouts.
- External links that open a new tab need `rel="noopener noreferrer"`.

## Design system

- `src/styles/theme.css` is the CSS-first owner of Tailwind-generating palette, semantic color, font, fluid type, and fluid spacing tokens. `src/styles/global.css` owns runtime custom properties, base styles, and component recipes; do not hard-code the underlying OKLCH scale in components.
- Keep semantic colors mapped to the established numbered OKLCH steps. `brand-base` is a solid interactive fill, while `brand-text` is the readable branded foreground for links and normal text; neither role is interchangeable. Dark code surfaces use the dedicated palette-derived `code-block-text` role.
- Slate blue is the primary interactive family. Mustard is an accent for deliberate calls to action, progress, particles, and citation emphasis.
- Use `section-brand` for broad blue section surfaces. Keep that role distinct from `brand-subtle`, which remains the `soft` action fill in both themes.
- Blog and Works long-form content anchors use the mustard `accent-text` prose recipe with its shared hover, focus-visible, dark-theme, forced-colors, and reduced-motion behavior. The framework-neutral `.text-link` recipe remains for its other inline-prose consumers, including `Link.astro` primary links. Do not apply either recipe to cards, navigation/footer, actions, the dock, citation markers, or source-disclosure controls.
- Use the framework-neutral `.action` recipes for button-like controls in Astro, React, or plain HTML. Variants are `brand`, `accent`, `soft`, `neutral`, `outline`, `ghost`, `filter`, `stop`, and `disabled`; `filter` state is expressed with `aria-pressed`, never color alone.
- Action densities are `compact` (44×44px minimum target, 8px radius), `default` (44×44px minimum target, 8px radius), and `immersive` (48×48px minimum target, 12px radius). Egregore primary lifecycle actions use `immersive`; small labels do not justify targets below 44×44px. `Button.astro` exposes the same taxonomy through `variant` and `density`.
- Write visible action copy in sentence case while preserving product names, platform names, personal names, and acronyms.
- Preserve the shared action focus, disabled, reduced-motion, and forced-colors behavior. Add only role-specific layout or typography utilities; do not recreate a second React-only visual taxonomy.
- Use Utopia fluid type and spacing tokens. Prefer `px-gutter`, `py-section`, `py-section-lg`, `p-card`, and fluid gap/type tokens over breakpoint-based spacing.
- Use `svh` for viewport-height layouts. Responsive utilities are acceptable when behavior, rather than spacing, genuinely changes.
- Preserve the Liquid Glass dock's specialized compatibility behavior.
- Dark mode uses the `.dark` class, persisted visitor choice, system preference fallback, and the early head script that prevents a theme flash.

## Content policy

All blog and work records are MDX under `src/data/` and must satisfy the shared schema. Publication state is explicit and required:

```yaml
status: draft
assistant: false
```

- Public content requires `status: published`.
- Egregore inclusion requires both `status: published` and `assistant: true`.
- Draft, untracked, malformed, or implicitly configured content must never enter the production site or assistant corpus.
- Published Blog and Work records require a complete authored summary of at most 160 characters and immutable featured artwork with descriptive alternative text and verified `1920x1080` intrinsic dimensions. Drafts may remain incomplete.
- Blog fields include title, optional short display title, description, required-on-publication card summary and image, optional search title and description overrides, publication date, author, tags, publication state, assistant eligibility, and optional explicit review metadata.
- Review metadata currently identifies a movie and an integer rating on the five-star scale. It renders in the article header and as a linked `Review` JSON-LD entity; Blog and Home cards remain unrated editorial teasers.
- Work fields include title, optional short display title, description, required-on-publication card summary and image, type, date, tags, publication state, assistant eligibility, optional positive-integer `homepagePriority`, optional links, and type-specific research or project fields. Lower Homepage priorities sort first; the Works hub ignores priority.
- Tags are human-facing labels rendered verbatim. Separate words with spaces rather than kebab-case hyphens; retain hyphens only when the term itself requires one, such as `Spider-Man` or `cross-country measurement`.
- Every content image requires a stable URL, descriptive `alt` text, and verified intrinsic pixel `width` and `height` so cards and custom OpenGraph metadata never borrow false default dimensions.
- Run `npm run verify:content` after changing frontmatter or content-policy code.

## Collections and discovery

- Blog and Works use the shared collection-card anatomy: fixed 16:9 media, optional content-type eyebrow, title, complete summary, and concise facts. Cards do not expose tag rows, partial metadata counters, Featured state, or external-action footers.
- Blog server-renders the complete canonical newest-first collection and progressively enhances it with normalized, token-prefix fuzzy search over title, short title, description, summary, and tags. The canonical query parameter is `q`; clearing or invalid input restores canonical order.
- Works server-renders one canonical newest-first collection. Type filtering changes visibility only and preserves order; `homepagePriority` affects Homepage selection only.
- Homepage Blog and Works each resolve at most five unique records into a visible-triggered, finite, manually looping depth carousel with a complete static fallback. Keep the active card centered between mirrored receding rails, constrain drag to the full owning section canvas, and preserve vertical page scrolling. Only one collection tree is accessible at a time; there is no autoplay, cloned loop item, or duplicate canonical record.
- Homepage and hub `ItemList` schemas use the exact canonical arrays rendered on those pages. Positions are one-based, finite, unique, and independent of client search, filtering, or carousel state.

## Image workflow

`AGENTS.md` is the sole active image-workflow authority. The upload script is the only checked-in command authorized to mutate Vercel Blob.

### Prepare

- Supported source formats are `jpg`, `jpeg`, `png`, `webp`, `avif`, and `gif`.
- Stage files in exactly one lane: `public/images-staging/about/`, `public/images-staging/blog/`, or `public/images-staging/works/`.
- Use a descriptive kebab-case slug tied to the destination page or content slug, for example `local-ai-retrieval.jpg`.
- Blog and work featured images should be `16:9` and under 2 MB before upload.
- The current About portrait lane uses `3:4`, with `1200x1600` as the reference size.
- Do not replace the `.gitkeep` files with a second workflow document.

### Upload

Set `BLOB_READ_WRITE_TOKEN` in `.env.local`, then run:

```bash
npm run upload-image blog/local-ai-retrieval.jpg
npm run upload-image works/research-project.png
npm run upload-image about/about-hero.jpg
```

The command reads only from `public/images-staging/<type>/`, hashes the bytes, uploads to `images/<type>/<slug>-<hash>.<ext>`, and returns the immutable public URL. Do not call Vercel Blob write APIs from a build, content loader, page, or ad hoc replacement script.

### Reference

For blog records, copy the returned URL and verified intrinsic dimensions into the matching file under `src/data/blog/`:

```yaml
image:
  url: 'https://example.public.blob.vercel-storage.com/images/blog/example-12345678.jpg'
  alt: 'A descriptive account of the visible image'
  width: 1920
  height: 1080
```

Work records use `url`, optional `darkUrl`, `alt`, and optional verified intrinsic `width` and `height` under `src/data/works/`.

The About portrait is not content frontmatter. Update the direct `OptimizedImage` source in `src/pages/about.astro`, retaining the actual dimensions and descriptive alternative text.

### Verify and clean up

1. Run `npm run validate-images` when remote content-image references change.
2. Run `npm run build`, then inspect the affected page with `npm run preview` at representative desktop and mobile widths in light and dark mode.
3. Confirm the intended crop, intrinsic dimensions, alternative text, and production Blob response.
4. A changed file produces a new hash URL rather than overwriting the old object. Update every repository reference and verify the replacement before any explicit operator-side deletion of the obsolete Blob.
5. The upload script does not delete or replace old objects. Blob removal is a separate external operation and must not occur while a live page or deployment references the URL.
6. Remove the local staged source after the new URL is adopted and verified; leave each lane's `.gitkeep` in place.

The default social image is the committed `public/images/og-default.jpg`. Recreate it only through `npm run capture:og -- --overwrite`, visually inspect the result, and retain the exact shared metadata contract in `src/config/site.ts`.

## Egregore

Egregore is a local-first technical showcase and experimental personal assistant, not a general website-support widget.

The released `2.2` runtime and interaction boundaries are in force:

- The semantic route is the canonical `200` document at `/chatbot/`; platform normalization owns slashless variants, and one explicit legacy `/tools/chatbot/` rule redirects to `/chatbot/`.
- `/chatbot/` is an index-follow canonical page and appears once in the generated sitemap. Vercel owns Preview and outdated-deployment exclusion through its deployment-wide `X-Robots-Tag`; do not add a page-level Egregore indexing gate.
- Egregore occupies the former Tools navigation slot; `/tools/` stays dormant, noindexed, and out of primary navigation.
- Use the pinned Gemma 4 E2B LiteRT-LM browser runtime only. Do not add E4B switching or a hosted fallback.
- Preserve the explicit boundary: route rendering and compatibility checks do not authorize model/corpus download or GPU allocation. Only “Load Egregore” may start those operations; prompt assembly begins only when the visitor sends a message.
- Use the immutable, versioned eligible corpus and one deterministic MiniSearch rank-and-pack pipeline with provenance and citations. Embeddings, Gemma reranking, PGlite, pgvector, EntityDB, and the legacy multi-stage RAG implementation are not part of the approved production path.
- The fake runtime is permanent deterministic development and test architecture. Preserve its lifecycle, failure, privacy, responsive, and interaction scenarios; it must remain unavailable and absent from Production artifacts.
- `/api/chat`, hosted generation, and the OpenRouter production credential remain removed.
- The distributed license bundle, pinned package and runtime identities, public notice routes, and applicable notice text are current product contracts. Historical legal analysis is evidence, not an executable input.

Preserve the released interaction model: a full-screen local-first experience, explicit compatibility and load actions, stable lifecycle controls, deterministic citations, keyboard-operable disclosures, responsive layouts, reduced-motion behavior, and the established semantic color roles. The [2.2.0 design](./docs/superpowers/specs/2026-07-18-jet-web-2.2.0-design.md) is the current product authority.

Assistant responses render constrained Markdown through the dedicated response renderer. Raw HTML and model-authored images remain inert; links allow only HTTP(S), `mailto:`, and same-document fragments; unsupported nodes retain safe text where possible; and only validated source identifiers become citation links. Preserve arbitrary incomplete streamed text and the plain-text failure fallback without changing retrieval or model behavior.

## SEO and release behavior

- Every public page needs a unique title, description, canonical URL, OpenGraph URL/image, Twitter metadata, and correct linked JSON-LD identities.
- GA4 is emitted only by an explicit Vercel Production build. Local development, local builds/previews, CI, and Vercel Preview are excluded automatically and require no device toggle. Production document requests pass through root Vercel Routing Middleware, which maps only Vercel's approximate country signal to a coarse `strict`/`standard` policy cookie; EEA/UK/CH plus missing or unknown signals use the conservative strict policy. This is a site risk policy, not a legal-status determination, and this layer must never persist raw country, IP, city, or coordinates. Strict pages make no GA-family request before explicit consent. Keep the consent bar compact, non-modal, accessible, and equal-weight for Reject/Allow; keep the Production-gated settings control on `/privacy/` available for reopening or changing a choice. Do not add an Astro server adapter.
- The hidden `?analytics=off`/`?analytics=on` control is only an emergency, persistent Production browser-profile fallback; it does not identify a physical Mac, is not visitor navigation or a normal test workflow, and does not replace carefully tested account-side internal-traffic filtering when a stable IP makes that appropriate. `off` rejects analytics; `on` clears the fallback so the regional policy applies again.
- Every Playwright context that can navigate a Production origin must install the shared Google Analytics traffic block before its first navigation. This includes deployed readback and real-model runs that accept an external base URL. The dedicated isolated analytics fixture is the only exception: it intercepts and fulfills every analytics endpoint locally so no request reaches Google. Routine and release browser configurations exclude that Production-only fixture because their local non-Production build cannot exercise its branch.
- `npm run verify:analytics` owns the isolated Production browser fixture. The separate `npm run verify:analytics:release` gate additionally runs `vercel build --prod` and verifies the packaged Routing Middleware artifact; keep that external-tool qualification outside ordinary `npm run verify`.
- Search Console measures Google Search impressions and clicks rather than site visit events. Do not claim that application analytics controls or a physical-device filter remove ordinary searches from Search Console.
- Canonical routes use trailing slashes. Slashless variants normalize with permanent redirects.
- `/about/` remains index-follow, canonical, and present in the sitemap; `/about` redirects to it.
- Retired `/blog/the-future-of-ai` and `/blog/building-with-astro/` routes remain intentional 404 responses and must not appear in internal links, RSS, or the sitemap.
- Release verification must prove route redirects, canonical/OpenGraph/JSON-LD agreement, navigation, robots, sitemap, RSS exclusions, and index state against the deployed site before Search Console follow-up.
- Do not request indexing for a Preview deployment or RSS feed. Search Console validation happens only after verified production deployment and recrawl.

## Testing and verification

Tests are organized by boundary:

- `tests/unit/` covers utilities, content policy, components, and operational scripts.
- `tests/e2e/` covers built-site behavior in Playwright.
- `tests/deployment/` covers Vercel and production-only routing or header behavior.

> **Contract-Coupling Principle:** Every test must derive its assertions from an observable, durable contract at the narrowest appropriate boundary. For components, this includes public APIs, rendered semantics, interaction, accessibility, and explicitly standardized visual behavior. For modules, scripts, builds, CI, and security controls, it includes declared inputs, outputs, failure modes, generated artifacts, and invariants. Private helpers, source layout, call graphs, intermediate representations, CSS classes, and implementation choices are not valid test targets unless explicitly designated as compatibility or artifact contracts. A behavior-preserving refactor should not ordinarily break a test.

> **Test Contract Revalidation:** Developmental tests help discover and construct the implementation. Durable tests protect the accepted contract afterward. Within each task slice, follow RED → GREEN → refactor the implementation → revalidate the contract, retaining or consolidating durable tests and removing developmental tests that have served their purpose.

GitHub Actions owns two stable routine jobs, `verify` and `browser`. They run for pull requests, pushes to `main`, manual dispatch, and nightly at `17 18 * * *` (`02:17` Asia/Manila). Configure both as strict required checks on `main`. Keep the approximately 2 GB real-model qualification outside routine and nightly CI; run it only through the explicit release workflow.

For ordinary changes, run the smallest focused RED test first, implement, rerun it GREEN, then run `npm run verify`. Add `npm run verify:browser`, build-purity, deployment, or production checks in proportion to the boundary changed. Browser qualification at representative desktop and mobile viewports is the `2.3` release boundary; there is no physical-device gate. Do not claim a deployed behavior from an Astro preview test.

Before deployment, verify light and dark modes, keyboard/focus behavior, responsive layouts, navigation, metadata, structured data, and the affected production route. Preserve existing user changes in a dirty worktree and do not broaden the commit beyond the approved task.

## Versioning and commits

- Follow [Semantic Versioning 2.0.0](https://semver.org/spec/v2.0.0.html).
- `package.json` is the authoritative application version. The current versioning baseline starts at `1.0.0`; use annotated `v<major>.<minor>.<patch>` release tags.
- Content-only or documentation-only deployments do not require a version change unless they accompany an application release.
- Follow [Conventional Commits 1.0.0](https://www.conventionalcommits.org/en/v1.0.0/): `type(optional-scope)!: description`.
- Common types are `feat`, `fix`, `docs`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, and `revert`.
- Mark incompatible changes with `!` and a `BREAKING CHANGE:` footer. Use commit bodies to record intent, constraints, and verification where useful.
- Do not add automated-tool, co-author, or generated-by attribution unless a human explicitly requests it for that commit.

## Canonical documentation

- [Jet Web 2.3.0 design](./docs/superpowers/specs/2026-08-25-jet-web-2.3.0-design.md)
- [Jet Web 2.3.0 implementation plan](./docs/superpowers/plans/2026-08-25-jet-web-2.3.0.md)
- [Jet Web 2.3.0 verification record](./docs/verification/jet-web-2.3.0.md)
- [Jet Web 2.2.0 Egregore product authority](./docs/superpowers/specs/2026-07-18-jet-web-2.2.0-design.md)
- [Documentation archive](./docs/archive/README.md)

Historical documents under `docs/archive/` are evidence, not current instructions. Do not cite an archived design as the active target when a canonical successor is listed.
