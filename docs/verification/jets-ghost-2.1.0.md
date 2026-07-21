# Jet's Ghost 2.1.0 qualification evidence

**Qualification status:** Pass.

This document is the in-place evidence record for the required real-model qualification. It contains no conversation content or sensitive delivery values. One full headed qualification exercised cold and warm activation, all six reviewed product cases, and lifecycle closeout. After those phases completed, the run exposed two harness-contract issues rather than product failures: the ordinary-discovery case was being scored as exhaustive cross-document enumeration, and Partytown's fixed same-origin sandbox document was missing from the exact request classifier. Both contracts were narrowed with failing-then-passing tests. The existing two-case real-model smoke then passed supported grounding, unsupported abstention, the complete corrected request ledger, lifecycle cleanup, and device-loss checks. The six-case model exercise was not repeated because that would add retrieval experimentation without changing the product decision.

## Tested system

| Field | Result |
| --- | --- |
| Apple Silicon hardware | Apple M4, 16 GB unified memory. |
| WebGPU adapter | `apple`, `metal-3`; real model loaded and generated successfully. |
| macOS version | `26.5` (`25F71`). |
| Installed branded Chrome version | `150.0.7871.116`. |

## Pinned delivery identity

| Field | Pinned value or qualification state |
| --- | --- |
| Application | `jet-web@2.1.0` |
| Model | Gemma 4 E2B LiteRT-LM |
| Model repository | `litert-community/gemma-4-E2B-it-litert-lm` |
| Repository revision | `9262660a1676eed6d0c477ab1a86344430854664` |
| Filename | `gemma-4-E2B-it-web.litertlm` |
| Initial URL | `https://huggingface.co/litert-community/gemma-4-E2B-it-litert-lm/resolve/9262660a1676eed6d0c477ab1a86344430854664/gemma-4-E2B-it-web.litertlm` |
| Expected complete size | `2,008,432,640` bytes |
| Expected SHA-256 | `3a08e8d94e23b814ae5414469c370c503813949acb8ceaa17e4ebf8a35af35b5` |
| Trusted hostnames | `huggingface.co`, `*.cdn.hf.co`, and `*.xethub.hf.co` |
| Maximum redirects | `5` |
| LiteRT-LM | `@litert-lm/core@0.14.0` |
| Same-origin LiteRT-LM path | `/assistant/runtime/litert-lm/0.14.0/` |
| Qualification verification mode | Complete independent download, byte count, and locally calculated SHA-256; passed. |
| Observed redirect depth | `1`; within the configured maximum of `5`. |

LiteRT-LM `0.14.0` accepts URL, `Blob`, and `ReadableStream<Uint8Array>` model sources. Jet's Ghost deliberately passes the pinned URL. It does not add application-owned incremental hashing or buffering, does not perform a second verification download for the runtime, and does not claim that each visitor's executed model bytes receive an independent SHA-256 check. Runtime guarantees are limited to explicit consent, pinned initial URL use, trusted HTTPS delivery containment, bounded redirects, and request privacy.

## Measurements

### Knowledge and context

| Measurement | Result |
| --- | --- |
| Corpus version | `a86019f454ddfb6a106ff6db22ebb1f9058c507a863a5455728e783da948d9aa` |
| Index configuration version | `1.1.0` |
| MiniSearch version | `7.2.0` |
| Stemmer version | `2.0.1` |
| Corpus artifact size, fetch, hash, and parse | Manifest `596` bytes; content `58,389` bytes; cold corpus fetch `9 ms`, warm `4 ms`; validation included below. |
| Index artifact size, fetch, hash, and hydration | `72,623` bytes; cold index fetch `9 ms`, warm `3 ms`; version-matched hydration passed. |
| Indexed and eligible chunk identity agreement | `66` indexed chunks matched `66` eligible chunks across `3` documents and `38` sections. |
| Serialized knowledge JSON | Full eligible package `12,772` estimated tokens; rank-and-pack enforced the configured `9,011`-token knowledge budget. |
| Serialized prompt budget | Passed with a `1,024`-token response reserve and `3,277`-token estimator headroom within `16,384` tokens. |
| Conversation configuration | `maxOutputTokens = 1,024`; real generation passed. |
| Two grounded turns without discarded grounding | Passed in the browser lifecycle suite; qualification cases intentionally reset between questions. |

### Loading and response lifecycle

| Measurement | Result |
| --- | --- |
| Cold engine-ready time | `37,198 ms`. |
| Cold model transfer time | `36,599 ms`. |
| Cold corpus fetch time | `9 ms`. |
| Cold index fetch time | `9 ms`. |
| Cold validation and hydration time | `466 ms`. |
| Warm engine-ready time | `37,099 ms`. |
| Warm model transfer time | `36,534 ms`. |
| Warm corpus fetch time | `4 ms`. |
| Warm index fetch time | `3 ms`. |
| Warm validation and hydration time | `514 ms`. |
| First-token latency | Six-case range `518–11,483 ms`; post-fix smoke `1,008–1,140 ms`. |
| Total-response latency | Six-case range `802–23,509 ms`; post-fix smoke `1,013–3,429 ms`. |
| Stop latency and settled state | Passed within the bounded lifecycle assertion; returned to Ready with a visible stopped response. |
| New session reset | Passed between all six cases and during closeout. |
| Unload | Passed after cold activation, during closeout, and in the post-fix smoke. |
| Reload | Fresh activation after unload passed. |
| Route-away cleanup and route re-entry | Contact route-away, Ghost route re-entry, fresh activation, and final unload passed. |
| Visible memory pressure | Non-isolated host; system reported `61%` memory free immediately after qualification. No clean-room memory claim is made. |
| Device-loss events | `0` in the post-fix real-model smoke. |

