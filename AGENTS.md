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
- Every content image requires a tracked descriptor key, descriptive authored `alt` text, and verified descriptor rendition dimensions so cards and custom OpenGraph metadata never borrow false default dimensions.
- Run `npm run verify:content` after changing frontmatter or content-policy code.

## Collections and discovery

- Blog and Works use the shared collection-card anatomy: fixed 16:9 media, optional content-type eyebrow, title, complete summary, and concise facts. Cards do not expose tag rows, partial metadata counters, Featured state, or external-action footers.
- Blog server-renders the complete canonical newest-first collection and progressively enhances it with normalized, token-prefix fuzzy search over title, short title, description, summary, and tags. The canonical query parameter is `q`; clearing or invalid input restores canonical order.
- Works server-renders one canonical newest-first collection. Type filtering changes visibility only and preserves order; `homepagePriority` affects Homepage selection only.
- Homepage Blog and Works each resolve at most five unique records into a visible-triggered, finite, manually looping depth carousel with a complete static fallback. Keep the active card centered between mirrored receding rails, constrain drag to the full owning section canvas, and preserve vertical page scrolling. Only one collection tree is accessible at a time; there is no autoplay, cloned loop item, or duplicate canonical record.
- Homepage and hub `ItemList` schemas use the exact canonical arrays rendered on those pages. Positions are one-based, finite, unique, and independent of client search, filtering, or carousel state.

## Image workflow

`AGENTS.md` is the sole active image-workflow authority. The upload script is the only checked-in command authorized to mutate Vercel Blob.

### Prepare and publish

- Stage descriptive kebab-case source files only in ignored `Untracked/media-staging/{about,blog,works}/`. Never put originals in `public/`; builds reject media in the legacy `public/images-staging/` lanes. Retain their `.gitkeep` markers.
- Supported formats: JPEG, PNG, WebP, AVIF, GIF. Reject animation/multipage, sources over 20 MiB or 64 megapixels. Published Blog/Works sources must be exactly 1920×1080. About must be 3:4, at least 1200×1600; preserve the current 3060×4080 original.
- Set the existing public store token as `BLOB_READ_WRITE_TOKEN` and the separate private `jet-web-originals` token as `BLOB_ORIGINALS_READ_WRITE_TOKEN` in local `.env.local` only. Never connect the originals store or its credential to deployment/CI environments.

```bash
npm run upload-image -- blog/local-ai-retrieval.jpg
npm run upload-image -- works/research-project.png
npm run upload-image -- about/about-hero.jpg
```

The operator command preserves raw originals privately, creates finite WebP/JPEG delivery renditions, checks dimensions/budgets/hash/cache metadata, uploads without overwrite, and atomically saves `src/data/media/<lane>/<slug>.json` only after complete readback verification. Paths include pipeline version and full source/output SHA-256. Interrupted uploads resume using ignored operation receipts; no automatic deletion or rollback is permitted.

### Reference and verify

```yaml
image:
  asset: blog/local-ai-retrieval
  alt: A descriptive account of the visible image
```

Works additionally supports `darkAsset`. Direct authored `url`, `darkUrl`, width or height fields are rejected. Git-track descriptors together with content. About resolves `about/about-hero` through the same local registry. Rendering uses public renditions; no build-time remote optimization or media credentials are required. Social metadata consistently uses the light 1200×675 JPEG. The public rendition contract is maintained below.

1. Run `npm run verify:content`, `npm run verify:media`, and `npm run verify:build-purity`.
2. Use `npm run validate-images` only for explicit remote verification. It deduplicates and bounds reads of public renditions; routine tests/builds remain offline for media.
3. Inspect mobile/desktop and light/dark rendering. Preserve staged originals until the private archive is verified; never delete local progress implicitly.
4. Legacy migration is operator-only: `npm run upload-image -- --cache-legacy` caches each inventoried source once; `npm run upload-image -- --migrate-legacy` archives all 14 originals and publishes the 11 referenced sets. Receipts and source caches live under ignored `Untracked/media-migration/`. Retain all legacy public objects until an explicitly approved retirement after release acceptance and verified deployment. Publication alone cannot stop requests to old URLs.

### Public rendition contract

Generate this finite set at upload time; builds only resolve checked-in descriptors.

| Source lane  | Public role       | Dimensions | Format | Maximum encoded bytes |
| ------------ | ----------------- | ---------- | ------ | --------------------- |
| Blog / Works | responsive-small  | 480x270    | WebP   | 60,000                |
| Blog / Works | responsive-medium | 960x540    | WebP   | 160,000               |
| Blog / Works | carousel          | 1152x648   | WebP   | 220,000               |
| Blog / Works | responsive-large  | 1440x810   | WebP   | 300,000               |
| Blog / Works | detail            | 1920x1080  | WebP   | 500,000               |
| Blog / Works | social            | 1200x675   | JPEG   | 200,000               |
| About        | portrait-small    | 400x533    | WebP   | 100,000               |
| About        | portrait-medium   | 800x1067   | WebP   | 200,000               |
| About        | portrait-detail   | 1200x1600  | WebP   | 350,000               |

Intermediate portrait heights use aspect-preserving rounding, with at most one pixel of rounding difference; record decoded dimensions. Public output strips source metadata; transparent social JPEGs flatten against white. Start at WebP quality 82 or JPEG quality 80, with bounded quality reduction no lower than 70. Fail with the role and measured size when a budget cannot be met; never silently crop, resize or publish an oversized fallback. Use no-overwrite immutable object paths and a one-year cache lifetime. Light/dark artwork has separate descriptors; social metadata uses the light asset, and About keeps the default social image.

### Media release cutover

Qualify the rendition references, metadata and rendering on Preview before an approved Production promotion. After cutover, verify live page and metadata identities and monitor continuing requests to legacy URLs separately. Before any separately approved retirement, inventory retained deployments and rollback dependencies and present the exact targets and consequences. An application-domain redirect cannot intercept direct Blob-host requests. Before retirement, old content commits remain rollback targets; afterward, rollback must use rendition-based releases. Preserve the private archive and local operation receipts.

The default social image is the committed `public/images/og-default.jpg`. Recreate it only through `npm run capture:og -- --overwrite`, visually inspect the result, and retain the exact shared metadata contract in `src/config/site.ts`.

## Egregore

Egregore is a local-first technical showcase and experimental personal assistant, not a general website-support widget.

The following runtime and interaction boundaries are maintained:

- The semantic route is the canonical `200` document at `/chatbot/`; platform normalization owns slashless variants, and one explicit legacy `/tools/chatbot/` rule redirects to `/chatbot/`.
- `/chatbot/` is an index-follow canonical page and appears once in the generated sitemap. Vercel owns Preview and outdated-deployment exclusion through its deployment-wide `X-Robots-Tag`; do not add a page-level Egregore indexing gate.
- Egregore occupies the former Tools navigation slot; `/tools/` stays dormant, noindexed, and out of primary navigation.
- Use the pinned Gemma 4 E2B LiteRT-LM browser runtime only. Do not add E4B switching or a hosted fallback.
- Preserve the explicit boundary: route rendering and compatibility checks do not authorize model/corpus download or GPU allocation. Only “Load Egregore” may start those operations; prompt assembly begins only when the visitor sends a message.
- Use the immutable, versioned eligible corpus and one deterministic MiniSearch rank-and-pack pipeline with provenance and citations. Embeddings, Gemma reranking, PGlite, pgvector, EntityDB, and the legacy multi-stage RAG implementation are not part of the approved production path.
- The fake runtime is permanent deterministic development and test architecture. Preserve its lifecycle, failure, privacy, responsive, and interaction scenarios; it must remain unavailable and absent from Production artifacts.
- `/api/chat`, hosted generation, and the OpenRouter production credential remain removed.
- The distributed license bundle, pinned package and runtime identities, public notice routes, and applicable notice text are current product contracts. Historical legal analysis is evidence, not an executable input.

Preserve the released interaction model: a full-screen local-first experience, explicit compatibility and load actions, stable lifecycle controls, deterministic citations, keyboard-operable disclosures, responsive layouts, reduced-motion behavior, and the established semantic color roles.

Assistant responses render constrained Markdown through the dedicated response renderer. Raw HTML and model-authored images remain inert; links allow only HTTP(S), `mailto:`, and same-document fragments; unsupported nodes retain safe text where possible; and only validated source identifiers become citation links. Preserve arbitrary incomplete streamed text and the plain-text failure fallback without changing retrieval or model behavior.

### Grounding and model storage

- `src/config/egregore.ts` owns product identity and public routes. `src/features/egregore/config.ts` owns the exact model, runtime, context and corpus pins; package versions remain authoritative in `package.json`.
- The tracked, published, assistant-enabled `profile:jet-sanchez` record supplies About content, public role and biography, Person metadata and assistant grounding. It creates no standalone public profile route. Do not duplicate changing biographical facts in the system prompt.
- Egregore refers to Jet in the third person, answers from supplied published sources, abstains without evidence and exposes only validated citations used in the answer. Conversation state and prompts remain session-only and local.
- Cache Storage identity includes the cache schema and exact model SHA-256; its request key includes the pinned revision and filename. Application-version changes do not invalidate the model cache, and there is no TTL, service worker, IndexedDB or OPFS storage path.
- After explicit loading authorization, stream the trusted pinned response into Cache API and read the completed cached body for runtime use. Do not clone or tee the model-sized body. Cache unavailability permits an explicit uncached attempt; a failed write must never silently trigger another transfer.
- **Unload** releases conversation, runtime, engine, GPU and memory state while retaining downloaded bytes. **Remove downloaded model** explicitly removes the current cached model and is available only when it exists.
- Browser Fetch cannot inspect opaque manual redirect hops. The release/manual delivery check owns exact initial URL, trusted HTTPS redirect hops and redirect limits; keep this check outside routine model-free CI.