## Six-case product review

| Case ID | Disposition | Useful-answer | Factual-support | Abstention | Citation-validity | Source-inspectability | Short non-content rationale |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `showcase-claude-native` | Pass | Pass | Pass | N/A | Pass | Pass | Visible review approved; first token `11,483 ms`, total `11,485 ms`. |
| `showcase-rch-claim` | Pass | Pass | Pass | N/A | Pass | Pass | Visible review approved; first token `1,068 ms`, total `3,362 ms`. |
| `ordinary-agent-writing` | Pass | Pass | Pass | N/A | Pass | Pass | Visible review approved; cited a reviewed expected source. Exhaustive document coverage is reserved for the explicit cross-document case; first token `10,680 ms`, total `23,509 ms`. |
| `cross-review-control` | Pass | Pass | Pass | N/A | Pass | Pass | Visible review approved with both expected documents; first token `10,561 ms`, total `17,877 ms`. |
| `unsupported-private-note` | Pass | Pass | Pass | Pass | Pass | N/A | Exact unsupported-answer prefix, no citation; first token `1,042 ms`, total `1,046 ms`. |
| `unsupported-private-schedule` | Pass | Pass | Pass | Pass | Pass | N/A | Exact unsupported-answer prefix, no citation; first token `518 ms`, total `802 ms`. |

## Privacy and lifecycle

| Gate | Result |
| --- | --- |
| Explicit activation before assistant resource requests | Pass in the full qualification and post-fix smoke. |
| Same-origin LiteRT-LM assets only; no SDK-runtime CDN request | Pass. |
| Observed-request privacy allowlist | Pass. The initially rejected request was isolated as Partytown's fixed same-origin sandbox document and admitted only through its exact path, document method/type, and bare 13-digit timestamp shape; the corrected full ledger passed in the real-model smoke. |
| Conversation-derived request data absent | Pass. |
| Every rendered citation resolves to selected evidence | Pass under the category-appropriate machine rule and visible human review. |
| Both unsupported cases abstain | Pass; exact prefix and no citations. |
| Stop, New session, Unload, and reload recovery | Pass. |
| Fresh SDK initialization after unload and route re-entry | Pass. |
| Route-away cleanup | Pass. |
| Repeatable device loss or unrecovered cleanup failure | None observed; post-fix smoke device-loss count `0`. |

## License evidence