### Dock and immersive layouts

Below `48rem`, an ordinary fresh document starts with an open dock and discovers its disclosure through the first qualifying scroll; a fresh immersive document exposes the disclosure immediately. Explicit open/closed choices persist across client navigation, reload and history in the same tab. At `48rem` and above, the dock is always exposed and mobile preference is suspended, then restored below that boundary. A closed dock is inert, absent from the accessibility tree and sequential focus; its semantic disclosure maintains accurate expanded/control state and focus restoration.

Shared navigation exclusion zones reserve the bottom dock/disclosure envelope below `48rem`, the always-open bottom dock from `48rem` to below `64rem`, and top separation at `64rem` and above. Internally scrolling Egregore lifecycle surfaces consume the same stable clearance. Short mobile viewports must fit without clipping activation, consent, recovery, composer or conversation content. Starter prompts are omitted below `48rem`; direct composition remains available. Keep **Egregore can make mistakes. Check cited sources.** immediately above the composer until the first submission, using the shared meta text token and allowing accessible wrapping.

## SEO and release behavior

- Every public page needs a unique title, description, canonical URL, OpenGraph URL/image, Twitter metadata, and correct linked JSON-LD identities.
- GA4 is emitted only by an explicit Vercel Production build. Local development, local builds/previews, CI, and Vercel Preview are excluded automatically and require no device toggle. Production document requests pass through root Vercel Routing Middleware, which maps only Vercel's approximate country signal to a coarse `strict`/`standard` policy cookie; EEA/UK/CH plus missing or unknown signals use the conservative strict policy. This is a site risk policy, not a legal-status determination, and this layer must never persist raw country, IP, city, or coordinates. Strict pages make no GA-family request before explicit consent. Keep the consent bar compact, non-modal, accessible, and equal-weight for Reject/Allow; keep the Production-gated settings control on `/privacy/` available for reopening or changing a choice. Do not add an Astro server adapter.
- The hidden `?analytics=off`/`?analytics=on` control is only an emergency, persistent Production browser-profile fallback; it does not identify a physical Mac, is not visitor navigation or a normal test workflow, and does not replace carefully tested account-side internal-traffic filtering when a stable IP makes that appropriate. `off` rejects analytics; `on` clears the fallback so the regional policy applies again.
- GA4 uses the native asynchronous Google tag, initialized once per document, with one manual page view per `astro:page-load`. Keep `send_page_view: false` and the web stream's Enhanced Measurement → Page views → “Page changes based on browser history events” setting disabled together; that remote setting otherwise duplicates manual route events. Other enhanced measurements remain enabled. Initialization values must retain Google's required native types; do not serialize the initialization `Date` through a worker bridge.
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

Generated QA screenshots, browser traces, run output and agent execution scratch are local or bounded CI artifacts. Keep `.superpowers/`, `test-results/`, `playwright-report/` and `coverage/` outside Git. Durable repository evidence uses compact text records; do not commit generated screenshot bundles.

> **Contract-Coupling Principle:** Every test must derive its assertions from an observable, durable contract at the narrowest appropriate boundary. For components, this includes public APIs, rendered semantics, interaction, accessibility, and explicitly standardized visual behavior. For modules, scripts, builds, CI, and security controls, it includes declared inputs, outputs, failure modes, generated artifacts, and invariants. Private helpers, source layout, call graphs, intermediate representations, CSS classes, and implementation choices are not valid test targets unless explicitly designated as compatibility or artifact contracts. A behavior-preserving refactor should not ordinarily break a test.

> **Test Contract Revalidation:** Developmental tests help discover and construct the implementation. Durable tests protect the accepted contract afterward. Within each task slice, follow RED → GREEN → refactor the implementation → revalidate the contract, retaining or consolidating durable tests and removing developmental tests that have served their purpose.

GitHub Actions owns two stable routine jobs, `verify` and `browser`. They run for pull requests, pushes to `main`, manual dispatch, and nightly at `17 18 * * *` (`02:17` Asia/Manila). Configure both as strict required checks on `main`. Browser failures retain `test-results/playwright/` as a run-and-attempt-specific artifact for seven days; absent files must not obscure the original failure. Keep the approximately 2 GB real-model qualification outside routine and nightly CI; run it only through the explicit release workflow.

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

- [Project overview and development commands](./README.md)
- [Third-party notices](./THIRD_PARTY_NOTICES.md)
- [Documentation archive](./docs/archive/README.md)

`AGENTS.md` owns maintained contributor, architecture and operational requirements. Move completed or inactive release designs, execution plans and qualification records into the release-owned archive after carrying forward still-current contracts here. Historical documents under `docs/archive/` preserve dated evidence and reasoning, not current instructions; archiving never establishes acceptance or completes pending deployment, indexing or storage-retirement actions.