The reviewed distribution obligations and residual provenance limitations are recorded in the [Task 12 Jet's Ghost license evidence](./jets-ghost-licenses.md).

## Known limitations and unqualified configurations

- The qualification covers one available Apple Silicon Mac using its installed branded Chrome. Windows, lower-memory systems, mobile devices, other browsers, and other hardware remain unqualified rather than inferred from this run.
- The runtime uses the pinned URL directly. The qualification independently downloads and hashes the complete model artifact once, but Jet's Ghost does not independently hash the bytes LiteRT-LM executes in each visitor's browser.
- LiteRT-LM `0.14.0` implements the global `LiteRtLm.delete()` as a no-op. Jet's Ghost still deletes conversations and engines and clears its SDK singleton, but Unload does not claim immediate reclamation of every WASM allocation or browser-owned GPU resource.
- The ordinary discovery fixture validates at least one reviewed expected source plus no unacceptable source. Only the deliberately cross-document fixture requires every expected document; this keeps human usefulness and claim-level citation review from becoming an accidental exhaustive-retrieval benchmark.
- Final Preview and Production behavior, indexing state, deployment routing, and live smoke results are outside this predeployment qualification record and remain separate release gates.

## Release disposition

**Qualified.** The local candidate may proceed to the Production-only indexing implementation, complete repository verification, exact-SHA noindexed Preview, and the remaining ordered release gates. No Preview, Production, indexing request, tag, or release completion is claimed by this document.

## Post-release follow-ups

**Recorded 2026-07-17; not yet implemented. Profile-grounding target: `2.2.0`.** These are backward-compatible additions and maintenance following the released `2.1.0` product. First-class profile grounding expands the assistant's supported questions, so the combined change is a minor release rather than a breaking major release or maintenance-only patch. A confirmed maintenance defect may ship earlier as `2.1.1` if its severity warrants a separate patch. None of these items reopens the retrieval architecture or requires the completed `2.1.0` qualification to be repeated wholesale.

This ledger contains every follow-up Jet raised after the Production deployment plus the confirmed issues found in the subsequent independent audit review. The earlier claim that Jet's Ghost already had a useful persistent model cache remains rejected; `POST-08` records the separately approved application-owned cache prompted by measured cold and warm transfers. Rejected extraction findings are not backlog items. Only confirmed repository or Production evidence, an explicit product decision, or a clearly identified report awaiting reproduction appears below.

The shared end-state standard is an intentional current tree. A contributor inheriting the repository should be able to infer the present architecture and ownership from active production code, tests, scripts, configuration, and canonical documentation without reconstructing the implementation thread. Names and boundaries describe enduring product roles rather than annotations, agents, task numbers, temporary migrations, or cleanup history; each retained abstraction and support path has a current consumer. Comments and active documentation explain only non-obvious present constraints. Git history and `docs/archive/` preserve how the system arrived there. Dates, versions, and historical names remain in active paths only when they are part of the artifact's real identity or compatibility contract.

### Verified follow-up ledger

| ID | Item | Evidence state |
| --- | --- | --- |
| `POST-01` | Repair public links inside the third-party notice document. | Confirmed. The notice endpoint returns the correct document, but four Markdown links resolve to three `/licenses/LICENSES/...` URLs that return `404`; the public license files exist directly under `/licenses/`. |
| `POST-02` | Give footer navigation one explicit owner. | Confirmed. The primary dock and structured navigation consume `NAV_ITEMS`, while Footer manually repeats a five-link subset and omits the first-class Jet's Ghost route. |
| `POST-03` | Publish the missing `v2.1.0` GitHub Release from the existing tag. | Completed 2026-07-21. The normal [jet-web 2.1.0 GitHub Release](https://github.com/jet-ds/jet-web/releases/tag/v2.1.0) now records the existing `v2.1.0` tag as Latest, with no additional assets. The tag remains at the verified Production commit. |
| `POST-04` | Add canonical About-backed profile grounding. | Confirmed by Production answers and source inspection. The system prompt contains no biography and the eligible corpus loads only Blog and Works. |
| `POST-05` | Correct the confirmed physical-phone layout defects and investigate the post-generation browser crash. | Confirmed on a portrait Xiaomi 14T in Android Chrome. The activation actions collide with the fixed dock, the pre-conversation ready state is cramped, and Chrome sometimes exits to the Android home screen after generation begins. Static evidence establishes the layout failures and a process-level termination symptom, but not the crash cause. The complete contract is recorded under **Physical-mobile production defect**. |
| `POST-06` | Reconcile canonical contributor guidance with the released state. | Confirmed. `AGENTS.md` still describes Production as `2.0.0` and `/chatbot/` as noindexed and excluded from the sitemap, while `2.1.0` is deployed and the route is indexable. |
| `POST-07` | Replace the one-off `2.1.0` qualification ceremony with proportional, boundary-triggered qualification. | Approved post-release direction. Retain durable deterministic and privacy coverage, but remove repeated real-model work and instrumentation that no longer changes a product or release decision. The complete implementation contract is recorded under **Proportional qualification**. |
| `POST-08` | Add one application-owned persistent model cache without time-based expiry. | Approved post-release direction. Use Cache API for the immutable model response, keyed by the pinned model identity; do not add IndexedDB, OPFS, a service worker, TTL metadata, timers, or scheduled cleanup unless qualification establishes a concrete need. The complete contract is recorded under **Persistent model caching**. |
| `POST-09` | Contain the obsolete Core 1.0 screenshot baseline locally and remove it from the tracked remote tree by the next release. | Approved cleanup direction. The fourteen PNGs were useful one-time modernization evidence, but no current script, test, or CI workflow consumes them after the capture utility was retired. The complete contract is recorded under **Core 1.0 screenshot containment**. |
| `POST-10` | Adopt Prettier as the canonical formatter for maintained repository text. | Approved next-release tooling direction. Add a deterministic local and CI formatting gate with Astro support, establish the baseline in one formatting-only commit, and exclude user-owned, generated, binary, archived, and immutable historical material. The complete contract is recorded under **Prettier adoption**. |
| `POST-11` | Adopt ESLint as the canonical repository code linter. | Approved next-release tooling direction. Use a modern flat configuration for TypeScript, Astro, React Hooks, and relevant accessibility correctness; keep formatting under Prettier, require zero warnings, and exclude the same non-maintained material. The complete contract is recorded under **ESLint adoption**. |
| `POST-12` | Audit the entire tracked test surface and its expanded maintenance cost. | Every tracked test, fixture, and support module must earn a durable owner. The thirty-seven heuristic matches identify one risk cluster but do not define the audit scope, prove those files defective, or justify a test-to-source ratio gate. Classify behavioral, deliberate static-contract, brittle implementation, duplicate, and obsolete coverage before simplifying it. The complete contract is recorded under **Test coupling and maintenance surface**. |
| `POST-13` | Profile and optimize the visible mobile Liquid Glass dock for stable `60fps+` presentation without intentional appearance or behavior changes. | Jet reports a site-wide mobile slowdown whenever the full dock is visible and smoothness at or above approximately `60fps` when it is hidden. The effect occurs on static routes independently of Grainient and predates both Grainient and v2. Repository history confirms that the dock was introduced in December 2025 and Grainient in April 2026. The relative performance defect is repeatable user evidence; the exact frame rates and cause remain unmeasured. The complete contract is recorded under **Site-wide mobile dock runtime performance**. |

### Public notice link repair

Keep `/licenses/THIRD_PARTY_NOTICES.md` as the stable complete notice endpoint. Replace its repository-relative `./LICENSES/...` destinations with the actual public license routes under `/licenses/`, and add a production or built-site assertion that follows every local Markdown destination and requires a successful response. The endpoint itself is healthy, so the repair is limited to its broken local destinations.

### Footer navigation ownership

Treat the dock and structured navigation as the primary navigation contract. Remove the independently handwritten Footer route list by deriving it from shared configuration, or define and test an explicitly named footer subset if omission is intentional. Because Jet's Ghost is a first-class route, the default recommendation is to include it rather than preserve an undocumented five-link subset.

### Canonical profile grounding

Production identity questions exposed a real grounding gap. The system prompt knows that Jet's Ghost interprets Jet Sanchez's work, is not Jet, and refers to him in the third person, but it contains no biographical facts. The eligible corpus contains only Blog and Works records, so the published About biography is unavailable to the model. This produced a tautological answer to **Who is Jet?** and no supported answer to **What does Jet do?**

Make About the single canonical profile source. Move its substantive biography and expertise content into one explicitly `published`, assistant-enabled record; render `/about/` from that record; and ingest the same record into the versioned corpus with canonical citation URL `https://jetsanchez.com/about/`. Do not duplicate changing biographical facts in the system prompt. Identity, occupation, Digital Squad role, work, and research questions must return useful third-person answers grounded in and citing About, while unsupported personal claims must still abstain.

### Persistent model caching

The qualification measured essentially identical cold and immediate same-profile warm model transfers: `36,599 ms` and `36,534 ms`. The current LiteRT-LM URL path therefore provides no useful persistent model reuse. Add one application-owned Cache API entry for the immutable approximately `2,008,432,640`-byte model response. Use a cache schema plus the exact pinned repository revision and SHA-256 as its identity; application version and elapsed time are not invalidation signals.

Keep the lifecycle deliberately small:

- Retain an exact cached model until its pinned identity changes, the visitor explicitly removes it, the browser evicts it, or site data is cleared.
- Add no fixed TTL, `cachedAt` or `lastUsedAt` policy, expiry timer, scheduled cleanup, or background task. A `48`-hour expiry would only force repeated approximately `2 GB` downloads without improving correctness.
- Keep **Unload** responsible only for conversation, engine, GPU, and memory cleanup. It must not delete the disk cache. Expose model removal as a separate explicit action.
- Preserve the activation boundary: no model request or cache population occurs before the visitor explicitly loads Jet's Ghost.
- Use Cache API directly from the page; do not add IndexedDB, OPFS, or a service worker for the initial implementation. Cache presence under the exact versioned key is the reusable state.
- Do not clone or tee the approximately `2 GB` response to feed LiteRT-LM while caching it. On a miss, complete `cache.put()`, read the committed response back, and pass its `Response.body` to LiteRT-LM. This adds a local-disk read to the cold path but avoids an unbounded slower stream branch.
- Retain the existing storage estimate and safety headroom. Treat storage as best-effort, handle unavailable Cache API, eviction, private browsing, and quota failure explicitly, and use the existing uncached URL stream when preflight shows caching is unavailable. Do not silently perform a second approximately `2 GB` download after a failed cache write; offer an explicit uncached retry.
- Delete obsolete Jet's Ghost model entries when the pinned identity changes. Never run an older cached model as an implicit fallback.

This delivery and storage change triggers `QUAL-04`. Qualify one real cold cache commit and one warm reuse on the supported desktop and reported physical phone, prove the warm activation makes no model-network request, measure cold cache-write plus local-read cost separately from warm engine initialization, and exercise quota failure, interrupted write, eviction, explicit removal, reload survival, and privacy. OPFS earns reconsideration only if this bounded qualification shows that Cache API cannot reliably store or replay the approximately `2 GB` response, or that the sequential cold-path cost is unacceptable. Do not adopt OPFS pre-emptively or reopen retrieval evaluation.

### Core 1.0 screenshot containment

Commit `daa79e42c43d216a581bbf07b00ea2c1a779071f` added fourteen desktop and mobile PNGs under `docs/verification/baselines/core-1.0.0/screenshots/` as the immutable pre-modernization visual comparison baseline. They total `15,358,010` bytes (`14.65 MiB`). Commit `b556e073464707e0c4bcfed25481beb877995d97` later removed the one-time capture utility and its tests while retaining the images as historical evidence. No current executable path consumes them; only the old manifest and completed documentation refer to them. Release tags `v2.0.0` and `v2.1.0` already preserve the original evidence.

Complete this cleanup no later than the next application release:

- If local working copies remain useful, move them beneath `Untracked/` and keep them untracked and outside every release staging allowlist. Do not create a second tracked screenshot archive or attach them as release assets.
- Delete all fourteen PNGs from the tracked current tree and update or remove the associated screenshot paths in `docs/verification/baselines/core-1.0.0/manifest.json` plus any active documentation that still describes the PNG directory as current verification infrastructure.
- Require the release commit and `origin/main` current tree to contain no path beneath `docs/verification/baselines/core-1.0.0/screenshots/`. Verify this directly with `git ls-files` before commit and `git ls-tree` after push.
- Preserve any still-useful compact sanitized metadata only when it has an explicit historical owner and no broken screenshot reference.
- Do not rewrite Git history or move the existing release tags as part of this cleanup. Their historical snapshots may continue to contain the images; removing those remote objects would be a separate destructive operation requiring explicit authorization.

### Prettier adoption

Adopt Prettier in the next release as the canonical mechanical formatter for maintained source, tests, scripts, configuration, and active documentation. It must implement the existing repository conventions rather than establish a competing style system.

Implementation contract:

- Add pinned compatible development dependencies for Prettier and Astro formatting. Evaluate the official Tailwind class-ordering plugin during adoption; include it only if it formats the current Astro, React, and Tailwind 3 code correctly without changing rendered behavior. Class sorting is mechanical consistency, not a replacement for semantic design-token or cascade review.
- Add one checked-in Prettier configuration aligned with `AGENTS.md`: two-space indentation, semicolons, single quotes in TypeScript, double quotes in JSX attributes, LF endings, trailing commas where supported, and preserved Markdown prose wrapping.
- Add a checked-in ignore file that excludes at minimum `Untracked/`, dependencies, Astro/build output, coverage, Playwright reports and results, Vercel state, staged image inputs, binary assets, generated assistant/runtime artifacts, `docs/archive/`, and immutable historical verification evidence. Prettier must never inspect or rewrite user-owned drafts merely because they exist in the workspace.
- Add `format` for explicit writes and `format:check` for read-only verification. Make `format:check` part of `npm run verify`, which places it in pull-request, `main`, manual, and nightly GitHub Actions through the existing workflow. Do not add Husky, lint-staged, editor-specific enforcement, or another formatting daemon unless a later need earns it.
- Apply the initial maintained-tree formatting in one isolated `chore(format)` commit with no product, content, dependency, or design changes beyond the formatter and lockfile. Review the complete diff, run the full repository gate, and visually verify representative Astro and Jet's Ghost pages before treating the baseline as established.
- Update `AGENTS.md` and README command guidance in the same tooling change. Once adopted, contributors run `npm run format` intentionally and CI enforces `npm run format:check`; do not hand-maintain formatting rules that conflict with the checked-in configuration.

### ESLint adoption

The repository currently has no ESLint, Biome, Stylelint, Markdownlint, lint configuration, lint script, or CI lint gate. `astro check` runs against Astro's strict TypeScript configuration, while Vitest, Playwright, and the custom verifiers cover product and repository contracts; none replaces a code-quality linter.

Adopt ESLint after the Prettier baseline in the next release:

- Use ESLint's flat configuration with pinned compatible packages for JavaScript, strict TypeScript, Astro, React Hooks, and relevant JSX/Astro accessibility correctness. Add the Prettier compatibility configuration, but do not run Prettier as an ESLint plugin.
- Keep responsibilities separate: Prettier owns mechanical formatting; ESLint owns correctness and maintainability. Do not enable stylistic lint rules that duplicate or fight the checked-in Prettier configuration.
- Begin with the maintained code surfaces under `src/`, `scripts/`, `tests/`, and maintained root configuration. Use one explicit shared ignore contract for `Untracked/`, dependencies, build and generated output, test artifacts, Vercel state, binary assets, staged image inputs, archived documents, and immutable historical verification evidence.
- Add `lint` and `lint:fix` scripts. Make `lint` fail on any warning and include it in `npm run verify`, thereby enforcing it in pull-request, `main`, manual, and nightly GitHub Actions without adding another workflow.
- Establish the lint baseline in a dedicated `chore(lint)` commit after the formatting-only commit. Review every initial finding; fix genuine issues, keep automatic fixes mechanical, and do not use broad disables or reduce rule severity merely to make the gate pass. Any necessary suppression must be narrow and explain the external or architectural boundary that requires it.
- Update `AGENTS.md` and README with the commands and ownership boundary. Do not add Husky, lint-staged, Stylelint, Markdownlint, Biome, editor-specific enforcement, or another lint daemon unless a demonstrated gap later earns it.
- Run the full repository gate and representative browser verification after adoption. Lint-only refactoring must not alter rendered design, routing, content eligibility, assistant behavior, or browser lifecycle contracts.

### Test coupling and maintenance surface

The reported headline is reproducible against tracked `v2.1.0` files, with important qualifications:

- There are `60` tracked TypeScript or TSX files under `tests/`, totaling `17,772` lines. Fifty-six use a `.test.*` or `.spec.*` filename; the other four are test fixtures or support modules.
- `19` named test files read repository source or configuration with `readFile` or `readFileSync`; `29` use a literal `toContain()` or `toMatch()` assertion. Their overlap produces the reported `37` named test files. This is a discovery heuristic, not a finding that every matched file is implementation-coupled: the literal assertions also include valid public copy, generated artifact, metadata, and response-contract checks.
- At current committed baseline `ad3be6e4fb9e7e75ffb65ff11e41185fa4c28a76`, the complete tracked `tests/` tree contains `62` files and `18,081` lines: `57` named `.test`/`.spec` files plus five fixture, setup, manual-support, or deployment-support files. This complete set, not only the source-reading or literal-assertion subset, is the `POST-12` audit inventory.
- Maintained production files under `src/` total `12,946` lines, so the tracked test tree is currently approximately `1.37` times that line count. This comparison excludes scripts and configuration from the production side and therefore describes coordination surface rather than product quality.
- From the approved pre-modernization commit `c0d158c2f1ba73c879890fd2a8269f633d1f2d04` to `v2.1.0`, tracked Markdown and MDX grew from `17` to `35` files, from `12,819` to `23,752` lines, and from `400,877` to `1,042,410` bytes. File count slightly more than doubled and lines grew by approximately `85%`; much of the total is archived or completed historical material rather than active instruction.
- Four tracked suites are named after the browser-review mechanism rather than a durable product boundary: `tests/e2e/annotation-card-system.spec.ts`, `tests/e2e/annotation-consistency.spec.ts`, `tests/unit/annotationCardSystem.test.ts`, and `tests/unit/annotationConsistency.test.ts`. The residue also reaches `describe('annotation 2 shared card system')`, an `annotation-card-system-no-transitions` helper ID, and the Jet's Ghost test title `ready prompt stays on one line at the annotated mobile width`. The underlying card, action, link, copy, contrast, and responsive contracts may be legitimate; their review-session provenance is not a maintainable test taxonomy.
- The earlier residue cleanup was real but narrower than a suite cleanup. Commit `b556e073464707e0c4bcfed25481beb877995d97` reduced named `.test`/`.spec` files from `58` and `18,925` lines to `53` and `16,751` lines by deleting five obsolete archive, containment, baseline-capture, and Preview-toolbar suites. It simultaneously retained and edited both annotation-named E2E suites instead of classifying their ownership or challenging their taxonomy. The consolidation record grouped browser, accessibility, lifecycle, and deployment coverage as intentional permanent infrastructure without auditing each retained suite. That cleanup therefore does not close `POST-12`.

Review this before establishing the Prettier and ESLint baselines so tooling does not churn files that should be removed. Do not optimize for a test-to-source ratio, documentation count, or target number of source-string assertions. Instead:

**Contract-Coupling Principle:** Every test must derive its assertions from an observable, durable contract at the narrowest appropriate boundary. For components, this includes public APIs, rendered semantics, interaction, accessibility, and explicitly standardized visual behavior. For modules, scripts, builds, CI, and security controls, it includes declared inputs, outputs, failure modes, generated artifacts, and invariants. Private helpers, source layout, call graphs, intermediate representations, CSS classes, and implementation choices are not valid test targets unless explicitly designated as compatibility or artifact contracts. A behavior-preserving refactor should not ordinarily break a test. Apply this principle through audit, review, and contributor guidance; do not add a meta-test that attempts to enforce it.

- Inventory every tracked file under `tests/` and every coherent describe or scenario block, not only the thirty-seven heuristic matches. Classify test coverage as behavioral, deliberate static/build/security contract, implementation-coupled, duplicate, or obsolete release machinery; separately classify fixtures and support modules by their real consumer and lifecycle.
- Keep the audit itself non-executable. Do not add tests, scripts, snapshots, CI gates, or compatibility aliases that assert test filenames, suite counts, line counts, ratios, classification labels, the absence of annotation-named files, or completion of the cleanup checklist. Use a temporary local inventory plus the existing verification commands; record only the concise final dispositions and before/after evidence needed to explain the result.
- Remove annotation provenance from permanent test names and organization. Split or rehome retained coverage under the durable behavior it protects, such as card geometry, action semantics, inline-link behavior, contrast, copy policy, or responsive chat layout; rename helpers accordingly. Do not preserve compatibility aliases for the annotation-named files, and do not treat a rename alone as sufficient when an assertion still freezes incidental source structure.
- Preserve source and artifact inspection where the text itself is the product boundary, including CI configuration, production-artifact exclusion, generated metadata, legal copy, content eligibility, and other contracts that cannot be observed more directly at comparable cost. Prefer built output or public behavior when it proves the same boundary more faithfully.
- Keep exact copy assertions only for approved product, legal, accessibility, protocol, or abstention language. Keep CSS-class or source-expression assertions only when that token or expression is itself a documented contract. Otherwise replace them with semantic DOM, accessibility, state, generated-output, or focused browser behavior.
- Add or replace coverage during cleanup only when the audit exposes a current product, accessibility, privacy, security, publication, routing, or release boundary that is otherwise unprotected and the proposed test is the most direct durable proof. Remove or supersede the weaker test in the same change where applicable. Any net increase must be justified by that independently valuable boundary, never by a desire to prove the cleanup was performed.
- Remove obsolete, duplicate, and implementation-only assertions rather than mechanically updating their expected strings after a refactor. Do not weaken privacy, publication, licensing, routing, citation, local-runtime, or fake-runtime exclusion guarantees in the name of reducing line count.
- Classify documentation as active authority, maintained reference, completed evidence, archive, or removable residue. Archive or delete inactive material according to the existing documentation policy, repair canonical links, and ensure `AGENTS.md` names only current authorities.
- Document the resulting test taxonomy and ownership in `AGENTS.md`, including when source inspection is justified. Future failures must be interpreted according to that ownership rather than automatically fixed by restoring an internal expression.
- Record before-and-after counts as audit evidence only. Success means a smaller and clearer coordination surface with every retained file protecting an explicit current boundary, not an arbitrary numerical threshold.

### Proportional qualification

Qualification follows the boundary changed. The complete implementation contract is:

| ID | Decision | Required state |
| --- | --- | --- |
| `QUAL-01` | Keep routine and nightly CI deterministic and lightweight. | Retain unit, build, documentation, content-policy, production-artifact, and fake-runtime browser coverage. The fake runtime remains intentional test infrastructure but must remain absent from Production artifacts. Do not download the approximately 2 GB model in routine or nightly CI. |
| `QUAL-02` | Keep deployment verification focused on deployed contracts. | Verify routes, redirects, SEO, schema, sitemap/robots, corpus and LiteRT assets, production fake-runtime exclusion, privacy invariants, and model-delivery transport containment. A deployment alone does not trigger a full model download or independent model hash. |
| `QUAL-03` | Trigger one real-model product qualification only when the assistant boundary materially changes. | Profile, eligible corpus, retrieval, prompt, citation, model, or runtime changes receive one opt-in run against one production-equivalent candidate. Do not duplicate the same real-model exercise on both Preview and Production when the tested bytes and boundary are unchanged. |
| `QUAL-04` | Reserve full systems qualification for systems changes. | Model bytes or revision, LiteRT, delivery, GPU/memory lifecycle, cancellation/recovery, or supported-device changes receive the appropriate cold/warm load, complete delivery-integrity, lifecycle recovery, and relevant real-device checks. Unchanged model bytes are not downloaded and independently hashed again merely because another version or deployment exists. |
| `QUAL-05` | Make the `2.2.0` run visitor-centered rather than benchmark-centered. | Load the real model once and reset between **Who is Jet?**, **What does Jet do?**, one work or research question, and one unsupported private question. Judge useful factual grounding, third-person identity, abstention, inline citations, and `/about/` source resolution. Do not add another retrieval harness or reopen the settled rank-and-pack architecture. |
| `QUAL-06` | Retire ceremony that no longer changes a release decision. | Remove the mandatory paired Preview/Production real-model smokes, interactive `page.pause()` review, repeated approximately 2 GB downloads without a changed boundary, and request-ledger policing of provider-owned browser or extension traffic. Do not preserve instrumentation solely because it was needed to qualify `2.1.0`. |
| `QUAL-07` | Preserve the privacy and evidence that still matter. | Continue proving that application-owned requests do not leak prompts or conversation-derived data, that model delivery stays on reviewed trusted origins, that the explicit activation boundary holds, and that evidence contains no conversation content or secrets. Provider-owned browser UI traffic is not an application privacy failure. |
| `QUAL-08` | Interpret measurements honestly. | The available Mac is not an isolated benchmark host. Record observed compatibility, loading, memory pressure, latency, cancellation, and recovery without turning noisy timing measurements or provisional evaluation thresholds into permanent architecture requirements. Product usefulness outranks benchmark optimization. |
| `QUAL-09` | Remove superseded qualification machinery when the new policy is implemented. | Simplify or remove obsolete manual modes, scripts, request-ledger branches, and documentation assertions; retain only intentional reusable verification infrastructure. Archive completed implementation plans, update `AGENTS.md`, README, package scripts, and active verification guidance, and ensure no active document still mandates the retired ceremony. |

### Remote release record

This record described the release inconsistency at the time the `2.2.0` plan was approved. It was repaired on 2026-07-21: the normal [jet-web 2.1.0 GitHub Release](https://github.com/jet-ds/jet-web/releases/tag/v2.1.0) was created from the existing annotated tag, marked Latest, and published without qualification bundles, checksums, screenshots, binaries, or other assets. The tag remains at the verified Production commit; the release-record operation neither changed the deployed commit nor triggered an application build.

### Canonical contributor guidance

Update `AGENTS.md` to describe the released `2.1.0` state rather than the completed integration gate: `/chatbot/` is the canonical indexed route, is present in the sitemap, and no longer carries the pre-release noindex condition. Preserve the still-current runtime, retrieval, activation, privacy, routing, and qualification boundaries. Archived plans remain historical evidence rather than active release instructions.

### Physical-mobile production defect

A physical-phone review on `2026-07-18` established the affected device as a Xiaomi 14T running Android Chrome in portrait orientation. Five user-provided full-resolution `1220 × 2712` screenshots cover idle, consent-ready, loading, pre-conversation ready, and responding states. A later USB-debugging baseline confirmed Android 16, Chrome `150.0.7871.128`, physical density `520`, a current `60 Hz` presentation mode, and a `375` CSS-pixel page width at the observed browser scale. Available viewport height remains state-dependent under browser chrome and the software keyboard and must be captured alongside each future state rather than inferred from the screenshot pixels or recorded as one device constant.

| Screenshot | State | Evidence and health |
| --- | --- | --- |
| `1` | Not running | Confirmed defect: the **Check compatibility** action is beneath the fixed Liquid Glass dock; only its top edge remains visible. The primary next action is obstructed. |
| `2` | Load ready | Confirmed defect: the **Load Jet's Ghost · about 2 GB** action is beneath the fixed dock. The readiness message remains visible, but the consent action is obstructed. |
| `3` | Loading | The loading hierarchy and **Cancel and reload** action are visibly clear of the dock in this static frame. This image does not establish runtime stability. |
| `4` | Ready before first message | Confirmed defect: three vertically stacked starter prompts overfill the available conversation region; the third prompt is clipped behind the reliability/composer area, and the reliability disclosure wraps to two lines, leaving the primary typing surface visually cramped. |
| `5` | Responding | The submitted turn, thinking state, composer, and dock are visibly separated in this frame. After reaching this state, Chrome sometimes disappears and Android returns to the home screen. That rules out a merely visible in-tab error or reload, but the screenshot precedes the failure and cannot distinguish an Android process kill, Chrome application crash, or a GPU/runtime failure that terminates the application. |

The repository explains both visible layout failures. The dock is fixed at the bottom of the viewport, while activation content reserves extra dock clearance only at widths below `370px`; the Xiaomi layout falls outside that narrow rule. The ready state then attempts to fit the animated identity, heading, helper, three minimum-height starter buttons, reliability copy, composer, metadata, and fixed dock into one mobile viewport. Its starter region scrolls separately above the composer, so excess content can disappear behind the lower interface. Existing emulated coverage checks dock width, selected response/composer separation, and a taller `430 × 932` viewport, but does not assert that activation actions clear the dock or that the complete pre-conversation stack remains usable at the physical phone's actual CSS visual viewport.

Approved `2.2.0` layout direction:

- Fix dock clearance structurally across the complete mobile activation flow. Define one shared mobile dock/safe-area clearance and apply it to every internally scrolling immersive state; do not rely on the current below-`370px` exception or on removing starter prompts to conceal the activation collision.
- Remove the three starter-prompt buttons from small mobile layouts. They are optional discovery aids, while direct composition is the core task. Preserve them on tablet and desktop where they fit without displacing the composer. Do not replace them with a carousel, horizontally scrolling chips, or another mobile-only interaction.
- Keep the full approved reliability disclosure immediately above the composer and remove it after the first submitted message: **Jet’s Ghost can make mistakes. Check cited sources.** Move it from the current Utopia `text-sm` token to the established `text-xs` tertiary/meta token on every viewport rather than introducing alternate mobile copy. The normal Xiaomi 14T presentation should occupy one line, while zoom, enlarged text, localization, and constrained viewports must still be allowed to wrap naturally. Do not reduce it below `text-xs` or tighten its tracking merely to force one line.
- Keep the composer and dock in their approved visual forms. Give the pre-conversation content an honest remaining-height region with safe start alignment and in-flow lower clearance so content never sits behind either fixed surface.

Treat the intermittent return to the Android home screen as a separate runtime defect rather than a consequence of the cramped layout. It is a process-level termination symptom, not an in-page error state. Passing the current compatibility probe proves only that Chrome exposes WebGPU and an adapter; it does not prove that the device can sustain the approximately `2 GB` model plus LiteRT-LM, WASM, GPU, KV-cache, and generation allocations. Model disk caching will not reduce that active memory pressure. The initial device probe found approximately `11.6 GB` total memory with approximately `3.8 GB` available and retained historical Chrome low-memory exits, but no retained entry correlated to the reported Jet's Ghost event. Memory pressure is therefore a credible hypothesis, not an established cause. Capture a fresh bounded ADB and Chrome evidence window before the next real-model attempt to distinguish an Android process kill, Chrome application crash, or GPU/runtime failure before choosing recovery, mobile qualification, or an explicit support restriction. Do not repeatedly crash the device merely to produce a benchmark.

This remains an open production defect included in `2.2.0`. The correction must be verified on the same Xiaomi 14T in each of the five states, including the exact available CSS/visual viewport with Chrome controls visible, plus focused automated coverage proving activation-action/dock separation, mobile starter-prompt omission, normal-layout one-line full reliability disclosure at `text-xs`, safe wrapping under accessibility enlargement, ready-state composer clearance, and no horizontal overflow. A successful fake-runtime layout test cannot close the crash finding; that requires one bounded real-model physical-phone run after the minimum failure evidence has been captured.

### Site-wide mobile dock runtime performance

Jet reports that mobile presentation falls below the desired smoothness whenever the full Liquid Glass dock is visible on every route, including static routes, while hiding the dock returns the experience to at least approximately `60fps` by observation. The behavior predates Grainient and v2. Git history supports that separation: the Liquid Glass dock entered the site in commit `4fac61c771ca835a8407ac4a15f1c0fc8eb75a27` on `2025-12-19`; the transform-based mobile optimization followed in `1d0d93f0616e02d955dc35cbc239f26a1ea27347` on `2026-01-09`; and Grainient was not introduced until `835b0af88bdf3f574949dd3493ce9aba40324f0f` on `2026-04-11`. Treat this as pre-existing site-wide performance debt, not a Jet's Ghost, Grainient, or `2.1.0` regression.

The current implementation provides a strong hypothesis but not proof. The visible mobile state paints one large `GlassSurface` using a Chromium SVG displacement `backdrop-filter`, saturation, and multiple inset and outer shadows. After the disclosure control has been discovered, its separate `GlassSurface` may remain visible alongside the main dock. Hiding the dock moves and fades the large filtered surface offscreen while retaining only the much smaller disclosure control. The January optimization moved transitions to transform and opacity work but did not establish steady-state filtered-compositing cost with a real trace. Grainient is already capped independently at `24fps` and cannot explain the same defect on static routes.

Use the Xiaomi 14T as the first real-device qualification target through a data-capable USB-C connection and Chrome remote debugging. Record its Android and Chrome versions, display refresh setting, CSS and visual viewport, theme, route, dock state, and thermal state. On one static route, compare identical idle, scroll, dock-open, dock-close, and post-transition intervals with the full dock visible and hidden. Repeat only the decisive comparison on Home to confirm that Grainient does not change the disposition. Capture Chrome's frame track, dropped and partially presented frames, main-thread work, paint/composite activity, layer behavior, and memory; use paint flashing or advanced paint instrumentation only as a separate diagnostic because instrumentation itself can perturb performance.

The first optimization pass must preserve the dock's current appearance and behavior: glass distortion, translucency, shadows, geometry, icons, theme response, toggle motion, discovery and persistence behavior, navigation, focus, reduced motion, and accessibility semantics. Start with implementation-only changes to filtered-area lifecycle, layer ownership, duplicate filtered work, and repaint scope that the trace proves material. Do not change Grainient, weaken the glass recipe, replace it with an opaque or static approximation, reduce motion, or add device-based quality switching merely to produce a higher number. If the SVG backdrop effect itself prevents sustained `60fps+` on the target device, stop and present the measured visual-performance trade-off for an explicit product decision rather than concealing a downgrade.

Success is sustained presentation at or above `60fps` on the Xiaomi 14T during the representative visible-dock interaction, with no material regression when hidden and no intentional visual or behavioral difference in side-by-side light/dark review. This is a bounded real-device performance check, not a universal claim for every mobile device and not a new heavyweight routine-CI benchmark. Retain ordinary functional and accessibility regression coverage; keep traces and temporary instrumentation local unless a compact durable artifact has a continuing owner.
