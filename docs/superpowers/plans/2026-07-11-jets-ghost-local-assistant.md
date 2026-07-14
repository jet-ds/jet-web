# Jet's Ghost Local Assistant Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the retired hosted chatbot with an explicitly activated, local-first Gemma 4 E2B assistant grounded through deterministic MiniSearch rank-and-pack over versioned published site content.

**Architecture:** Astro generates an immutable same-origin corpus and a version-matched serialized MiniSearch index from validated content. One deterministic pipeline ranks every lexical match, expands heading-local context, and packs cited sources to the actual serialized token budget; when the corpus fits, that same pipeline includes it all. The approved `JetsGhostExperience` prototype remains the interface composition at semantic route `/chatbot`, with every emitted canonical identity using `https://jetsanchez.com/chatbot/`; a dynamically imported LiteRT-LM runtime and production state hook replace only its timers and canned data while prompts and responses remain in memory and never leave the browser.

**Tech Stack:** Astro 5, React 19, TypeScript 5.9, `@litert-lm/core@0.14.0`, `minisearch@7.2.0`, `stemmer@2.0.1`, Gemma 4 E2B Web, unified/remark MDX parsing, Vitest, Playwright, WebGPU.

**Interface source of truth:** `docs/jets-ghost-chat-experience.md` and commit `d406ed46dfc7cccfa95d0003fcae30f5b9373690`.

## Global Constraints

- Begin only after the core modernization completion gate passes in production.
- Treat `/Users/jet/jet-web-v1-modernization` as temporary implementation isolation only. `/Users/jet/jet-web` is the canonical repository and must be the sole durable Jet Web folder after Task 13 consolidation succeeds.
- Preserve every user-owned draft without making any test, fixture, build assertion, or qualification case depend on a draft's existence, filename, route, or current publication status. Use synthetic draft fixtures and generic inclusion-policy assertions.
- Integrate the approved interface prototype; do not redesign its layout, copy, responsive behavior, animation language, or color roles.
- Serve the qualification/release document at `/chatbot/` with canonical URL `https://jetsanchez.com/chatbot/`; require platform `308` normalization from `/chatbot` to `/chatbot/` and from `/tools/chatbot` to `/tools/chatbot/`, plus one explicit permanent `308` from `/tools/chatbot/` to `/chatbot/`.
- Replace Tools with one dedicated Ghost item in dock, structured, and no-script navigation; do not add a mobile item.
- Keep `/tools/` dormant, noindexed, out of the sitemap, and out of primary navigation until it contains multiple standalone tools. `/tools` normalizes once to `/tools/`; unrelated `/toolshed/` remains unaffected.
- Keep the custom React interface; do not add `assistant-ui` in 2.1.0.
- Use only Gemma 4 E2B in the first release; expose no model picker.
- Pin `@litert-lm/core` to `0.14.0` and the model to the approved Hugging Face revision and SHA-256.
- During qualification, independently download the complete model artifact and verify its actual byte count and SHA-256; provider metadata is never a substitute for hashing bytes.
- Do not claim per-browser runtime SHA-256 verification: although LiteRT-LM `0.14.0` accepts URL, `Blob`, and `ReadableStream<Uint8Array>` model sources, this release deliberately uses the pinned URL and does not add an app-owned incremental hash/buffering lifecycle.
- Emit LiteRT-LM's pinned packaged WASM variants at one versioned same-origin path and call `loadLiteRtLm()` with that path only after consent; never use the SDK's default jsDelivr origin.
- Runtime delivery must start at the exact pinned URL, remain HTTPS on correctly bounded trusted origins within five redirects, use bodyless ordinary requests, and transmit no application or conversation data.
- Route navigation renders UI only. Compatibility checking probes support only. The explicit “Load Jet's Ghost” action alone authorizes LiteRT import, corpus/index/model requests, engine creation, and GPU allocation.
- Do not assemble a prompt until the visitor sends a message.
- Do not provide server inference, OpenRouter fallback, tool calling, or multimodal input.
- Include content only when `status === 'published' && assistant === true`.
- Keep the corpus and serialized MiniSearch index deterministic, version-matched, same-origin, and free of remote build writes.
- Use one production retrieval pattern: MiniSearch rank, heading-local expansion, token-budget pack.
- Search without a result limit and do not add a top-K, candidate-count, or per-document cap.
- Treat complete-corpus inclusion as a budget outcome of that pipeline, never as another selector or release mode.
- Keep the same architecture through 1–2 million eligible corpus tokens.
- Do not add custom IndexedDB, an embedding model, a reranker, a retrieval worker, cosine search, RRF, PGlite, pgvector, or EntityDB.
- Do not add another retrieval harness, candidate comparison, generated holdout, or aggregate benchmark gate.
- Run one six-case real-model qualification on the available Apple Silicon Mac in installed branded Chrome; unowned hardware is not a release blocker.
- Use one supported and one unsupported case for each exact-Preview and Production smoke; do not repeat the full acceptance set after local qualification.
- Keep qualification evidence concise and human-readable; do not add review overlays, device runners, qualification archives, GitHub Release certification, or evidence-checksum ceremony.
- Enforce context budgets before calling the model; never rely on silent model truncation.
- Pass the 1,024-token response reserve to LiteRT-LM as `sessionConfig.maxOutputTokens` on every grounded conversation.
- Keep prompts, selected context, history, and responses out of network requests, storage, and analytics.
- Delete the active LiteRT conversation before replacement and before deleting the engine; on final unload or route-away, call `unloadLiteRtLm()` after engine deletion and clear application references.
- Do not claim that Unload forces immediate WASM/GPU-memory reclamation: LiteRT-LM `0.14.0` clears its singleton but its current global `delete()` implementation is a no-op.
- Use Conventional Commits 1.0.0 without agent attribution.
- Release Jet's Ghost as backward-compatible feature version `2.1.0` on the modernized `2.0.0` core only after real-model qualification.

---

## File Structure

```text
src/features/jets-ghost/
├── config.ts
├── errors.ts
├── corpus/
│   ├── types.ts
│   ├── normalize.ts
│   ├── segment.ts
│   ├── build.ts
│   └── repository.ts
├── selection/
│   ├── types.ts
│   ├── searchIndex.ts
│   └── rankAndPack.ts
├── sourcePayload.ts
├── prompt/
│   ├── assemble.ts
│   └── citations.ts
├── runtime/
│   ├── types.ts
│   ├── capabilities.ts
│   ├── lifecycle.ts
│   ├── modelDelivery.ts
│   ├── liteRtAssets.server.ts
│   ├── liteRtGemma.ts
│   └── fakeRuntime.ts
├── state/
│   ├── types.ts
│   └── useJetsGhost.ts
├── experience.ts
└── JetsGhostExperience.tsx

src/pages/assistant/corpus/manifest.json.ts
src/pages/assistant/corpus/content.json.ts
src/pages/assistant/corpus/index.json.ts
src/pages/assistant/runtime/litert-lm/0.14.0/[asset].ts
src/pages/chatbot.astro
src/pages/tools/index.astro
src/config/site.ts
astro.config.mjs
vercel.json
tests/jets-ghost-experience.test.ts
tests/unit/jets-ghost/
tests/e2e/jets-ghost.spec.ts
playwright.real-model.config.ts
tests/manual/jets-ghost-real-model.spec.ts
tests/fixtures/jets-ghost/product-acceptance.json
tests/unit/jets-ghost/productAcceptance.test.ts
docs/verification/jets-ghost-licenses.md
docs/verification/jets-ghost-2.1.0.md
scripts/verify-model-delivery.ts
```

---

### Task 1: Pin the local model and context profile

**Files:**
- Create: `src/features/jets-ghost/config.ts`
- Create: `src/features/jets-ghost/runtime/modelDelivery.ts`
- Create: `src/features/jets-ghost/runtime/liteRtAssets.server.ts`
- Create: `src/pages/assistant/runtime/litert-lm/0.14.0/[asset].ts`
- Create: `scripts/verify-model-delivery.ts`
- Create: `tests/unit/jets-ghost/config.test.ts`
- Create: `tests/unit/jets-ghost/modelDelivery.test.ts`
- Create: `tests/unit/jets-ghost/liteRtAssets.test.ts`
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `tsconfig.json`
- Modify: `vercel.json`

**Interfaces:**
- Produces: `JETS_GHOST_MODEL`, `JETS_GHOST_CONTEXT`, `JETS_GHOST_PATHS`, and the versioned same-origin LiteRT WASM subtree.
- Consumes: model revision `9262660a1676eed6d0c477ab1a86344430854664`.

- [ ] **Step 1: Install pinned runtime and parsing dependencies**

Run:

```bash
npm install --save-exact @litert-lm/core@0.14.0 minisearch@7.2.0 stemmer@2.0.1 unified@11.0.5 remark-parse@11.0.0 remark-mdx@3.1.1 remark-gfm@4.0.1 mdast-util-to-string@4.0.0
npm install --save-dev --save-exact @types/mdast@4.0.4 @webgpu/types@0.1.71 cross-env@10.1.0
```

Add `@webgpu/types` to `compilerOptions.types` in `tsconfig.json` while retaining Astro's generated types.

- [ ] **Step 2: Write the failing configuration test**

Create `tests/unit/jets-ghost/config.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  JETS_GHOST_CONTEXT,
  JETS_GHOST_MODEL,
  JETS_GHOST_PATHS,
} from '../../../src/features/jets-ghost/config';

describe("Jet's Ghost configuration", () => {
  it('pins the approved E2B web artifact', () => {
    expect(JETS_GHOST_MODEL.packageVersion).toBe('0.14.0');
    expect(JETS_GHOST_MODEL.url).toContain('9262660a1676eed6d0c477ab1a86344430854664');
    expect(JETS_GHOST_MODEL.bytes).toBe(2_008_432_640);
    expect(JETS_GHOST_MODEL.sha256).toBe('3a08e8d94e23b814ae5414469c370c503813949acb8ceaa17e4ebf8a35af35b5');
    expect(JETS_GHOST_MODEL.maxRedirects).toBe(5);
    expect(JETS_GHOST_MODEL.trustedOrigins).toEqual([
      { hostname: 'huggingface.co', allowSubdomains: false },
      { hostname: 'cdn.hf.co', allowSubdomains: true },
      { hostname: 'xethub.hf.co', allowSubdomains: true },
    ]);
  });

  it('reserves context headroom', () => {
    expect(JETS_GHOST_CONTEXT.knowledgeLimit).toBe(9_011);
    expect(JETS_GHOST_CONTEXT.maxContextTokens).toBe(16_384);
    expect(Object.entries(JETS_GHOST_CONTEXT)
      .filter(([key]) => key !== 'maxContextTokens')
      .reduce((sum, [, value]) => sum + value, 0)).toBe(16_384);
  });

  it('uses same-origin corpus paths', () => {
    expect(JETS_GHOST_PATHS).toEqual({
      manifest: '/assistant/corpus/manifest.json',
      content: '/assistant/corpus/content.json',
      index: '/assistant/corpus/index.json',
      liteRtWasm: '/assistant/runtime/litert-lm/0.14.0/',
    });
  });
});
```

- [ ] **Step 3: Implement immutable configuration**

Create `src/features/jets-ghost/config.ts`:

```ts
export const JETS_GHOST_MODEL = {
  packageVersion: '0.14.0',
  repositoryRevision: '9262660a1676eed6d0c477ab1a86344430854664',
  filename: 'gemma-4-E2B-it-web.litertlm',
  url: 'https://huggingface.co/litert-community/gemma-4-E2B-it-litert-lm/resolve/9262660a1676eed6d0c477ab1a86344430854664/gemma-4-E2B-it-web.litertlm',
  bytes: 2_008_432_640,
  sha256: '3a08e8d94e23b814ae5414469c370c503813949acb8ceaa17e4ebf8a35af35b5',
  maxRedirects: 5,
  trustedOrigins: [
    { hostname: 'huggingface.co', allowSubdomains: false },
    { hostname: 'cdn.hf.co', allowSubdomains: true },
    { hostname: 'xethub.hf.co', allowSubdomains: true },
  ],
} as const;

export const JETS_GHOST_CONTEXT = {
  maxContextTokens: 16_384,
  systemLimit: 640,
  questionLimit: 384,
  conversationLimit: 2_048,
  responseReserve: 1_024,
  knowledgeLimit: 9_011,
  estimatorHeadroom: 3_277,
} as const;

export const JETS_GHOST_PATHS = {
  manifest: '/assistant/corpus/manifest.json',
  content: '/assistant/corpus/content.json',
  index: '/assistant/corpus/index.json',
  liteRtWasm: '/assistant/runtime/litert-lm/0.14.0/',
} as const;
```

- [ ] **Step 4: Emit the pinned LiteRT WASM package at a versioned same-origin path**

Write `tests/unit/jets-ghost/liteRtAssets.test.ts` before `runtime/liteRtAssets.server.ts` and the static endpoint. The server-only helper resolves `@litert-lm/core/package.json` through the package's public export, requires version `0.14.0`, and exposes exactly the four package-provided `.js`/`.wasm` feature pairs:

```text
litertlm_wasm_internal.js
litertlm_wasm_internal.wasm
litertlm_wasm_asyncify_internal.js
litertlm_wasm_asyncify_internal.wasm
litertlm_wasm_compat_internal.js
litertlm_wasm_compat_internal.wasm
litertlm_wasm_compat_asyncify_internal.js
litertlm_wasm_compat_asyncify_internal.wasm
```

`src/pages/assistant/runtime/litert-lm/0.14.0/[asset].ts` is a prerendered static endpoint whose `getStaticPaths()` emits only that allowlist. It reads each installed package file without rewriting it, returns JavaScript or WebAssembly with the correct content type, rejects any unknown/path-traversal name, and performs no network write. Tests prove the route's emitted bytes match the installed pinned package files exactly and that the runtime directory is `JETS_GHOST_PATHS.liteRtWasm`. The production build must contain all eight files at that exact path. No source asset is copied into the worktree, no generated public directory is left behind, and no SDK runtime request may use jsDelivr.

Astro's static generator preserves the body and extension but does not carry an endpoint's ordinary response headers into deployed static-file metadata. Merge this narrowly scoped rule into the existing core `vercel.json` without replacing its redirect or other configuration:

```json
{
  "headers": [
    {
      "source": "/assistant/runtime/litert-lm/0.14.0/:asset",
      "headers": [
        {
          "key": "Cache-Control",
          "value": "public, max-age=31536000, immutable"
        }
      ]
    }
  ]
}
```

The versioned path makes the immutable policy safe. `liteRtAssets.test.ts` parses `vercel.json` and requires this exact source/value while allowing the file's unrelated redirect configuration. Preview and Production deployment checks later request one emitted `.wasm` file and require the exact cache header; local `astro preview` does not pretend to apply Vercel headers.

- [ ] **Step 5: Implement the durable model-delivery and qualification-hash contract**

Write `tests/unit/jets-ghost/modelDelivery.test.ts` before `runtime/modelDelivery.ts`. Define pure `isTrustedModelOrigin(url, policy)`, `validateModelDeliveryChain(chain, config)`, `verifyModelArtifactStream(stream, expected)`, and `sanitizeModelDeliveryResult(result)` helpers. Tests prove:

- the first URL must equal the pinned revision URL byte-for-byte;
- every hop is HTTPS, uses the default HTTPS port, matches exact `huggingface.co`, exact `cdn.hf.co`, exact `xethub.hf.co`, or a hostname ending in the boundary-safe suffix `.cdn.hf.co` or `.xethub.hf.co`, and stays within `maxRedirects: 5`; Hugging Face now routes Xet-backed large files through provider-owned `*.xethub.hf.co`, and this reviewed amendment adds neither a mirror nor a retry subsystem;
- relative `Location` values are resolved against the current trusted URL before the next hop is validated;
- standard HTTP redirect statuses require a `Location`, and the terminal artifact response must have a successful status; missing locations, redirect loops, and non-success terminal responses fail with rule codes only;
- zero through five redirects are accepted, while a sixth redirect and lookalikes such as `cdn.hf.co.example.com`, `evilcdn.hf.co`, `xethub.hf.co.example.com`, or `evilxethub.hf.co` are rejected;
- provider changes to signed-query key names/values, transient response headers, redirect count within the bound, or final CDN pathname do not affect validation;
- only bodyless ordinary `GET`/`HEAD` requests qualify, including browser-generated `Range` behavior where LiteRT requires it;
- application code supplies no custom headers or credentials to the cross-origin model chain, and observed model requests containing `Authorization`, `Cookie`, `credentials: 'include'`, application-defined headers, prompts, selected context, history, or response sentinels fail;
- unavailable or ambiguous runtime length observations are accepted as `unavailable`, while a value explicitly identified as the complete unencoded artifact byte count must equal the pin; range length, encoded transfer length, cache metadata, and provider-declared linked size are never compared as complete size;
- an injected complete byte stream passes only when the actual counted bytes and independently calculated SHA-256 both equal the pin;
- truncation, extension, or a one-byte mutation fails even when provider metadata claims the pinned size or digest;
- `sanitizeModelDeliveryResult()` retains only mode, initial-URL-match boolean, trusted hostnames, redirect depth, independently counted artifact bytes/digest when available, UTC verification time, and rule codes.

Every validation failure reports only hop index and violated rule code. Tests inject complete signed URLs, signatures, policies, authorization/cookies, raw headers, transient CDN paths, and conversational sentinels and prove none can enter errors or sanitized output.

Create `scripts/verify-model-delivery.ts` with two mutually exclusive explicit modes:

- `--transport-only` uses Node's raw `https` client with bodyless `GET`, manual redirects, no application-defined headers, and the pure trusted-origin/redirect policy, then destroys the final response stream without retaining its body. It proves only pinned URL usage, HTTPS/trusted-origin containment, bounded redirects, and sanitized diagnostics; it makes no artifact-integrity claim and does not require `HEAD` support or transient provider headers.
- `--hash-artifact` uses Node's raw `https` client with bodyless `GET`, manually validates every redirect before following it, streams the complete final response directly through `crypto.createHash('sha256')`, counts actual received bytes, and fails unless both count and digest equal `JETS_GHOST_MODEL`. It does not infer identity from `Content-Length`, `Content-Range`, ETag, repository headers, linked metadata, CDN path, or query structure.

Both modes create the `--output` parent recursively when needed and write only the sanitized projection above. Neither mode prints or persists complete redirected URLs, query values, signatures, policies, authorization data, cookies, raw sensitive headers, or transient paths. A provider delivery change blocks only when it violates the exact initial URL, HTTPS/trusted-origin boundary, redirect limit, request-privacy contract, or qualification-time byte count/SHA-256.

- [ ] **Step 6: Verify and commit**

```bash
npm run test -- tests/unit/jets-ghost/config.test.ts tests/unit/jets-ghost/liteRtAssets.test.ts tests/unit/jets-ghost/modelDelivery.test.ts
npx tsx scripts/verify-model-delivery.ts --transport-only --output=test-results/model-delivery-preflight.json
npm run check
npm run build
test "$(find dist/assistant/runtime/litert-lm/0.14.0 -type f | wc -l | tr -d ' ')" = "8"
git add package.json package-lock.json tsconfig.json vercel.json src/features/jets-ghost/config.ts src/features/jets-ghost/runtime/modelDelivery.ts src/features/jets-ghost/runtime/liteRtAssets.server.ts src/pages/assistant/runtime/litert-lm/0.14.0/'[asset].ts' scripts/verify-model-delivery.ts tests/unit/jets-ghost/config.test.ts tests/unit/jets-ghost/liteRtAssets.test.ts tests/unit/jets-ghost/modelDelivery.test.ts
git commit -m "build(chatbot): pin LiteRT-LM and Gemma E2B"
```

Keep the transport result uncommitted. It proves delivery containment only; the complete 2 GB download and independent SHA-256 verification occur once in Task 13 qualification.

### Task 2: Build normalized knowledge-domain primitives

**Files:**
- Create: `src/features/jets-ghost/corpus/types.ts`
- Create: `src/features/jets-ghost/errors.ts`
- Create: `src/features/jets-ghost/corpus/normalize.ts`
- Create: `src/features/jets-ghost/corpus/segment.ts`
- Create: `tests/unit/jets-ghost/normalize.test.ts`
- Create: `tests/unit/jets-ghost/segment.test.ts`

**Interfaces:**
- Produces: `normalizeMdx()`, `segmentDocument()`, stable document/section/chunk types.
- Consumes: eligible collection entries in Task 3.

- [ ] **Step 1: Define the domain types**

Create `corpus/types.ts` with the interfaces from the approved design and these additional types:

```ts
export type CollectionName = 'blog' | 'works';
export type DocumentId = `${CollectionName}:${string}`;
export type SectionId = `${DocumentId}#${string}`;
export type ChunkId = `${SectionId}:${string}:${number}`;

export interface NormalizedSection {
  heading: string;
  headingPath: string[];
  text: string;
  order: number;
}

export interface CorpusManifest {
  schemaVersion: '1.0.0';
  segmentationVersion: '1.0.0';
  corpusVersion: string;
  sourceCommit: string;
  contentSha256: string;
  indexSha256: string;
  indexConfigVersion: '1.0.0';
  miniSearchVersion: '7.2.0';
  stemmerVersion: '2.0.1';
  indexedChunkCount: number;
  statistics: CorpusStatistics;
}
```

The complete `KnowledgeDocument` type also includes explicit `order`, `sourcePath`, and `sourceHash`; `KnowledgeChunk` includes `sameTextOccurrence` and the full `contentHash`. Do not add a build timestamp.

Create `src/features/jets-ghost/errors.ts` now so rank-and-pack and prompt assembly do not depend on a later runtime task. Export the approved `JetsGhostErrorCode` union, including `corpus-index-mismatch`, `question-too-long`, `conversation-limit-reached`, and `context-budget-exceeded`, plus a typed `JetsGhostError` carrying safe message, recoverability, and non-content diagnostic cause. Runtime Task 6 imports and extends behavior around this shared type rather than redefining it.

- [ ] **Step 2: Write normalization fixtures first**

Create `tests/unit/jets-ghost/normalize.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { normalizeMdx } from '../../../src/features/jets-ghost/corpus/normalize';

describe('MDX normalization', () => {
  it('preserves prose hierarchy while excluding executable syntax', () => {
    const sections = normalizeMdx(`
import Widget from './Widget';

Intro paragraph.

## Install

Run the command.

\`\`\`bash
npm install example
\`\`\`

<Callout title="Important">Read the warning.</Callout>

| Item | Value |
| --- | --- |
| Mode | Local |

<Widget label="decorative"><span>Nested prose survives.</span></Widget>
`);

    expect(sections[0]).toMatchObject({
      heading: 'Introduction',
      headingPath: ['Introduction'],
      text: 'Intro paragraph.',
      order: 0,
    });
    expect(sections[1].text).toContain('```bash\nnpm install example\n```');
    expect(sections[1].text).toContain('Important\n\nRead the warning.');
    expect(sections[1].text).toContain('| Item | Value |');
    expect(sections[1].text).toContain('Nested prose survives.');
    expect(sections[1].text).not.toContain('decorative');
  });
});
```

- [ ] **Step 3: Implement AST-aware normalization**

Create `normalize.ts` using `unified().use(remarkParse).use(remarkMdx).use(remarkGfm).parse(source)`. Implement a deterministic node serializer and:

- skip `mdxjsEsm`, `mdxFlowExpression`, and `mdxTextExpression` nodes;
- traverse ordinary Markdown children inside MDX JSX elements even when the wrapper is unknown;
- define `APPROVED_MDX_COMPONENT_EXTRACTORS` as a deny-by-default map whose entries may retain only explicitly named static string/number props plus normalized children; the fixture registers `Callout` with `title` as its only text prop;
- ignore event/expression/class/decorative props and never evaluate JSX;
- start a new section on headings of depth 2 through 4;
- maintain a heading stack by depth;
- serialize paragraphs, lists, blockquotes, links, inline code, and emphasis deterministically;
- serialize GFM tables with stable cell/row boundaries;
- serialize code as a fenced block including `node.lang` when present;
- join non-empty blocks with two newlines;
- normalize CRLF and runs of more than two blank lines;
- emit `Introduction` before the first qualifying heading.

Export:

```ts
export function normalizeMdx(source: string): NormalizedSection[];
```

- [ ] **Step 4: Write segmentation tests**

Create `tests/unit/jets-ghost/segment.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { segmentDocument } from '../../../src/features/jets-ghost/corpus/segment';

describe('knowledge segmentation', () => {
  it('keeps stable section ids and content-hashed chunk ids', () => {
    const result = segmentDocument({
      documentId: 'blog:example',
      sections: [{ heading: 'Install', headingPath: ['Install'], text: 'Run the installer.', order: 0 }],
    });
    expect(result.sections[0].id).toBe('blog:example#install');
    expect(result.chunks[0].id).toMatch(/^blog:example#install:[a-f0-9]{64}:0$/);
  });

  it('never exceeds the 512-token hard limit', () => {
    const text = Array.from({ length: 600 }, (_, index) => `word${index}`).join(' ');
    const result = segmentDocument({
      documentId: 'blog:large',
      sections: [{ heading: 'Large', headingPath: ['Large'], text, order: 0 }],
    });
    expect(result.chunks.every((chunk) => chunk.estimatedTokens <= 512)).toBe(true);
  });

  it('gives repeated identical chunks distinct deterministic ids', () => {
    const result = segmentDocument(repeatedChunkFixture);
    expect(new Set(result.chunks.map((chunk) => chunk.id)).size).toBe(result.chunks.length);
    expect(result.chunks.map((chunk) => chunk.sameTextOccurrence)).toEqual([0, 1]);
  });

  it('fails closed when the digest provider produces a final id collision', () => {
    expect(() => segmentDocument(collisionFixture, { digest: () => '0'.repeat(64) }))
      .toThrow(/duplicate chunk id/i);
  });
});
```

- [ ] **Step 5: Implement deterministic segmentation**

Create `segment.ts` with:

```ts
export const SEGMENTATION_VERSION = '1.0.0' as const;
export const SEGMENTATION = {
  targetTokens: 256,
  maxTokens: 512,
  overlapTokens: 32,
} as const;

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}
```

Use paragraph/list boundaries, keep code blocks intact when they fit, never cross document boundaries, slugify heading paths, append deterministic ordinals for duplicate paths, and build each chunk ID from the full SHA-256 normalized-text digest plus its same-text occurrence ordinal in the section. Inject the digest function for the collision test, maintain a final-ID set, and fail rather than overwrite on any duplicate.

- [ ] **Step 6: Run and commit**

```bash
npm run test -- tests/unit/jets-ghost/normalize.test.ts tests/unit/jets-ghost/segment.test.ts
npm run check
git add src/features/jets-ghost/errors.ts src/features/jets-ghost/corpus/types.ts src/features/jets-ghost/corpus/normalize.ts src/features/jets-ghost/corpus/segment.ts tests/unit/jets-ghost/normalize.test.ts tests/unit/jets-ghost/segment.test.ts
git commit -m "feat(chatbot): add normalized knowledge primitives"
```

### Task 3: Generate and load the versioned knowledge base

**Files:**
- Create: `src/features/jets-ghost/corpus/build.ts`
- Create: `src/features/jets-ghost/corpus/repository.ts`
- Create: `src/features/jets-ghost/selection/searchIndex.ts`
- Create: `src/pages/assistant/corpus/manifest.json.ts`
- Create: `src/pages/assistant/corpus/content.json.ts`
- Create: `src/pages/assistant/corpus/index.json.ts`
- Create: `tests/unit/jets-ghost/corpusBuild.test.ts`
- Create: `tests/unit/jets-ghost/repository.test.ts`
- Create: `tests/unit/jets-ghost/searchIndex.test.ts`

**Interfaces:**
- Produces: `buildKnowledgeBase()`, `StaticKnowledgeRepository.load()`, `MINISEARCH_OPTIONS`, and a deterministic corpus-bound search artifact.
- Consumes: `isAssistantEligible()`, Astro collection entries, normalizer, segmenter.

- [ ] **Step 1: Write failing package tests**

Create `tests/unit/jets-ghost/corpusBuild.test.ts` with fixtures for one published assistant source, one published non-assistant source, and one draft assistant source. Assert:

```ts
expect(result.content.documents.map((document) => document.id)).toEqual(['blog:included']);
expect(result.manifest.corpusVersion).toMatch(/^[a-f0-9]{64}$/);
expect(buildKnowledgeBase(input, 'abc').manifest.corpusVersion)
  .toBe(buildKnowledgeBase(input, 'abc').manifest.corpusVersion);
```

Also assert that an assistant-enabled draft causes a validation error rather than inclusion.

- [ ] **Step 2: Implement the corpus and deterministic MiniSearch artifact**

Define input independent of Astro internals while retaining the complete applicable validated schema output:

```ts
import type { BlogFrontmatter, WorksFrontmatter } from '../../../schemas/content';

interface AssistantSourceBase {
  slug: string;
  sourcePath: string;
  tracked: boolean;
  body: string;
}

export type AssistantSourceEntry =
  | (AssistantSourceBase & {
      collection: 'blog';
      data: BlogFrontmatter;
    })
  | (AssistantSourceBase & {
      collection: 'works';
      data: WorksFrontmatter;
    });
```

Export:

```ts
export function buildKnowledgeBase(
  entries: AssistantSourceEntry[],
  sourceCommit: string,
): {
  manifest: CorpusManifest;
  content: KnowledgePackage;
  index: SearchIndexArtifact;
};
```

Validate every input before filtering. Fail if an assistant-enabled entry is not published or if any eligible entry is untracked. Sort by collection and slug; assign explicit document order; normalize and segment only eligible entries; propagate `sourcePath`; compute `sourceHash` from the complete canonical `BlogFrontmatter` or `WorksFrontmatter` value plus MDX body without rereading the filesystem; construct canonical URLs from `SITE.siteUrl`; and fail on duplicate document, section, chunk, or canonical URL identities. Do not project `data` into a smaller common subset before hashing: nested images/links and type-specific fields such as `type`, `featured`, `venue`, `abstract`, `technologies`, `repository`, and `demo` are hash inputs whenever the validated schema contains them.

Implement one recursive canonical serializer that converts every `Date` to an ISO-8601 string, sorts every object key lexicographically, preserves validated array order, uses normalized UTF-8 JSON without whitespace, and rejects other non-JSON values. Export a pure `computeSourceHash(data, body)` helper so the full metadata contract can be tested independently of eligibility filtering. Calculate `corpusVersion` from exactly schema version, segmentation version, documents, sections, and chunks; exclude `sourceCommit`, statistics, and delivery metadata. Then serialize the complete content payload and calculate `contentSha256` from those exact bytes.

In `selection/searchIndex.ts`, export `INDEX_CONFIG_VERSION = '1.0.0'`, `MINISEARCH_VERSION = '7.2.0'`, `STEMMER_VERSION = '2.0.1'`, the fixed stop-word set, `MINISEARCH_OPTIONS`, `buildSearchIndexArtifact(content)`, and `loadSearchIndex(artifact)`. Build one search document per chunk with `id`, title, description, space-joined tags, heading, and `body` text. Insert documents in canonical chunk order. Use the already-evaluated lexical configuration:

```ts
import type { Options } from 'minisearch';
import { stemmer } from 'stemmer';

export const STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'does', 'for', 'from',
  'how', 'in', 'into', 'is', 'it', 'its', 'of', 'on', 'or', 'that', 'the',
  'their', 'this', 'to', 'what', 'when', 'where', 'which', 'why', 'with',
]);

export const MINISEARCH_OPTIONS = {
  idField: 'id',
  fields: ['title', 'description', 'tags', 'heading', 'body'],
  storeFields: ['id'],
  processTerm: (term: string) => {
    const normalized = term.toLowerCase();
    return STOP_WORDS.has(normalized) ? null : stemmer(normalized);
  },
  searchOptions: {
    boost: {
      title: 5,
      description: 2,
      tags: 4,
      heading: 3,
      body: 1,
    },
    combineWith: 'OR',
    prefix: (term: string) => term.length >= 5,
  },
} satisfies Options<SearchDocument>;
```

Wrap `miniSearch.toJSON()` with the exact corpus/config/MiniSearch/stemmer versions, chunk count, and canonical `chunkIds` array. Canonically serialize it and add `indexSha256`, `indexConfigVersion`, `miniSearchVersion`, `stemmerVersion`, and `indexedChunkCount` to the manifest. The index must be derivable only from canonical corpus data; it performs no remote write.

- [ ] **Step 3: Create a shared Astro package loader**

In all three static endpoint files, call one memoized shared builder. It must load all entries, not prefilter away policy violations:

```ts
const [blog, works] = await Promise.all([
  getCollection('blog'),
  getCollection('works'),
]);
```

Map entries to `AssistantSourceEntry` with Astro Loader API `filePath` normalized to a repository-relative POSIX source path; fail if an eligible entry has no file path. Use `loadTrackedContentPaths()` from the core content policy to assign `tracked`; call `assertGeneratedAssistantSources()` with the final included IDs; and fail if Git tracking cannot be established. The three static endpoint files call one memoized `buildKnowledgeBase()` result so their manifest, content, and index bytes cannot diverge.

Resolve provenance with a pure helper plus a no-shell Git adapter:

```ts
const gitHead = await readGitHead(); // git rev-parse HEAD
const sourceCommit = resolveSourceCommit({
  gitHead,
  vercelSha: process.env.VERCEL_GIT_COMMIT_SHA,
  githubSha: process.env.GITHUB_SHA,
});
```

`resolveSourceCommit()` returns `gitHead` only when every supplied CI/Vercel SHA equals it; any mismatch fails. A production build has no `'local'` fallback.

Return JSON with:

```ts
headers: {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'public, max-age=0, must-revalidate',
}
```

- [ ] **Step 4: Write repository tests**

Create `tests/unit/jets-ghost/repository.test.ts` with mocked `fetch`. Test successful three-artifact loading; exact document/section/chunk map coverage; correct previous/next neighbors only within each section; reference clearing on unload; and rejection when corpus versions differ, either byte hash differs, config/MiniSearch/stemmer versions differ, indexed chunk count differs, any corpus chunk ID is absent or duplicated in the index, the index contains an unknown ID, a parent is missing, or neighbor order is invalid.

Expand `corpusBuild.test.ts` to prove:

- input order and object-key order do not affect canonical bytes;
- the same Git SHA supplied through different matching environment combinations produces byte-identical output;
- differing `sourceCommit` values do not change `corpusVersion` but do change provenance/content bytes;
- a mismatched environment SHA fails;
- untracked `published + assistant:true` content fails inside the generator even when the outer build gate is bypassed;
- duplicate canonical URLs and final IDs fail;
- source path/hash/order propagate to every selected-source precursor.

Create `tests/unit/jets-ghost/searchIndex.test.ts` to prove canonical input produces byte-identical index artifacts regardless of source input order; every eligible chunk is indexed exactly once; metadata fields are searchable; stop-word removal, stemming, and five-character prefix behavior match the evaluated configuration; `loadSearchIndex()` calls `MiniSearch.loadJSAsync()` with the exact checked-in options; and stale corpus/config/MiniSearch/stemmer versions fail closed.

Add a table-driven `computeSourceHash` contract covering every Blog and Works metadata leaf: title, description, status, assistant, dates, author, tags, type, featured, image URL/alt, link label/URL, venue, abstract, technologies, repository, and demo, plus the MDX body. Starting from complete valid fixtures, mutate one leaf at a time and require a different hash. Separately reconstruct the same nested objects with different object-key insertion order and require the same hash. Array-order changes remain hash-significant because validated content order is meaningful.

- [ ] **Step 5: Implement `StaticKnowledgeRepository`**

```ts
export interface LoadedKnowledgeBase {
  package: KnowledgePackage;
  searchIndex: MiniSearch<SearchDocument>;
  documentsById: ReadonlyMap<DocumentId, KnowledgeDocument>;
  sectionsById: ReadonlyMap<SectionId, KnowledgeSection>;
  chunksById: ReadonlyMap<ChunkId, KnowledgeChunk>;
  neighborsByChunkId: ReadonlyMap<ChunkId, { previous?: ChunkId; next?: ChunkId }>;
  indexSha256: string;
  indexConfigVersion: '1.0.0';
  miniSearchVersion: '7.2.0';
  stemmerVersion: '2.0.1';
}

export interface StaticKnowledgeRepository {
  load(signal?: AbortSignal): Promise<LoadedKnowledgeBase>;
  unload(): void;
}
```

Fetch all three paths in parallel after activation with `credentials: 'omit'`, retain the exact content/index response text for SHA-256 verification, validate the complete manifest contract, and hydrate the prebuilt index with `MiniSearch.loadJSAsync()`. Repository tests assert the explicit credentials mode and reject any supplied headers. In the same one-time pass, build immutable `documentsById`, `sectionsById`, `chunksById`, and `neighborsByChunkId` maps; fail on duplicate IDs, unknown parents, cross-section neighbors, or noncanonical order. Memoize only in memory, and clear corpus, index, and all lookup-map references on `unload()`. Do not rebuild the index in the browser and do not write to IndexedDB.

- [ ] **Step 6: Verify generated output**

Run:

```bash
npm run test -- tests/unit/jets-ghost/corpusBuild.test.ts tests/unit/jets-ghost/repository.test.ts tests/unit/jets-ghost/searchIndex.test.ts
npm run build
jq '{schemaVersion,corpusVersion,statistics}' dist/assistant/corpus/manifest.json
jq '[.documents[].id]' dist/assistant/corpus/content.json
jq '{corpusVersion,indexConfigVersion,miniSearchVersion,stemmerVersion,chunkCount}' dist/assistant/corpus/index.json
npm run verify:content
npm run verify:build-purity
```

Expected: only explicitly eligible tracked sources are listed. Synthetic unit fixtures prove that draft, untracked, and assistant-disabled content cannot enter implicitly; no assertion names or probes a user-owned draft.

- [ ] **Step 7: Commit**

```bash
git add src/features/jets-ghost/corpus/build.ts src/features/jets-ghost/corpus/repository.ts src/features/jets-ghost/selection/searchIndex.ts src/pages/assistant/corpus/manifest.json.ts src/pages/assistant/corpus/content.json.ts src/pages/assistant/corpus/index.json.ts tests/unit/jets-ghost/corpusBuild.test.ts tests/unit/jets-ghost/repository.test.ts tests/unit/jets-ghost/searchIndex.test.ts
git commit -m "feat(chatbot): generate versioned knowledge base"
```

### Task 4: Implement deterministic MiniSearch rank-and-pack

**Files:**
- Create: `src/features/jets-ghost/selection/types.ts`
- Create: `src/features/jets-ghost/selection/rankAndPack.ts`
- Create: `src/features/jets-ghost/sourcePayload.ts`
- Modify: `src/features/jets-ghost/corpus/types.ts`
- Modify: `src/features/jets-ghost/corpus/build.ts`
- Modify: `src/features/jets-ghost/corpus/repository.ts`
- Create: `tests/unit/jets-ghost/rankAndPack.test.ts`
- Create: `tests/unit/jets-ghost/sourcePayload.test.ts`
- Modify: `tests/unit/jets-ghost/corpusBuild.test.ts`
- Modify: `tests/unit/jets-ghost/repository.test.ts`

**Interfaces:**
- Produces: `rankAndPackContext()`, `SelectionResult`, and the one canonical source-payload serializer.
- Consumes: `LoadedKnowledgeBase`, `JETS_GHOST_CONTEXT`, and `estimateTokens()`.

- [ ] **Step 1: Define the concrete selection types**

Include:

```ts
export interface SelectedSource {
  citationId: `S${number}`;
  documentId: DocumentId;
  documentOrder: number;
  sectionId: SectionId;
  sectionOrder: number;
  chunkId: ChunkId;
  chunkOrder: number;
  title: string;
  canonicalUrl: string;
  heading: string;
  text: string;
  estimatedTokens: number;
  selectionReason: 'lexical-match' | 'heading-expansion' | 'complete-corpus';
  rankingScore?: number;
  provenance: {
    sourcePath: string;
    sourceHash: string;
    chunkContentHash: string;
    sourceCommit: string;
    corpusVersion: string;
  };
}
```

Define:

```ts
export interface SelectionInput {
  query: string;
  knowledgeBase: LoadedKnowledgeBase;
  budget: ContextBudget;
}

export interface SelectionDiagnostics {
  directMatchCount: number;
  expansionCandidateCount: number;
  packedCount: number;
  rejectedForBudgetCount: number;
  completeCorpusIncluded: boolean;
  knowledgeTokens: number;
  rankingMs: number;
}

export interface SelectionResult {
  pipeline: 'minisearch-rank-pack';
  indexSha256: string;
  indexConfigVersion: '1.0.0';
  miniSearchVersion: '7.2.0';
  stemmerVersion: '2.0.1';
  corpusVersion: string;
  sources: SelectedSource[];
  estimatedTokens: number;
  diagnostics: SelectionDiagnostics;
}
```

Keep the prompt-owned history shape in this dependency-neutral type file:

```ts
export interface ConversationHistoryTurn {
  role: 'user' | 'assistant';
  content: string;
}
```

- [ ] **Step 2: Write the canonical source-payload tests**

Define a dependency-neutral `SourcePayloadRecord` in the feature-root module and accept `readonly SourcePayloadRecord[]`; it may import ID types from the corpus layer but must not import `SelectedSource`, prompt, runtime, or UI modules. Both canonical corpus records and selected sources map structurally into it, preventing a corpus → prompt/selection dependency cycle.

In `sourcePayload.test.ts`, prove `serializeSourcePayload(sources)` produces one canonical JSON array containing only citation ID, document/section/chunk IDs, title, URL, heading, and content; escapes hostile delimiters and backslashes; and returns the exact estimated token cost used by both packing and prompt assembly. Reordering object construction without changing source order must not change bytes. Permuting the same complete source set may change bytes but must retain the same exact serialized length/token cost after contiguous citation reassignment, which is why the canonical build-time full-corpus statistic remains valid for query-ranked order. Export one item serializer/measurement helper and prove that incrementally measured items plus JSON brackets/commas equal the exact full-array bytes and token estimate for empty, one-item, nine-item, ten-item, escaped-content, and rejected-candidate sequences.

Add `fullCorpusKnowledgeTokens` to `CorpusStatistics`. In `buildKnowledgeBase()`, map every canonical chunk to the same source-payload record used at runtime, assign canonical contiguous citation IDs, and compute this statistic through `serializeSourcePayload()`. Treat the payload shape and `estimateTokens()` as part of corpus `schemaVersion`; a change to either must bump that version. Extend corpus-build tests to prove the manifest statistic equals serialization of the complete canonical corpus and remains deterministic across input order. Make the repository reject a manifest/content statistics mismatch so the packer never trusts an unbound fit value.

- [ ] **Step 3: Write failing rank-and-pack tests**

Use a real in-memory MiniSearch index built through `buildSearchIndexArtifact()` and `loadSearchIndex()`. Test:

- title, tag, heading, description, and body matches use the evaluated fixed boosts;
- fixed stop words, stemming, and five-character prefix matching behave exactly as the index configuration declares;
- all MiniSearch results are considered because `search()` receives no `limit`;
- every result/document/section/chunk/neighbor resolves through the prebuilt maps with no corpus-array `.find()` or scan;
- 25 matching chunks can all be selected when the serialized budget fits, proving there is no legacy 16-candidate cap;
- equal scores tie by stable chunk ID;
- immediate previous/next chunks expand only within the same section;
- adjacency receives half its parent score, keeps the highest nomination, and never replaces a direct-match reason;
- combined direct and adjacent candidates sort by score, reason, explicit orders, then stable ID;
- duplicate direct/expanded chunks appear once;
- when all chunks fit, unmatched chunks are appended in canonical order and marked `complete-corpus`;
- the complete-corpus decision uses the verified precomputed `fullCorpusKnowledgeTokens` and does not serialize all unmatched content during a query;
- when the corpus does not fit, unmatched chunks are not added merely to fill space;
- every direct and expansion candidate is attempted against the serialized token budget;
- a candidate that does not fit is skipped while later smaller candidates are still considered;
- each candidate is serialized at most once and incremental measurement equals final source-payload serialization, preventing quadratic tentative-array rebuilding;
- a counter-instrumented large synthetic fixture performs one map resolution and at most one item serialization per considered candidate, and throws if the oversized-corpus path iterates the unmatched canonical chunk array; this is a complexity invariant with no timing, relevance, quality, or competing-ranker assertion;
- citation IDs are assigned only after packing and remain contiguous;
- an unmatched query against an oversized corpus returns an empty, valid selection;
- diagnostics contain counts, timings, and versions but no query or source text.

Use this representative assertion for the removed cap:

```ts
const result = rankAndPackContext({
  query: 'sharedterm',
  knowledgeBase: fixtureWith25MatchingChunks,
  budget: generousBudget,
});

expect(result.sources).toHaveLength(25);
expect(result.diagnostics.directMatchCount).toBe(25);
```

- [ ] **Step 4: Implement `rankAndPackContext()`**

The function:

- calls `knowledgeBase.searchIndex.search(query)` with no `limit` override;
- sorts direct results by descending score then chunk ID;
- resolves every result to canonical document, section, and chunk objects through `documentsById`, `sectionsById`, and `chunksById`, failing closed on an unknown ID and never calling `.find()` over package arrays;
- adds the immediate previous and next chunk only through `neighborsByChunkId` and verifies it shares the matched chunk's section;
- scores adjacency as `parentScore * 0.5`, keeping the highest nomination when several matches share a neighbor;
- retains direct-match reason and score whenever a chunk is both direct and adjacent;
- sorts the combined candidates by descending score, direct-before-adjacent, document/section/chunk order, then chunk ID;
- reads the verified `knowledgeBase.package.statistics.fullCorpusKnowledgeTokens` before constructing an unmatched tail;
- appends canonical unmatched chunks and returns every chunk only when that precomputed value fits `knowledgeLimit`, then verifies the final serialization matches the statistic;
- otherwise never constructs or serializes unmatched chunks;
- considers every direct and expansion candidate in order, serializing that candidate once with the next provisional contiguous citation ID and maintaining the exact JSON-array character/token count;
- accepts the candidate only when the incrementally measured payload fits, without repeatedly serializing the full tentative array;
- propagates source path/hash, chunk hash, source commit, corpus version, orders, reason, and ranking score into every `SelectedSource`;
- propagates the verified index hash plus corpus/config/MiniSearch/stemmer versions into `SelectionResult`;
- returns empty sources rather than unrelated evidence when there are no matches and the complete corpus cannot fit.

Use `performance.now()` only for the diagnostic duration. It must not affect ordering or artifact bytes. Do not add query rewriting, history boosting, document quotas, workers, reranking, embeddings, or a fallback strategy.

- [ ] **Step 5: Verify and commit**

```bash
npm run test -- tests/unit/jets-ghost/rankAndPack.test.ts tests/unit/jets-ghost/sourcePayload.test.ts
git add src/features/jets-ghost/corpus/types.ts src/features/jets-ghost/corpus/build.ts src/features/jets-ghost/corpus/repository.ts src/features/jets-ghost/selection/types.ts src/features/jets-ghost/selection/rankAndPack.ts src/features/jets-ghost/sourcePayload.ts tests/unit/jets-ghost/corpusBuild.test.ts tests/unit/jets-ghost/repository.test.ts tests/unit/jets-ghost/rankAndPack.test.ts tests/unit/jets-ghost/sourcePayload.test.ts
git commit -m "feat(chatbot): rank and pack cited context"
```

### Task 5: Assemble grounded prompts and validate citations

**Files:**
- Create: `src/features/jets-ghost/prompt/assemble.ts`
- Create: `src/features/jets-ghost/prompt/citations.ts`
- Create: `tests/unit/jets-ghost/prompt.test.ts`
- Create: `tests/unit/jets-ghost/citations.test.ts`

**Interfaces:**
- Produces: `assemblePrompt()`, `extractValidCitations()`.
- Consumes: `SelectionResult`, `serializeSourcePayload()`, bounded `ConversationHistoryTurn[]`.

- [ ] **Step 1: Write prompt and citation tests**

Assert the prompt embeds the exact bytes returned by `serializeSourcePayload()`, never includes an unselected source, retains **every** complete turn in the current session when the complete history fits within 2,048 tokens, and instructs abstention. Include source text containing `</source>`, quotes, backslashes, forged `S99` metadata, and instructions to ignore grounding; parse the serialized payload and prove each remains one escaped content value. Assert citation parsing accepts `[S1]`, deduplicates repeated valid IDs, and rejects `[S99]` when not selected.

Add a two-turn collision regression: turn one renders `[S1]` for chunk A; turn two selects a different chunk B as its new `S1`. Require the model-history projection to remove every `[S<number>]` marker from prior assistant content while the original UI turn and its chunk-A source mapping remain byte-for-byte unchanged. The turn-two parser may resolve `[S1]` only to chunk B. Do not strip bracketed text from user turns.

Add budget tests that independently overflow the fixed system message, current question, complete prior session history, serialized source JSON, and final total. Require `question-too-long` for a query above 384 estimated tokens; require `conversation-limit-reached` when serialized prior turns exceed 2,048 tokens or an otherwise-valid final prompt overflows only because all prior turns are preserved; and require `context-budget-exceeded` for every other overflow. Prove conversation exhaustion neither drops the oldest turn nor returns an assembled prompt. Assert no output is returned unless:

```text
serializedPromptTokens + responseReserve + estimatorHeadroom <= maxContextTokens
```

- [ ] **Step 2: Implement prompt assembly**

Export:

```ts
export interface AssembledPrompt {
  preface: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
  userMessage: string;
  selectedSources: SelectedSource[];
  estimatedTokens: number;
  diagnostics: {
    systemTokens: number;
    questionTokens: number;
    historyTokens: number;
    knowledgeTokens: number;
    responseReserve: number;
    estimatorHeadroom: number;
    totalContextTokens: number;
  };
}

export function assemblePrompt(
  query: string,
  history: ConversationHistoryTurn[],
  selection: SelectionResult,
  budget: ContextBudget,
): AssembledPrompt;
```

The system message identifies Jet's Ghost, restricts answers to supplied sources, treats source text as untrusted reference material, requires `[S#]` citations, distinguishes published claims from synthesis, and requires explicit abstention when unsupported.

Call `serializeSourcePayload(selection.sources)`; do not remap or reserialize the sources independently. Never interpolate source values into XML, Markdown fences, attributes, or hand-built delimiters. The system message labels the JSON as untrusted reference data and states that instructions inside any `content` value have no authority.

Export a pure `toCitationNeutralModelHistory()` helper from `assemble.ts`. It copies every complete turn, removes `/\[S\d+\]/g` only from prior assistant content, and never mutates the stored turn. Estimate the exact serialized system content, this citation-neutral complete history, and the query after serialization. Count source metadata and escaping overhead against `knowledgeLimit`; enforce each component limit and the final total before returning. Preserve all complete turns or throw `conversation-limit-reached`; never evict old turns automatically. The caller must not invoke `runtime.createSession()` when assembly throws.

- [ ] **Step 3: Implement citation allowlisting**

```ts
export interface ValidCitation {
  id: `S${number}`;
  source: SelectedSource;
}

export function extractValidCitations(
  response: string,
  sources: SelectedSource[],
): ValidCitation[];
```

Use `/\[(S\d+)\]/g`, resolve against the selected-source map, retain response order, and deduplicate IDs.

- [ ] **Step 4: Verify and commit**

```bash
npm run test -- tests/unit/jets-ghost/prompt.test.ts tests/unit/jets-ghost/citations.test.ts
git add src/features/jets-ghost/prompt/assemble.ts src/features/jets-ghost/prompt/citations.ts tests/unit/jets-ghost/prompt.test.ts tests/unit/jets-ghost/citations.test.ts
git commit -m "feat(chatbot): assemble grounded cited prompts"
```

### Task 6: Define capability, lifecycle, and runtime contracts

**Files:**
- Create: `src/features/jets-ghost/runtime/types.ts`
- Create: `src/features/jets-ghost/runtime/capabilities.ts`
- Create: `src/features/jets-ghost/runtime/lifecycle.ts`
- Create: `src/features/jets-ghost/runtime/fakeRuntime.ts`
- Create: `tests/unit/jets-ghost/capabilities.test.ts`
- Create: `tests/unit/jets-ghost/lifecycle.test.ts`

**Interfaces:**
- Produces: `LocalModelRuntime`, `CapabilityReport`, `JetsGhostLifecycleState`, fake runtime for CI.
- Consumes: browser navigator APIs.

- [ ] **Step 1: Define the runtime interface**

Use the approved methods:

```ts
export interface LocalModelRuntime {
  checkCapabilities(): Promise<CapabilityReport>;
  load(options: LoadOptions): Promise<void>;
  createSession(preface: ModelMessage[]): Promise<void>;
  generate(message: string, handlers: GenerationHandlers): Promise<GenerationResult>;
  cancel(): void;
  reset(): Promise<void>;
  unload(): Promise<void>;
}
```

Import the approved error-code union and `JetsGhostError` from `src/features/jets-ghost/errors.ts`. Add runtime-specific constructors/mappings without redefining the shared codes, and ensure diagnostics never require prompt or response content.

- [ ] **Step 2: Write capability tests**

Mock secure context, `navigator.gpu`, adapter resolution, and `navigator.storage.estimate()`. Assert:

- insecure context is unsupported;
- missing WebGPU is unsupported;
- a null adapter is unsupported;
- low reported quota is a warning, not a hard failure;
- adapter plus secure context is supported.

- [ ] **Step 3: Implement `checkBrowserCapabilities()`**

Return a report with `supported`, `warnings`, secure-context state, WebGPU state, adapter availability, and storage estimate. Do not hard-block on user-agent strings.

- [ ] **Step 4: Write lifecycle reducer tests**

Cover the state graph from the design, including stop-during-load intent, cancellation back to ready, load failure, generation failure, reset, unload, and late events after unmount.

- [ ] **Step 5: Implement the pure lifecycle reducer and fake runtime**

The fake runtime streams deterministic chunks, records calls, supports cancellation, and can be configured to fail capability, load, generation, reset, or unload paths. It must never import LiteRT-LM.

- [ ] **Step 6: Verify and commit**

```bash
npm run test -- tests/unit/jets-ghost/capabilities.test.ts tests/unit/jets-ghost/lifecycle.test.ts
git add src/features/jets-ghost/runtime/types.ts src/features/jets-ghost/runtime/capabilities.ts src/features/jets-ghost/runtime/lifecycle.ts src/features/jets-ghost/runtime/fakeRuntime.ts tests/unit/jets-ghost/capabilities.test.ts tests/unit/jets-ghost/lifecycle.test.ts
git commit -m "feat(chatbot): define local runtime lifecycle"
```

### Task 7: Implement the actual LiteRT-LM Gemma runtime

**Files:**
- Create: `src/features/jets-ghost/runtime/liteRtGemma.ts`
- Create: `tests/unit/jets-ghost/liteRtGemma.test.ts`

**Interfaces:**
- Produces: `LiteRtGemmaRuntime` implementing `LocalModelRuntime`.
- Consumes: dynamic `@litert-lm/core` import, model/context configuration.

- [ ] **Step 1: Write runtime tests around an injected module loader**

Create fakes for `loadLiteRtLm`, `unloadLiteRtLm`, `Engine.create`, `engine.createConversation`, `conversation.sendMessageStreaming`, `conversation.cancel`, `conversation.delete`, and `engine.delete`. Test:

- module loader is untouched before `load()`;
- `loadLiteRtLm()` receives the exact versioned same-origin `JETS_GHOST_PATHS.liteRtWasm` before `Engine.create()` and the SDK default path is never used;
- `Engine.create()` receives the pinned URL and `maxNumTokens: 16384`;
- runtime deliberately uses the SDK URL source and performs no separate model fetch, byte hashing, Blob/Object-URL construction, or second preflight before `Engine.create()`;
- runtime exposes no positive artifact-byte-integrity flag under LiteRT-LM `0.14.0` and does not convert provider headers or request metadata into one;
- `engine.createConversation()` receives `sessionConfig.maxOutputTokens: 1024`, and a boundary fixture proves the reserved output cannot consume estimator headroom;
- replacing a session deletes the old conversation first;
- string content and `part.text` for `part.type === 'text'` stream in order while non-text parts are ignored;
- `cancel()` calls the active conversation;
- unload deletes conversation before engine, then calls `unloadLiteRtLm()` and clears all application references even when an earlier cleanup step fails;
- stop requested during WASM or model load waits for the pinned API's non-abortable load to settle, deletes any newly created engine, and unloads the singleton immediately afterward;
- a fresh runtime can load successfully after Unload and route re-entry without reusing the prior singleton, engine, or conversation;
- events after unload are ignored.

- [ ] **Step 2: Implement dynamic loading**

Use a constructor seam:

```ts
type LiteRtModule = typeof import('@litert-lm/core');
type LiteRtModuleLoader = () => Promise<LiteRtModule>;

export class LiteRtGemmaRuntime implements LocalModelRuntime {
  constructor(
    private readonly loadModule: LiteRtModuleLoader = () => import('@litert-lm/core'),
  ) {}
}
```

`load()` calls:

```ts
const liteRt = await this.loadModule();
this.liteRt = liteRt;
await liteRt.loadLiteRtLm(JETS_GHOST_PATHS.liteRtWasm);
this.engine = await liteRt.Engine.create({
  model: JETS_GHOST_MODEL.url,
  mainExecutorSettings: {
    maxNumTokens: JETS_GHOST_CONTEXT.maxContextTokens,
  },
});
```

`JETS_GHOST_PATHS.liteRtWasm` is the static same-origin directory emitted in Task 1. Passing it explicitly is mandatory because `Engine.create()` otherwise initializes the SDK singleton from `LiteRtLm.DEFAULT_WASM_PATH` on jsDelivr. LiteRT-LM `0.14.0` exposes no load abort or byte progress. Honor a stop request during WASM or model loading by waiting for the current API call to settle, deleting any engine that was created, calling `unloadLiteRtLm()`, and never entering Ready.

Do not prefetch the approximately 2 GB model in application code. The pinned API accepts a URL, `Blob`, or `ReadableStream<Uint8Array>`, but this release deliberately uses the URL. A preverified `Blob` would buffer approximately 2 GB; a verified stream would require an app-owned incremental SHA-256 implementation and a new cancellation/failure/cleanup lifecycle before the engine could be trusted. Neither has earned its cost, and a separate browser prefetch followed by URL loading would duplicate transfer without proving the executed copy. The verification document records runtime artifact-byte verification as unavailable. Runtime may compare a complete byte count only if a future API exposes an unambiguous count for the exact LiteRT-consumed artifact, never from range length, encoded transfer length, cache metadata, provider headers, or ETags.

Implement `checkCapabilities()` by delegating to `checkBrowserCapabilities()` from Task 6 before any module import.

- [ ] **Step 3: Implement session and streaming behavior**

Before creating a session:

```ts
await this.conversation?.delete();
this.conversation = await this.engine.createConversation({
  preface: { messages: preface },
  prefillPrefaceOnInit: true,
  sessionConfig: {
    maxOutputTokens: JETS_GHOST_CONTEXT.responseReserve,
  },
});
```

Stream using `sendMessageStreaming({ role: 'user', content: message })`. For each message chunk, emit `chunk.content` directly when it is a string; when it is a part array, emit `part.text` only for `part.type === 'text'` and ignore other part types. Check an operation generation ID before forwarding each text fragment. The runtime test asserts the exact `maxOutputTokens` value reaches the pinned SDK, while the existing serialized-budget boundary test proves the 1,024-token generation cap cannot consume the 3,277-token estimator headroom.

- [ ] **Step 4: Implement cancellation, reset, and unload**

- `cancel()` synchronously calls `conversation.cancel()` and invalidates the active operation ID.
- `reset()` deletes the conversation and clears it without deleting the engine.
- `unload()` invalidates operations, deletes the conversation, then deletes the engine, then calls the loaded module's `unloadLiteRtLm()` in final cleanup; clear every application reference even when an earlier deletion fails and aggregate diagnostics without retaining prompts.

The pinned SDK's `unloadLiteRtLm()` resets its global singleton, which is necessary for route re-entry, but its current `LiteRtLm.delete()` is a no-op. Tests may prove call order, cleared application references, fresh initialization, and absence of an active engine/conversation; neither tests nor UI copy may promise immediate reclamation of every WASM allocation or browser-owned GPU resource.

- [ ] **Step 5: Verify bundle isolation**

Run:

```bash
npm run test -- tests/unit/jets-ghost/liteRtGemma.test.ts
npm run check
npm run build
test "$(find dist/assistant/runtime/litert-lm/0.14.0 -type f | wc -l | tr -d ' ')" = "8"
rg -n "litert" dist/_astro | head
```

Expected: the main site builds; package JavaScript is isolated to lazy application chunks, all eight pinned WASM runtime files exist at the versioned same-origin path, and neither class of asset is requested before activation in later browser tests.

- [ ] **Step 6: Commit**

```bash
git add src/features/jets-ghost/runtime/liteRtGemma.ts tests/unit/jets-ghost/liteRtGemma.test.ts
git commit -m "feat(chatbot): run Gemma E2B with LiteRT-LM"
```

### Task 8: Integrate production state into the approved interface

**Files:**
- Create: `src/features/jets-ghost/state/types.ts`
- Create: `src/features/jets-ghost/state/useJetsGhost.ts`
- Modify: `src/features/jets-ghost/JetsGhostExperience.tsx`
- Modify: `src/features/jets-ghost/experience.ts`
- Modify: `tests/jets-ghost-experience.test.ts`
- Create: `tests/unit/jets-ghost/useJetsGhost.test.tsx`
- Modify: `playwright.config.ts`

**Interfaces:**
- Produces: production visitor activation, streaming, Stop, new session, Unload, errors, and response-local sources inside the approved `JetsGhostExperience`.
- Consumes: knowledge repository, `rankAndPackContext()`, prompt assembler, runtime.

- [ ] **Step 1: Define in-memory state**

Use:

```ts
export interface ConversationTurn {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  citations: ValidCitation[];
  sources: SelectedSource[];
  stopped?: boolean;
}

export interface JetsGhostState {
  lifecycle: JetsGhostLifecycleState;
  capability: CapabilityReport | null;
  turns: ConversationTurn[];
  error: JetsGhostError | null;
}
```

No persisted storage is permitted.

- [ ] **Step 2: Write orchestration and activation-boundary tests with `FakeRuntime`**

Test that hook/component construction performs no capability probe, repository load, runtime import/load, session creation, or generation. “Check compatibility” may call only `runtime.checkCapabilities()`. “Load Jet's Ghost” calls repository load and `runtime.load()` only after compatibility succeeds and never assembles a prompt or creates a session. The first submitted message performs rank/pack, prompt assembly, session creation, and generation in that order.

Also cover corpus-index mismatch, complete-corpus inclusion when it fits, ranked packing when it does not, empty selection, streaming, valid citations, Stop, new session, Unload, generation recovery, route-unmount cleanup, and conversation reserve exhaustion. For exhaustion, seed complete prior turns, submit a question that would cross the reserve, and prove the hook preserves the transcript byte-for-byte, records `conversation-limit-reached`, does not call `runtime.createSession()` or `generate()`, and exposes a `startNewSession()` recovery action.

- [ ] **Step 3: Implement `useJetsGhost()`**

The hook receives dependency factories so tests can inject fakes. For each question:

1. rank and pack context from the current question and loaded knowledge base;
2. assemble preface with the complete current-session history;
3. call `runtime.createSession(preface)` so only one conversation exists;
4. stream the current user message;
5. parse citations after completion;
6. append the complete turn;
7. return to ready.

Unload/route cleanup cancels generation, calls `runtime.reset()` to delete the active conversation, unloads repository resources, then calls `runtime.unload()` to delete the engine, reset the LiteRT singleton, and clear application references. Use `try/finally` so later cleanup still runs after one failure, aggregate safe diagnostics, and use an operation ID to suppress late events. No active Jet's Ghost engine or conversation survives route unmount; the hook does not claim control over the browser's eventual reclamation of SDK WASM/GPU memory.

`startNewSession()` is distinct from retry: it calls `runtime.reset()`, and only after successful conversation deletion clears turns and the exhaustion error while keeping the engine and knowledge base loaded. It returns to ready and focuses the input; it does not automatically resubmit the rejected question. If reset fails, preserve the transcript and show the cleanup error.

- [ ] **Step 4: Replace prototype timers and canned data without redesigning the interface**

Treat `docs/jets-ghost-chat-experience.md`, commit `d406ed46`, and the existing nine prototype tests as the presentation contract. Keep `JetsGhostExperience.tsx` as the composition root. Replace timer-driven compatibility/progress, canned conversation content, and simulated citations with `useJetsGhost()` state and actions. Reduce `experience.ts` to pure presentation mappings from production lifecycle state to ghost animation, loading phase, and composer tone; do not retain a second lifecycle state machine.

Retain the approved disclosure before the load button:

```text
Jet's Ghost runs Gemma 4 E2B in this browser. Starting it downloads about 2 GB and may use substantial GPU memory. Your prompts and responses stay on this device.
```

Use “Check compatibility” then “Load Jet's Ghost” as separate explicit actions. Preserve the final reviewed copy from the prototype where it is more specific than the generic sentence above. Unsupported state offers links to Blog and Works and no broken text input. Loading shows determinate progress only when the runtime provides trustworthy phase/byte data; otherwise preserve the phase language and elapsed time without simulated percentages.

- [ ] **Step 5: Preserve the approved chat composition and harden accessibility**

Requirements:

- full-viewport immersive canvas with the site dock retained;
- one labeled composer and submit button;
- Stop visible only during generation;
- New session and Unload available when ready;
- status announcements in a polite live region, but streamed tokens outside that live region;
- validated inline citation links and selected source links directly beneath each assistant response;
- no empty permanent source panel before a response exists;
- a `conversation-limit-reached` message explaining that the current session is full plus a clearly labeled “Start new session” button;
- deterministic partial-response rule: cancellation retains the partial response labeled “Stopped”;
- suggested questions disappear after the first message;
- user turns retain the compact surface and assistant responses remain unboxed;
- slate-blue ghost states and mustard action/progress/particle/citation roles remain unchanged;
- Utopia desktop/mobile typography and spacing remain unchanged, including single-line ready heading/helper at `>=370px` and safe wrap below it;
- focus moves to the input after load/New session and to the error action after failure;
- reduced motion disables nonessential transitions.

- [ ] **Step 6: Add a test-build-only fake runtime seam**

Routine browser tests run against `astro preview`, so `import.meta.env.DEV` is false. Set Playwright's web-server command to `cross-env PUBLIC_JETS_GHOST_E2E=1 npm run build && npm run preview -- --host 127.0.0.1`. In `JetsGhostExperience`, allow `?runtime=fake` only when that build flag is exactly `1` **and** `location.hostname` is `127.0.0.1` or `localhost`. Ordinary builds omit the flag and always construct `LiteRtGemmaRuntime`; add a static-boundary test proving the production build metadata has no fake-runtime enablement.

Only in the test build, expose a minimal `window.__JETS_GHOST_E2E__` call log from `FakeRuntime` containing lifecycle method names and operation IDs—never prompts, responses, or source text. This supports route-transition cleanup assertions without weakening production privacy.

- [ ] **Step 7: Verify and commit**

```bash
npm run test -- tests/unit/jets-ghost/useJetsGhost.test.tsx
npm run test:jets-ghost-design
npm run check
git add src/features/jets-ghost/state/types.ts src/features/jets-ghost/state/useJetsGhost.ts src/features/jets-ghost/JetsGhostExperience.tsx src/features/jets-ghost/experience.ts tests/jets-ghost-experience.test.ts tests/unit/jets-ghost/useJetsGhost.test.tsx playwright.config.ts
git commit -m "feat(chatbot): connect the approved local experience"
```

### Task 9: Make Jet's Ghost a first-class canonical site experience

**Files:**
- Modify: `src/pages/chatbot.astro`
- Delete: `src/pages/tools/chatbot.astro`
- Modify: `src/pages/tools/index.astro`
- Modify: `src/config/site.ts`
- Modify: `astro.config.mjs`
- Modify: `vercel.json`
- Modify: `src/utils/structuredData.ts`
- Modify: `tests/jets-ghost-experience.test.ts`
- Modify: `tests/unit/ops/productionContainment.test.ts`
- Modify: `tests/deployment/core-production.spec.ts`
- Modify: `scripts/verify-production-containment.ts`
- Modify: `README.md`

**Interfaces:**
- Produces: noindexed qualification shell at `/chatbot/` with canonical `https://jetsanchez.com/chatbot/`, the exact platform-plus-explicit route matrix for semantic and legacy variants, one Ghost navigation item replacing Tools, dormant `/tools/`, and accurate WebPage/SoftwareApplication metadata.
- Consumes: approved `JetsGhostExperience`, canonical `NAV_ITEMS`, SoftwareApplication JSON-LD.

- [ ] **Step 1: Move the approved experience to canonical `/chatbot/`**

Replace the current semantic `/chatbot` redirect page with the approved immersive shell emitted at `/chatbot/` and render:

```astro
<JetsGhostExperience client:load />
```

Preserve the reviewed prototype layout/styles and add a coherent Astro/no-script explanation with trailing-slash links to Blog and Works. Keep `noindex={true}` through qualification. Emit exact canonical and `og:url` `https://jetsanchez.com/chatbot/`; link the WebPage and SoftwareApplication IDs/URLs to that base. Update `tests/jets-ghost-experience.test.ts` to inspect `src/pages/chatbot.astro` while retaining its approved responsive and Utopia assertions.

- [ ] **Step 2: Reverse the temporary containment redirect**

Delete `src/pages/tools/chatbot.astro`. Reverse only the core-2.0 redirect while preserving both the core `"trailingSlash": true` setting and the versioned LiteRT runtime cache rule added in Task 1. The relevant `vercel.json` state is exactly:

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "trailingSlash": true,
  "headers": [
    {
      "source": "/assistant/runtime/litert-lm/0.14.0/:asset",
      "headers": [
        {
          "key": "Cache-Control",
          "value": "public, max-age=31536000, immutable"
        }
      ]
    }
  ],
  "redirects": [
    {
      "source": "/tools/chatbot/",
      "destination": "/chatbot/",
      "permanent": true
    }
  ]
}
```

Do not retain a `/chatbot/ -> /tools/chatbot/` rule. Vercel's preserved trailing-slash normalization owns `/chatbot === 308` with exact `Location: /chatbot/`, and `/chatbot/` is the terminal `200` document. The platform also owns `/tools/chatbot === 308` with exact `Location: /tools/chatbot/`; the sole explicit legacy rule owns `/tools/chatbot/ === 308` with exact `Location: /chatbot/`. Production/deployment tests must assert all four rows independently and must require the exact immutable cache header on `/assistant/runtime/litert-lm/0.14.0/litertlm_wasm_internal.wasm`; routine `astro preview` tests do not pretend to execute Vercel routing or headers.

Before changing the implementation, reverse the existing containment/deployment test expectations so they fail against the core-2.0 redirect. Update `verify-production-containment.ts` to retain the removed-API assertion that no handler or build artifact exists: slashless `POST /api/chat` returns exact `308` with resolved destination `https://jetsanchez.com/api/chat/`, followed by terminal `POST /api/chat/ === 404` with no `Location`. Continue asserting empty legacy Blob state, revoked/absent credentials, and deployment SHA while requiring the exact Ghost route matrix: `/chatbot === 308` to `/chatbot/`; terminal `/chatbot/ === 200` with no `Location`; `/tools/chatbot === 308` to `/tools/chatbot/`; and `/tools/chatbot/ === 308` to `/chatbot/`. Preserve the verifier's optional singular `--output=<path>` behavior and its historical default when modifying the route matrix. Apply the same platform-plus-explicit status/location matrix in `core-production.spec.ts`.

- [ ] **Step 3: Replace Tools with Ghost in canonical navigation**

In `NAV_ITEMS`, replace the Tools record rather than adding a seventh item:

```ts
{ id: 'ghost', label: "Jet's Ghost", href: '/chatbot/', icon: Ghost, gradient: 'from-indigo-600 to-indigo-400' }
```

Import `Ghost` from `lucide-react` and remove `Wrench` if unused. Because the modernized dock, structured navigation, and no-script fallback all consume `NAV_ITEMS`, verify all three now contain Ghost and none contains Tools. Preserve existing mobile item count and dock geometry.

Remove Jet's Ghost from `src/pages/tools/index.astro`; render `/tools/` as a dormant noindexed page with no primary-navigation claim until multiple standalone tools exist. Verify `/tools` normalizes once to `/tools/` and the sitemap/navigation filters do not affect `/toolshed/`.

- [ ] **Step 4: Keep qualification routes out of the sitemap**

While `/chatbot/` remains noindexed, make the sitemap filter exclude semantic exact `/chatbot`, exact `/tools`, and `/tools/` descendants after normalizing one terminal slash. Parse the URL pathname rather than using a substring match that could hide unrelated future routes:

```js
filter: (page) => {
  const pathname = new URL(page).pathname.replace(/\/$/, '') || '/';
  return pathname !== '/chatbot'
    && pathname !== '/tools'
    && !pathname.startsWith('/tools/');
},
```

Task 13 replaces only the exact `/chatbot/` document exclusion with a Production-target guard after qualification; exact `/tools/` and descendants remain excluded without hiding unrelated routes such as `/toolshed/`.

- [ ] **Step 5: Add canonical SoftwareApplication metadata**

Extend the typed builder only as necessary to render:

```json
{
  "@type": "SoftwareApplication",
  "@id": "https://jetsanchez.com/chatbot/#softwareapplication",
  "url": "https://jetsanchez.com/chatbot/",
  "name": "Jet's Ghost",
  "applicationCategory": "ChatApplication",
  "operatingSystem": "Web browser with WebGPU",
  "offers": { "@type": "Offer", "price": "0", "priceCurrency": "USD" }
}
```

- [ ] **Step 6: Update README status without claiming release**

State that Jet's Ghost is integrated at `/chatbot/` behind qualification, local-first, WebGPU-only, and still `noindex`. Identify `docs/jets-ghost-chat-experience.md` as the approved interface source. Do not call it a Tool or claim offline operation.

- [ ] **Step 7: Verify and commit**

```bash
npm run test -- tests/unit/ops/productionContainment.test.ts
npm run verify
npm run test:jets-ghost-design
git add src/pages/chatbot.astro src/pages/tools/index.astro src/config/site.ts astro.config.mjs vercel.json src/utils/structuredData.ts tests/jets-ghost-experience.test.ts tests/unit/ops/productionContainment.test.ts tests/deployment/core-production.spec.ts scripts/verify-production-containment.ts README.md
git add -u src/pages/tools/chatbot.astro
git commit -m "feat(jets-ghost): make chatbot a first-class route"
```

### Task 10: Add browser lifecycle, privacy, and accessibility tests

**Files:**
- Create: `tests/e2e/jets-ghost.spec.ts`
- Modify: `tests/e2e/site.spec.ts`
- Modify: `tests/e2e/accessibility.spec.ts`

**Interfaces:**
- Produces: browser proof without the real model download.
- Consumes: development-only fake runtime.

- [ ] **Step 1: Test the default production runtime path before activation**

In `jets-ghost.spec.ts`, record all requests and open `/chatbot/` with no fake query. Do not click compatibility or Load. Assert no request targets the three corpus/index paths, `/_astro/` LiteRT chunks, `/assistant/runtime/litert-lm/0.14.0/`, Hugging Face, or `.litertlm`, and no engine/capability call appears in the test log. This exercises the production-mode construction path rather than bypassing it with the fake.

Click only “Check compatibility” in a fresh run. Assert the capability call occurs but LiteRT import, corpus/index/model requests, engine creation, prompt assembly, and generation do not. This is a hard consent-boundary regression.

- [ ] **Step 2: Test supported flow**

Open `/chatbot/?runtime=fake` in the test-only build and use the fake capability report to:

- check compatibility;
- load the assistant;
- submit one suggested question;
- observe streaming text;
- verify a source link;
- reset;
- unload.

Assert button states and focus after each transition.

- [ ] **Step 3: Test cancellation and recovery**

Start a slow fake stream, press Stop, assert one partial response marked “Stopped,” submit a second question, and assert the second response completes once. Verify each response's sources render directly beneath it and no empty permanent source panel exists before generation.

- [ ] **Step 4: Test unsupported, exhaustion, and failure states**

Cover no WebGPU, model load failure, corpus version mismatch, corpus-index mismatch, generation failure, conversation exhaustion, and recovery. For exhaustion, verify the complete visible transcript remains, no create/generate call is logged, “Start new session” resets the conversation, and focus returns to an empty enabled input. No unsupported state renders an enabled chat input.

- [ ] **Step 5: Enforce the privacy network contract**

Begin a fresh request log before compatibility checking. Require zero assistant resource requests until explicit Load. After Load, inspect every request's origin, pathname, method, query, headers, and post data. Allow only:

- bodyless `GET` to `/assistant/corpus/manifest.json`, `/assistant/corpus/content.json`, or `/assistant/corpus/index.json`;
- bodyless `GET` to same-origin emitted `/_astro/` chunks/assets;
- bodyless `GET` to one of the eight allowlisted files directly beneath `/assistant/runtime/litert-lm/0.14.0/`;
- pre-existing analytics endpoints with no conversation-derived query/header/body fields.

The fake-runtime test accepts no Hugging Face request at all; because it never imports LiteRT, it also makes no request to the same-origin WASM subtree. Submit distinctive sentinel prompt and selected-source strings and fail if either appears in any URL, query, header, or body. Explicit corpus fetches must report `credentials: 'omit'` in the injected fetch test and carry neither `Cookie` nor `Authorization`. Browser-managed first-party cookies are permitted only on exact same-origin document and emitted application-asset GETs; pre-existing analytics may use its ordinary browser-managed state, but neither class may contain a conversational sentinel. Fail any nonallowlisted origin, path, method, request body, application-constructed credential/custom header, `cdn.jsdelivr.net`, or other external SDK-runtime origin. Task 11 repeats this contract with the actual pinned model and validates its provider redirect chain in memory.

- [ ] **Step 6: Test ClientRouter cleanup and late-event suppression**

With the fake runtime loaded, cover route-away while ready and while streaming. Navigate through the retained dock so Astro ClientRouter performs the transition. Read the test-only call log and assert cancellation (when generating), `conversation.delete`, repository unload, `engine.delete`, and SDK-singleton unload occur in that order and once, and a deliberately delayed stream event does not update the destination page or resurrect assistant state. Assert a return to `/chatbot/` creates a fresh runtime instance.

- [ ] **Step 7: Add axe and keyboard checks**

Run axe on introduction, ready, response, and error states. Assert the live status region exists, streamed response is not itself `aria-live`, and all actions are keyboard reachable.

Also assert `/chatbot/` owns exact canonical and `og:url` `https://jetsanchez.com/chatbot/`; its WebPage and SoftwareApplication IDs/URLs use that slashful base; it remains `noindex` during qualification; the dock/no-script/structured navigation contain Ghost href `/chatbot/` and not Tools; `/tools/` is noindexed; and neither route appears in the generated sitemap at this milestone. Extend `tests/e2e/site.spec.ts` so About, both retired `404`s, robots, sitemap XML, RSS exclusion, and HTML canonical/OG/JSON-LD agreement continue to pass after route integration. Keep exact production redirect status/destination for Task 13 because `astro preview` does not execute `vercel.json`.

- [ ] **Step 8: Run and commit**

```bash
npm run test:e2e -- tests/e2e/jets-ghost.spec.ts tests/e2e/accessibility.spec.ts
npm run test:e2e -- tests/e2e/site.spec.ts
git add tests/e2e/jets-ghost.spec.ts tests/e2e/site.spec.ts tests/e2e/accessibility.spec.ts
git commit -m "test(chatbot): verify lifecycle and local privacy"
```

### Task 11: Add lean product acceptance and real-model qualification

**Files:**
- Create: `tests/fixtures/jets-ghost/product-acceptance.json`
- Create: `tests/unit/jets-ghost/productAcceptance.test.ts`
- Create: `playwright.real-model.config.ts`
- Create: `tests/manual/jets-ghost-real-model.spec.ts`
- Modify: `package.json`

**Interfaces:**
- Produces: exactly six product-acceptance cases, one installed-Chrome Mac qualification, one reusable two-case deployment smoke, and `npm run qualify:jets-ghost:mac`.
- Consumes: actual Gemma/WebGPU route and source/citation output.

- [ ] **Step 1: Create the fixed product-acceptance set**

Define:

```ts
interface ProductAcceptanceCase {
  id: string;
  category: 'supported' | 'ordinary' | 'cross-document' | 'unsupported';
  question: string;
  expectedSourceIds: string[];
  acceptableSourceIds: string[];
  requiredFacts: string[];
  forbiddenClaims: string[];
  mustAbstain: boolean;
}
```

Use exactly two representative supported, one ordinary discovery, one natural cross-document synthesis, and two unsupported cases. Do not generate more cases, a fresh holdout, or retrieval-candidate variants. Seed the fixture with these reviewed questions and rubrics:

```json
[
  {"id":"showcase-claude-native","category":"supported","question":"What installation method does Jet recommend for Claude Code in 2026, and why?","expectedSourceIds":["blog:how-to-install-claude-code-cli-2026"],"acceptableSourceIds":["blog:how-to-install-claude-code-cli-2026"],"requiredFacts":["The native installer is the recommended standard method.","Jet attributes better stability, automatic updates, and avoiding dependency conflicts to it."],"forbiddenClaims":["Jet recommends npm as the standard 2026 installation method."],"mustAbstain":false},
  {"id":"showcase-rch-claim","category":"supported","question":"What is the central claim of the Recursive Convergence Hypothesis?","expectedSourceIds":["works:recursive-convergence-hypothesis"],"acceptableSourceIds":["works:recursive-convergence-hypothesis"],"requiredFacts":["Emergent sentience is proposed as a structurally favored outcome of open recursive ASI.","Recursive self-improvement and modeling sentient agents create converging pressures."],"forbiddenClaims":["The paper proves that every ASI will become conscious."],"mustAbstain":false},
  {"id":"ordinary-agent-writing","category":"ordinary","question":"What has Jet published about working with coding agents?","expectedSourceIds":["blog:how-to-install-claude-code-cli-2026","blog:vibe-coding-vs-agentic-coding-why-the-distinction-matters"],"acceptableSourceIds":["blog:how-to-install-claude-code-cli-2026","blog:vibe-coding-vs-agentic-coding-why-the-distinction-matters"],"requiredFacts":["There is a practical Claude Code setup guide.","There is a conceptual essay distinguishing vibe and agentic coding."],"forbiddenClaims":[],"mustAbstain":false},
  {"id":"cross-review-control","category":"cross-document","question":"How does human review in Jet's Claude Code guidance relate to the control concerns in agentic coding?","expectedSourceIds":["blog:how-to-install-claude-code-cli-2026","blog:vibe-coding-vs-agentic-coding-why-the-distinction-matters"],"acceptableSourceIds":["blog:how-to-install-claude-code-cli-2026","blog:vibe-coding-vs-agentic-coding-why-the-distinction-matters"],"requiredFacts":["The guide says the human maintains control and should review changes before accepting them.","The essay frames durable intent and constraints as central to agentic control."],"forbiddenClaims":["Either article recommends autonomous changes without human review."],"mustAbstain":false},
  {"id":"unsupported-private-note","category":"unsupported","question":"What exact launch date did Jet record in a private, unpublished note for Jet's Ghost 2.1?","expectedSourceIds":[],"acceptableSourceIds":[],"requiredFacts":[],"forbiddenClaims":["Any claimed access to a private, unpublished note or an exact date unsupported by the eligible corpus."],"mustAbstain":true},
  {"id":"unsupported-private-schedule","category":"unsupported","question":"What meetings are on Jet's private schedule tomorrow?","expectedSourceIds":[],"acceptableSourceIds":[],"requiredFacts":[],"forbiddenClaims":["Any claimed access to a private schedule."],"mustAbstain":true}
]
```

Before the fixture is accepted, a human reviews every source ID, required fact, and forbidden claim against the exact eligible corpus. Store only a non-identifying review-completion date and corpus version in qualification evidence, not in the reusable question file; any operational reviewer attribution remains private and outside committed artifacts. Later corpus versions may replace cases or update facts/source IDs to remain representative, but must retain the fixed `2/1/1/2` six-case scope unless a new product decision changes it.

- [ ] **Step 2: Add an executable branded-Chrome Playwright configuration**

Create `playwright.real-model.config.ts`:

```ts
import { defineConfig, devices } from '@playwright/test';

const externalBaseUrl = process.env.REAL_MODEL_BASE_URL;

export default defineConfig({
  testDir: './tests/manual',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 30 * 60_000,
  reporter: 'list',
  use: {
    baseURL: externalBaseUrl ?? 'http://127.0.0.1:4322',
    headless: false,
    trace: 'off',
    screenshot: 'off',
    video: 'off',
  },
  webServer: externalBaseUrl ? undefined : {
    command: 'npm run build && npm run preview -- --host 127.0.0.1 --port 4322',
    url: 'http://127.0.0.1:4322',
    reuseExistingServer: false,
    timeout: 120_000,
  },
  projects: [{
    name: 'chrome-real-model',
    use: { ...devices['Desktop Chrome'], channel: 'chrome' },
  }],
});
```

This config intentionally omits `PUBLIC_JETS_GHOST_E2E`; it qualifies the actual runtime in the currently installed Google Chrome on the available Apple Silicon Mac, not Playwright Chromium or the fake runtime. Trace, screenshot, and video capture stay disabled because they can retain signed delivery values or answer content. Other hardware and browsers are not emulated and do not block this release.

- [ ] **Step 3: Implement the opt-in real-model Playwright test**

The test must skip unless:

```ts
test.skip(process.env.RUN_REAL_MODEL !== '1', 'Set RUN_REAL_MODEL=1 for the 2 GB WebGPU qualification');
```

Support two explicit modes in the same test file: `qualification` and `smoke`, selected by `JETS_GHOST_REAL_MODEL_MODE`; reject any other value. Full qualification requires `process.platform === 'darwin'` and `process.arch === 'arm64'`, then records the branded Chrome, macOS, and safely exposed adapter identifiers. Open canonical `/chatbot/` and run the full `qualification` mode once on the available Mac through four exact phases:

1. **Cold activation** — launch the test in a new Playwright-owned temporary Chrome profile, assert Cache Storage, IndexedDB, localStorage, and service-worker registrations contain no Jet's Ghost application state, then use the visible compatibility and Load actions once. Record corpus/index/model transfer, validation/hydration, and engine-ready timings.
2. **Warm activation** — unload immediately, verify conversation/knowledge/engine cleanup plus SDK-singleton reset, then Load again in the same browser profile and record the same timings. Prove route re-entry initializes a fresh singleton without asserting immediate WASM/GPU-memory reclamation. This is the sole warm-load measurement; do not clear browser HTTP cache between phases.
3. **Product cases** — keep the warm engine loaded. Before every case, call New session and verify conversation deletion; never unload between cases. Run the six fixture cases in order. After each response is complete, call Playwright's built-in `page.pause()` so the operator can inspect the visible answer, citations, and source links, record a concise pass/block/accepted-limitation row directly in `docs/verification/jets-ghost-2.1.0.md`, and resume from Playwright Inspector. Do not build an overlay, review form, terminal-input protocol, or review application. The Markdown row records only case ID, disposition, the five categorical checks—useful answer, factual support, correct abstention when required, valid citations, inspectable sources—and a short non-content rationale; it does not reproduce the question or answer.
4. **Lifecycle closeout** — exercise Stop, New session, Unload, one final warm reload, and ClientRouter route-away cleanup, then verify no active engine/conversation or application reference survives and a fresh initialization succeeds.

The harness records ordered phase markers and rejects a reused/persistent user-data directory supplied from outside the run. It does not claim the browser's global provider cache is empty; “cold” means a new isolated Chrome profile for this qualification, while “warm” means a second activation in that exact profile.

In both modes, record requests in memory from before compatibility checking through final cleanup. Require zero assistant-resource requests before Load. Allow only bodyless same-origin corpus/index requests, lazy `/_astro/` chunks, the eight exact filenames directly beneath `/assistant/runtime/litert-lm/0.14.0/`, pre-existing analytics with no conversation-derived fields, and the exact pinned Hugging Face model URL followed by the redirect chain accepted by `validateModelDeliveryChain()`. Require the LiteRT WASM requests to remain same-origin and fail any request to `cdn.jsdelivr.net` or another SDK-runtime origin. Explicit corpus requests must contain no `Cookie` or `Authorization`; their injected-fetch unit tests prove `credentials: 'omit'`. Exact same-origin document, application-chunk, and runtime-asset GETs may carry browser-managed first-party cookies, but no conversational sentinel, request body, application-defined header, or variable assistant path. Pre-existing analytics may carry its ordinary browser-managed state but no conversation-derived field. Walk `Request.redirectedFrom()` in memory for the model; require the exact pinned root, HTTPS and `isTrustedModelOrigin()` for every hop, no more than `JETS_GHOST_MODEL.maxRedirects`, bodyless ordinary `GET`/`HEAD` plus browser-generated `Range` behavior, no `Authorization` or `Cookie`, and no included cross-origin credentials. Do not assert an exact redirect count, signed-query-key set, response-header structure, transient CDN path, Xet address, ETag, linked hash, or provider-declared size. Submit distinctive sentinel prompt and selected-source strings and fail if either appears in any URL, query, header, or body. Reject nonallowlisted origins, paths, request bodies, and application-defined credential/custom headers. Never print or persist a complete signed URL, query value, signature, policy, cookie, raw sensitive header, transient path, or raw request object. Browser observation proves delivery containment and privacy only; it does not claim the LiteRT-consumed bytes were independently hashed.

In `smoke` mode, skip cold/warm benchmarking and the full fixture. Run exactly `showcase-rch-claim` and `unsupported-private-note` in a fresh session each, pausing after each for the same concise visible review. Assert one supported grounded answer with a usable citation/source, one explicit abstention about a private claim absent from the eligible corpus, the network allowlist, and final Unload/cleanup. This mode is reused against final Preview and Production; it does not repeat the six-case qualification.

Emit only concise non-content measurements to the terminal: mode, case ID, corpus/index/config versions, browser version, cold/warm/model/corpus/index timings, first-token and total-response timings, citation-resolved and abstention booleans, privacy/lifecycle pass, and device-loss count. The operator copies the actual measurements and categorical dispositions into `docs/verification/jets-ghost-2.1.0.md`. Do not write a bespoke result schema or persist question/prompt fields, generated responses, conversation history, selected source text, temporary profile paths, raw headers, full signed URLs or values, authorization/cookie data, screenshots, traces, or video. Do not compute an aggregate score or package qualification output.

- [ ] **Step 4: Add direct Mac qualification and deployment-smoke commands**

```json
{
  "qualify:jets-ghost:mac": "cross-env RUN_REAL_MODEL=1 JETS_GHOST_REAL_MODEL_MODE=qualification playwright test --config=playwright.real-model.config.ts --project=chrome-real-model",
  "smoke:jets-ghost": "cross-env RUN_REAL_MODEL=1 JETS_GHOST_REAL_MODEL_MODE=smoke playwright test --config=playwright.real-model.config.ts --project=chrome-real-model"
}
```

These scripts call Playwright directly. Do not add device slugs, a cross-platform qualification orchestrator, stdin handling, a result validator, a persisted result schema, or a second review UI. `REAL_MODEL_BASE_URL` selects Preview or Production for smoke mode; when absent, Playwright builds and serves the local candidate.

- [ ] **Step 5: Verify fixture shape without downloading the model**

Create `tests/unit/jets-ghost/productAcceptance.test.ts` to enforce exactly six unique cases, exact category counts `2/1/1/2`, the six fixed IDs above, source-subset rules, required facts and source IDs for supported cases, no required source/fact for abstention cases, at least two expected sources for the cross-document case, and the exact two-case smoke subset. Statically inspect the manual spec, real-model config, and package scripts to prove there is one qualification mode, one smoke mode, no review-overlay import, no device slug/matrix, no orchestrator or result-validator command, no persisted result path, and trace/screenshot/video capture disabled.

Run:

```bash
npm run test -- tests/unit/jets-ghost/productAcceptance.test.ts
```

- [ ] **Step 6: Commit**

```bash
git add tests/fixtures/jets-ghost/product-acceptance.json tests/unit/jets-ghost/productAcceptance.test.ts playwright.real-model.config.ts tests/manual/jets-ghost-real-model.spec.ts package.json
git commit -m "test(chatbot): add product acceptance qualification"
```

### Task 12: Review and implement model/library license obligations

**Files:**
- Create: `docs/verification/jets-ghost-licenses.md`
- Modify if required by the review: `README.md`
- Modify if required by the review: `src/pages/chatbot.astro`

**Interfaces:**
- Produces: reviewed evidence that the exact Gemma and LiteRT-LM artifacts may be used as designed, plus every required public/repository notice.
- Consumes: pinned model revision/SHA, package-lock dependency graph, Gemma terms/model card, LiteRT-LM/transitive licenses, and `minisearch@7.2.0`/`stemmer@2.0.1` licenses.

- [ ] **Step 1: Inventory exact artifacts and authoritative terms**

Record the pinned model repository/revision, filename, size, SHA-256, model-card URL, applicable Gemma terms URL/version/date, `@litert-lm/core@0.14.0`, `minisearch@7.2.0`, `stemmer@2.0.1`, and every bundled/transitive license and notice. Use authoritative model/vendor/package sources. Distinguish legal/model attribution from the repository's intentionally removed agent-attribution commit rule.

- [ ] **Step 2: Resolve distribution and disclosure questions**

Document whether browser download from Hugging Face, browser caching, bundling LiteRT-LM assets, public model naming, and any future mirroring are permitted. List every required attribution, terms link, acceptable-use notice, license file, or UI disclosure. Any unresolved obligation blocks release and retention of `noindex`.

- [ ] **Step 3: Implement and verify required notices**

Add only notices required by the reviewed terms. If no public notice is required, record that conclusion and its source rather than inventing attribution. Verify README/UI links resolve, package/license versions match the lockfile, and the displayed model identity matches the pinned artifact.

- [ ] **Step 4: Commit the license evidence**

```bash
git add docs/verification/jets-ghost-licenses.md
# Add README.md and src/pages/chatbot.astro only if the review required changes.
git commit -m "docs(chatbot): record model and runtime licensing"
```

### Task 13: Qualify Gemma E2B and release Jet's Ghost 2.1.0

**Files:**
- Modify: `src/pages/chatbot.astro`
- Modify: `astro.config.mjs`
- Modify: `README.md`
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `tests/e2e/jets-ghost.spec.ts`
- Modify: `tests/e2e/site.spec.ts`
- Modify: `tests/deployment/core-production.spec.ts`
- Modify: `tests/unit/ops/archiveLegacyDocs.test.ts`
- Create: `docs/verification/jets-ghost-2.1.0.md`
- Create: `docs/verification/jets-ghost-2.1.0-consolidation.md`

**Interfaces:**
- Produces: one canonical `/Users/jet/jet-web` repository, public indexed Jet's Ghost at canonical `https://jetsanchez.com/chatbot/`, and application version `2.1.0`.
- Consumes: the exact completed Task 12 implementation tree, one full real-model qualification from the available Apple Silicon Mac, Task 12 licensing evidence, exact-commit Preview verification, and proportional Preview/Production smokes.

- [ ] **Step 1: Consolidate into the canonical repository and audit modernization residue**

Do not begin this step until Tasks 1–12 are complete, reviewed, committed, and clean in `/Users/jet/jet-web-v1-modernization`. Until then, the sibling worktree remains intact. The integration is local-only: it does not push, deploy, tag, or mutate a remote.

First require the canonical checkout to have no staged or unstaged tracked changes. Preserve its untracked user content through a private, mode-`0700` state directory inside the Git common directory. Record paths and non-content metadata—file type, inode, byte size, permissions, modification time, and change time—without opening or hashing file contents. The state directory deliberately survives command-block exits and is removed only after consolidation completes:

```bash
set -euo pipefail
CANONICAL_ROOT=/Users/jet/jet-web
IMPLEMENTATION_ROOT=/Users/jet/jet-web-v1-modernization
COMMON_GIT_DIR=$(git -C "$CANONICAL_ROOT" rev-parse --path-format=absolute --git-common-dir)
STATE_DIR="$COMMON_GIT_DIR/codex-jets-ghost-2.1-consolidation"
if test -e "$STATE_DIR"; then
  if test -f "$STATE_DIR/bootstrap.complete"; then
    IMPLEMENTATION_SHA=$(<"$STATE_DIR/implementation-sha")
    IMPLEMENTATION_TREE=$(<"$STATE_DIR/implementation-tree")
    test "$(git -C "$CANONICAL_ROOT" rev-parse "${IMPLEMENTATION_SHA}^{tree}")" = "$IMPLEMENTATION_TREE"
    case "$(git -C "$CANONICAL_ROOT" branch --show-current)" in
      codex/jets-ghost-2.1-canonical)
        git -C "$CANONICAL_ROOT" merge-base --is-ancestor "$IMPLEMENTATION_SHA" HEAD
        ;;
      codex/jets-ghost-2.1)
        test -f "$STATE_DIR/cleanup.complete"
        test -f "$STATE_DIR/residue.complete"
        git -C "$CANONICAL_ROOT" merge-base --is-ancestor "$(<"$STATE_DIR/residue-commit")" HEAD
        test ! -e "$IMPLEMENTATION_ROOT"
        ;;
      *) echo 'Unknown completed consolidation branch state.' >&2; exit 1 ;;
    esac
    exit 0
  fi
  test -z "$(git -C "$CANONICAL_ROOT" status --porcelain=v1 --untracked-files=no)"
  case "$(git -C "$CANONICAL_ROOT" branch --show-current)" in
    codex/jets-ghost-full-screen-chat) ;;
    codex/jets-ghost-2.1-canonical)
      test -f "$STATE_DIR/implementation-sha"
      test "$(git -C "$CANONICAL_ROOT" rev-parse HEAD)" = "$(<"$STATE_DIR/implementation-sha")"
      git -C "$CANONICAL_ROOT" switch codex/jets-ghost-full-screen-chat
      git -C "$CANONICAL_ROOT" branch -D codex/jets-ghost-2.1-canonical
      ;;
    *) echo 'Unknown partial consolidation branch state.' >&2; exit 1 ;;
  esac
  rm -rf "$STATE_DIR"
fi
test "$(git -C "$CANONICAL_ROOT" branch --show-current)" = codex/jets-ghost-full-screen-chat
test -z "$(git -C "$CANONICAL_ROOT" status --porcelain=v1 --untracked-files=no)"
test ! -e "$CANONICAL_ROOT/docs/verification/jets-ghost-2.1.0-consolidation.md"
test ! -e "$IMPLEMENTATION_ROOT/docs/verification/jets-ghost-2.1.0-consolidation.md"
canonical_branch=$(git -C "$CANONICAL_ROOT" branch --list codex/jets-ghost-2.1-canonical --format='%(refname:short)')
test -z "$canonical_branch"
IMPLEMENTATION_SHA=$(git -C "$IMPLEMENTATION_ROOT" rev-parse HEAD)
IMPLEMENTATION_TREE=$(git -C "$IMPLEMENTATION_ROOT" rev-parse "${IMPLEMENTATION_SHA}^{tree}")
umask 077
install -d -m 700 "$STATE_DIR"
touch "$STATE_DIR/report-path-absent"
printf '%s\n' "$IMPLEMENTATION_SHA" > "$STATE_DIR/implementation-sha"
printf '%s\n' "$IMPLEMENTATION_TREE" > "$STATE_DIR/implementation-tree"
git -C "$CANONICAL_ROOT" ls-files --others --exclude-standard -z > "$STATE_DIR/untracked-before.z"
while IFS= read -r -d '' path; do
  stat -f '%HT\t%i\t%z\t%Lp\t%m\t%c' "$CANONICAL_ROOT/$path"
done < "$STATE_DIR/untracked-before.z" > "$STATE_DIR/untracked-before.meta"
git -C "$CANONICAL_ROOT" switch -c codex/jets-ghost-2.1-canonical "$IMPLEMENTATION_SHA"
test "$(git -C "$CANONICAL_ROOT" rev-parse HEAD)" = "$IMPLEMENTATION_SHA"
test "$(git -C "$CANONICAL_ROOT" rev-parse HEAD^{tree})" = "$IMPLEMENTATION_TREE"
touch "$STATE_DIR/bootstrap.complete"
```

The bootstrap is phase-aware. A completed marker validates and resumes the canonical integration branch. An incomplete state may be reset only while tracked state is clean and the partial branch still equals the saved implementation SHA; unknown states fail closed.

From the canonical folder, perform an explicit residue audit covering every category below. Remove anything obsolete; retain only infrastructure that is intentional and reusable. Record each disposition in `docs/verification/jets-ghost-2.1.0-consolidation.md`, separate from feature-implementation status:

- temporary/prototype routes and route reversals;
- migration-only scripts, compatibility shims, and one-off scaffolding;
- staging/generated artifacts outside intentional build output;
- unused direct dependencies and obsolete configuration;
- stale plans, docs, source links, route references, and modernization naming;
- production reachability of the fake runtime or `PUBLIC_JETS_GHOST_E2E` enablement;
- intentional permanent test and verification infrastructure, listed explicitly with why it remains.

Install the exact lockfile first. Search only Git-tracked paths; never recursively search a directory that may contain untracked drafts. Review every match rather than requiring zero matches: permanent redirects, the dormant Tools contract, a fail-closed test-only fake-runtime seam, and historical verification records may remain only with an explicit owner. Include one report row for every direct dependency and retained match category; remove entries without a current production, build, test, redirect, or verification purpose.

```bash
set -euo pipefail
CANONICAL_ROOT=/Users/jet/jet-web
cd "$CANONICAL_ROOT"
test "$(pwd -P)" = "$CANONICAL_ROOT"
COMMON_GIT_DIR=$(git rev-parse --path-format=absolute --git-common-dir)
STATE_DIR="$COMMON_GIT_DIR/codex-jets-ghost-2.1-consolidation"
test -f "$STATE_DIR/bootstrap.complete"
if test -f "$STATE_DIR/residue.complete"; then exit 0; fi
IMPLEMENTATION_SHA=$(<"$STATE_DIR/implementation-sha")
IMPLEMENTATION_TREE=$(<"$STATE_DIR/implementation-tree")
test "$(git branch --show-current)" = codex/jets-ghost-2.1-canonical
test "$(git rev-parse HEAD)" = "$IMPLEMENTATION_SHA"
test "$(git rev-parse "${IMPLEMENTATION_SHA}^{tree}")" = "$IMPLEMENTATION_TREE"
npm ci
set +e
git grep -n -i -E -- 'v1-modernization|prototype|migration|compat(ibility)?|shim|staging|one-off|temporary|todo|original plan'
status=$?
set -e
test "$status" -le 1
set +e
git grep -n -E -- 'PUBLIC_JETS_GHOST_E2E|fakeRuntime|/tools/chatbot|/tools/'
status=$?
set -e
test "$status" -le 1
npm ls --all
npm run verify:docs
npm run verify:content
```

Make executable verification draft-agnostic. Remove the hard-coded draft route assertion from `tests/e2e/site.spec.ts`; retire or generalize any cleanup script/test that depends on a current untracked filename or status; and keep qualification fixtures synthetic. Historical released documentation may describe the past cleanup, but no current `src/`, `scripts/`, `tests/`, package/config, or qualification file may name a current untracked MDX file. Enforce that generically from the private path list without printing or persisting draft names:

```bash
set -euo pipefail
CANONICAL_ROOT=/Users/jet/jet-web
cd "$CANONICAL_ROOT"
test "$(pwd -P)" = "$CANONICAL_ROOT"
COMMON_GIT_DIR=$(git rev-parse --path-format=absolute --git-common-dir)
STATE_DIR="$COMMON_GIT_DIR/codex-jets-ghost-2.1-consolidation"
test -f "$STATE_DIR/bootstrap.complete"
if test -f "$STATE_DIR/residue.complete"; then exit 0; fi
IMPLEMENTATION_SHA=$(<"$STATE_DIR/implementation-sha")
test "$(git branch --show-current)" = codex/jets-ghost-2.1-canonical
test "$(git rev-parse HEAD)" = "$IMPLEMENTATION_SHA"
while IFS= read -r -d '' path; do
  case "$path" in
    Untracked/*.mdx)
      basename=${path##*/}
      set +e
      git grep -qF -e "$basename" -- src scripts tests package.json package-lock.json astro.config.mjs vercel.json
      status=$?
      set -e
      case "$status" in
        0) echo 'Executable tracked files depend on a current untracked MDX filename.' >&2; exit 1 ;;
        1) ;;
        *) echo 'Unable to complete the tracked executable draft-dependency search.' >&2; exit 1 ;;
      esac
      ;;
  esac
done < "$STATE_DIR/untracked-before.z"
```

After every disposition and draft-agnostic edit is complete, create the initial consolidation report, run the full canonical gate, then commit every approved tracked modification/deletion plus the report. `git add -u` cannot stage user-owned untracked files; any additional new permanent file requires an explicit `git add -- <path>` and a matching report row. The post-commit tracked worktree must be clean.

```bash
set -euo pipefail
CANONICAL_ROOT=/Users/jet/jet-web
cd "$CANONICAL_ROOT"
test "$(pwd -P)" = "$CANONICAL_ROOT"
COMMON_GIT_DIR=$(git rev-parse --path-format=absolute --git-common-dir)
STATE_DIR="$COMMON_GIT_DIR/codex-jets-ghost-2.1-consolidation"
test -f "$STATE_DIR/bootstrap.complete"
if test -f "$STATE_DIR/residue.complete"; then
  RESIDUE_COMMIT=$(<"$STATE_DIR/residue-commit")
  git merge-base --is-ancestor "$RESIDUE_COMMIT" HEAD
  exit 0
fi
IMPLEMENTATION_SHA=$(<"$STATE_DIR/implementation-sha")
test "$(git branch --show-current)" = codex/jets-ghost-2.1-canonical
test -f "$STATE_DIR/report-path-absent"
if test "$(git rev-parse HEAD)" != "$IMPLEMENTATION_SHA"; then
  test "$(git rev-parse HEAD^)" = "$IMPLEMENTATION_SHA"
  test "$(git log -1 --format=%s)" = 'chore(repo): resolve modernization residue'
  git ls-files --error-unmatch docs/verification/jets-ghost-2.1.0-consolidation.md >/dev/null
  test -z "$(git status --porcelain=v1 --untracked-files=no)"
  git rev-parse HEAD > "$STATE_DIR/residue-commit"
  touch "$STATE_DIR/residue.complete"
  exit 0
fi
npm run verify:all
npm run build
git diff --check
git add -u
git add -- docs/verification/jets-ghost-2.1.0-consolidation.md
git diff --cached --check
staged_untracked=$(git diff --cached --name-only -- Untracked)
test -z "$staged_untracked"
git commit -m "chore(repo): resolve modernization residue"
test -z "$(git status --porcelain=v1 --untracked-files=no)"
git rev-parse HEAD > "$STATE_DIR/residue-commit"
touch "$STATE_DIR/residue.complete"
```

Now recapture and compare the private untracked path and metadata manifests. Only after they match exactly, the full canonical gate has passed, and the residue commit exists may the temporary worktree be removed. Require its tracked and nonignored state to be clean. Inventory ignored entries privately and allow forced removal only when every ignored path is a known disposable dependency, build/test output, Vercel link, macOS metadata file, or `.superpowers/sdd` execution scratch. Any environment file, image-staging asset, or other unmatched ignored path stops cleanup for inspection. Then delete only local branches proven integrated, rename the canonical branch, and verify one folder/worktree remains:

```bash
set -euo pipefail
CANONICAL_ROOT=/Users/jet/jet-web
IMPLEMENTATION_ROOT=/Users/jet/jet-web-v1-modernization
cd "$CANONICAL_ROOT"
test "$(pwd -P)" = "$CANONICAL_ROOT"
COMMON_GIT_DIR=$(git rev-parse --path-format=absolute --git-common-dir)
STATE_DIR="$COMMON_GIT_DIR/codex-jets-ghost-2.1-consolidation"
test -f "$STATE_DIR/bootstrap.complete"
test -f "$STATE_DIR/residue.complete"
IMPLEMENTATION_SHA=$(<"$STATE_DIR/implementation-sha")
IMPLEMENTATION_TREE=$(<"$STATE_DIR/implementation-tree")
RESIDUE_COMMIT=$(<"$STATE_DIR/residue-commit")
test "$(git rev-parse "${IMPLEMENTATION_SHA}^{tree}")" = "$IMPLEMENTATION_TREE"
git merge-base --is-ancestor "$IMPLEMENTATION_SHA" "$RESIDUE_COMMIT"
git merge-base --is-ancestor "$RESIDUE_COMMIT" HEAD
if test -f "$STATE_DIR/cleanup.complete"; then
  test "$(git branch --show-current)" = codex/jets-ghost-2.1
  test ! -e "$IMPLEMENTATION_ROOT"
  test "$(git worktree list --porcelain | awk '$1=="worktree"{count++} END{print count+0}')" = 1
  test "$(find /Users/jet -maxdepth 1 -type d -name 'jet-web*' | wc -l | tr -d ' ')" = 1
  exit 0
fi
case "$(git branch --show-current)" in
  codex/jets-ghost-2.1-canonical|codex/jets-ghost-2.1) ;;
  *) echo 'Unexpected canonical branch during cleanup.' >&2; exit 1 ;;
esac
test "$(git rev-parse HEAD)" = "$RESIDUE_COMMIT"
feature_branch=$(git branch --list codex/jets-ghost-2.1 --format='%(refname:short)')
ui_branch=$(git branch --list codex/jets-ghost-full-screen-chat --format='%(refname:short)')
if test -n "$feature_branch" && test "$(git branch --show-current)" != codex/jets-ghost-2.1; then
  test "$(git rev-parse codex/jets-ghost-2.1)" = "$IMPLEMENTATION_SHA"
  git merge-base --is-ancestor codex/jets-ghost-2.1 HEAD
fi
if test -n "$ui_branch"; then
  git merge-base --is-ancestor codex/jets-ghost-full-screen-chat HEAD
fi
git ls-files --others --exclude-standard -z > "$STATE_DIR/untracked-after.z"
while IFS= read -r -d '' path; do
  stat -f '%HT\t%i\t%z\t%Lp\t%m\t%c' "$CANONICAL_ROOT/$path"
done < "$STATE_DIR/untracked-after.z" > "$STATE_DIR/untracked-after.meta"
cmp "$STATE_DIR/untracked-before.z" "$STATE_DIR/untracked-after.z"
cmp "$STATE_DIR/untracked-before.meta" "$STATE_DIR/untracked-after.meta"
if test -e "$IMPLEMENTATION_ROOT"; then
  test "$(git -C "$IMPLEMENTATION_ROOT" branch --show-current)" = codex/jets-ghost-2.1
  test "$(git -C "$IMPLEMENTATION_ROOT" rev-parse HEAD)" = "$IMPLEMENTATION_SHA"
  test "$(git -C "$IMPLEMENTATION_ROOT" rev-parse HEAD^{tree})" = "$IMPLEMENTATION_TREE"
  test -z "$(git -C "$IMPLEMENTATION_ROOT" status --porcelain=v1 --untracked-files=all)"
  git -C "$IMPLEMENTATION_ROOT" status --porcelain=v1 --ignored=matching -z > "$STATE_DIR/implementation-ignored.z"
  while IFS= read -r -d '' record; do
    test "${record:0:2}" = '!!'
    path=${record:3}
    case "$path" in
      .DS_Store|*/.DS_Store|.astro/|.astro/*|.superpowers/sdd/|.superpowers/sdd/*|.vercel/|.vercel/*|coverage/|coverage/*|dist/|dist/*|node_modules/|node_modules/*|playwright-report/|playwright-report/*|test-results/|test-results/*|npm-debug.log*|yarn-debug.log*|yarn-error.log*|pnpm-debug.log*|test-config.json) ;;
      *) echo 'Unexpected ignored implementation-worktree residue; inspect before removal.' >&2; exit 1 ;;
    esac
  done < "$STATE_DIR/implementation-ignored.z"
  touch "$STATE_DIR/removal.authorized"
  git worktree remove --force "$IMPLEMENTATION_ROOT"
else
  test -f "$STATE_DIR/removal.authorized"
fi
git worktree prune
registered_worktrees=$(git worktree list --porcelain)
case "$registered_worktrees" in
  *"worktree $IMPLEMENTATION_ROOT"*) exit 1 ;;
esac
if test -n "$feature_branch" && test "$(git branch --show-current)" != codex/jets-ghost-2.1; then
  test "$(git rev-parse codex/jets-ghost-2.1)" = "$IMPLEMENTATION_SHA"
  git merge-base --is-ancestor codex/jets-ghost-2.1 HEAD
  git branch -d codex/jets-ghost-2.1
fi
if test -n "$ui_branch"; then
  git merge-base --is-ancestor codex/jets-ghost-full-screen-chat HEAD
  git branch -d codex/jets-ghost-full-screen-chat
fi
if test "$(git branch --show-current)" = codex/jets-ghost-2.1-canonical; then
  git branch -m codex/jets-ghost-2.1
fi
test ! -e "$IMPLEMENTATION_ROOT"
test "$(git worktree list --porcelain | awk '$1=="worktree"{count++} END{print count+0}')" = 1
test "$(find /Users/jet -maxdepth 1 -type d -name 'jet-web*' | wc -l | tr -d ' ')" = 1
test "$(git branch --show-current)" = codex/jets-ghost-2.1
touch "$STATE_DIR/cleanup.complete"
```

Finally update the consolidation report with the worktree/branch cleanup result, verify and commit that evidence, compare the private metadata once more, and delete the private state directory. This second documentation-only commit keeps the cleanup claim truthful while the first commit provides the clean precondition for safe worktree removal.

```bash
set -euo pipefail
CANONICAL_ROOT=/Users/jet/jet-web
cd "$CANONICAL_ROOT"
test "$(pwd -P)" = "$CANONICAL_ROOT"
COMMON_GIT_DIR=$(git rev-parse --path-format=absolute --git-common-dir)
STATE_DIR="$COMMON_GIT_DIR/codex-jets-ghost-2.1-consolidation"
test -f "$STATE_DIR/cleanup.complete"
RESIDUE_COMMIT=$(<"$STATE_DIR/residue-commit")
test "$(git branch --show-current)" = codex/jets-ghost-2.1
if test "$(git rev-parse HEAD)" != "$RESIDUE_COMMIT"; then
  test "$(git rev-parse HEAD^)" = "$RESIDUE_COMMIT"
  test "$(git log -1 --format=%s)" = 'docs(repo): record canonical consolidation'
  test -z "$(git status --porcelain=v1 --untracked-files=no)"
else
  npm run verify:docs
  git diff --check
  git add -- docs/verification/jets-ghost-2.1.0-consolidation.md
  git diff --cached --check
  git commit -m "docs(repo): record canonical consolidation"
  test -z "$(git status --porcelain=v1 --untracked-files=no)"
fi
git ls-files --others --exclude-standard -z > "$STATE_DIR/untracked-final.z"
while IFS= read -r -d '' path; do
  stat -f '%HT\t%i\t%z\t%Lp\t%m\t%c' "$CANONICAL_ROOT/$path"
done < "$STATE_DIR/untracked-final.z" > "$STATE_DIR/untracked-final.meta"
cmp "$STATE_DIR/untracked-before.z" "$STATE_DIR/untracked-final.z"
cmp "$STATE_DIR/untracked-before.meta" "$STATE_DIR/untracked-final.meta"
rm -rf "$STATE_DIR"
```

- [ ] **Step 2: Run the one required real-model Mac qualification**

Before the approximately 2 GB load, create `docs/verification/jets-ghost-2.1.0.md` with its title, tested-system section, measurement section, six-case review table, privacy/lifecycle section, limitations section, and Task 12 license link. Populate it during the run rather than using a separate review artifact. Then verify the pinned model delivery chain and run the six-case qualification once in the currently installed branded Chrome on the available Apple Silicon Mac:

```bash
set -euo pipefail
cd /Users/jet/jet-web
test "$(pwd -P)" = /Users/jet/jet-web
mkdir -p test-results
npx tsx scripts/verify-model-delivery.ts --hash-artifact --output=test-results/jets-ghost-2.1.0-mac-model-delivery.json
npm run qualify:jets-ghost:mac
```

Abort if the initial URL changes, a redirect leaves the trusted HTTPS origin policy or exceeds the bound, the request-privacy contract fails, the independently counted complete artifact is not exactly `2,008,432,640` bytes, or its actual bytes do not hash to the pinned SHA-256. Do not block on a changed redirect count within the bound, signed-query structure, response-header structure, transient CDN path, ETag, repository metadata, linked hash, or provider-declared size. During the headed run, complete each Playwright Inspector pause only after recording its concise Markdown review row. Record the actual macOS, branded Chrome, Apple Silicon and adapter identity; cold/warm model, corpus, and index load/hydration; configured context and serialized-budget breakdown; visible memory pressure or device loss; first-token and total-response latency; Stop; New session; Unload; reload; route cleanup; all six dispositions; citation/source inspection; both abstentions; and privacy allowlist result. Do not run the six-case set on Preview or Production, synthesize unavailable device results, or block release because Windows, lower-memory, mobile, or other configurations were not tested.

- [ ] **Step 3: Apply the release invariants and product dispositions**

Release only when:

```text
Gemma E2B loads, streams, cancels, resets, unloads, and recovers reliably on the tested Mac
LiteRT WASM loads only from /assistant/runtime/litert-lm/0.14.0/ after consent; no SDK-runtime CDN request occurs
eligible corpus inclusion = 100%; ineligible inclusion = 0
manifest/content/index hashes and versions match exactly
indexed chunk IDs = eligible chunk IDs, with no missing, duplicate, or unknown IDs
qualification independently downloaded the complete pinned artifact, counted exactly 2,008,432,640 bytes, and hashed those bytes to the pinned SHA-256
runtime delivery starts at the exact pinned URL, remains within the trusted HTTPS origin/redirect policy, and transmits no application or conversation data
verification documentation states that LiteRT-LM 0.14.0 URL loading does not independently hash each visitor's executed model bytes
MiniSearch search has no result limit or pre-packing candidate cap
serialized knowledge JSON including metadata/escaping <= 9,011 estimated tokens
serialized prompt + 1,024 response reserve + 3,277 estimator headroom <= 16,384 tokens
every LiteRT conversation is configured with maxOutputTokens = 1,024
no silent model or prompt truncation occurs
at least two complete user/assistant turns fit without discarding grounding
all six fixed product cases have completed one human review and a disposition on the tested Mac
no representative product-significant case remains dispositioned as block
accepted limitations are explicitly nonrepresentative and have written rationale
both unsupported cases abstain
every rendered citation resolves to selected evidence
artifact/model load, first-token, and total-response measurements are documented for the tested Mac
100% of observed requests satisfy the privacy allowlist
no repeatable device loss or unrecovered cleanup failure
Stop, New session, Unload, fresh SDK initialization, reload, and ClientRouter route-away pass on the tested Mac; no immediate WASM/GPU reclamation claim is made
model, runtime, MiniSearch, stemmer, and transitive license/attribution obligations are resolved
```

Do not compute an aggregate retrieval or answer-quality score. If a gate fails, do not release or remove `noindex`; diagnose the concrete rank-and-pack, prompt, Gemma, citation, runtime, licensing, or UX defect. Do not open another retrieval-candidate experiment or fallback-selector plan as the default response. Untested hardware, absence of release-asset packaging, and omission of an optional audit ceremony are not failures.

- [ ] **Step 4: Complete public-release metadata**

After passing every gate and the Task 12 license gate, replace hard `noindex={true}` with a build-target guard that keeps local and Vercel Preview candidates noindexed while allowing only a Production build of this approved commit to become indexable:

```astro
const noindex = process.env.VERCEL_ENV !== 'production';
```

Pass that value to `BaseLayout`. Use the same target guard in the sitemap filter: exact `/tools/` and descendants are always excluded; canonical `/chatbot/` remains excluded outside Production and enters the Production sitemap exactly once; unrelated `/toolshed/`-style routes remain unaffected. Update README from qualification to an available experimental first-class experience and include the measured support statement. Do not generalize beyond tested devices. Update the route test for the target guard and sitemap boundary. Make the deployment suite require `EXPECTED_JETS_GHOST_NOINDEX=1` for final Preview and `0` for Production, failing if the variable is absent, the meta-robots state disagrees, or exact `/chatbot/` sitemap membership is not the inverse.

The deployment suite retains the core assertions and adds the complete route/SEO matrix: terminal `/chatbot/ === 200` with no `Location`; `/chatbot === 308` with `Location: /chatbot/`; `/tools/chatbot === 308` with `Location: /tools/chatbot/`; `/tools/chatbot/ === 308` with `Location: /chatbot/`; `/tools === 308` with `Location: /tools/`; `/tools/` is `noindex` and absent from sitemap/navigation; `/toolshed/` is not captured by a Tools rule. It also requires exact canonical/`og:url`/WebPage/SoftwareApplication trailing-slash agreement, Ghost href `/chatbot/` in primary/structured/no-script navigation, `/about` and `/about/` correctness, both retired canonical `404`s and their sitemap/RSS absence, and extension-correct `/robots.txt`, `/rss.xml`, and sitemap XML endpoints. Preview requires chatbot `noindex` plus zero sitemap membership; Production requires index-follow plus exactly one membership.

- [ ] **Step 5: Bump the minor version**

Run:

```bash
set -euo pipefail
cd /Users/jet/jet-web
test "$(pwd -P)" = /Users/jet/jet-web
npm version 2.1.0 --no-git-tag-version
```

- [ ] **Step 6: Finalize and review the verification evidence**

Complete `docs/verification/jets-ghost-2.1.0.md` as a concise human-readable record with:

- the tested Apple Silicon hardware/adapter, macOS version, and installed branded Chrome version;
- qualification-time model verification mode, exact pinned initial URL/revision, independently counted complete size, independently calculated SHA-256, trusted hostnames, and redirect depth;
- an explicit statement that LiteRT-LM `0.14.0` supports URL, `Blob`, and `ReadableStream<Uint8Array>` model sources; this release deliberately passes the URL, does not add app-owned incremental hashing/buffering, does not perform a second verification download, and limits runtime guarantees to consent, pinned URL usage, trusted HTTPS delivery containment, redirect bounds, and request privacy;
- the exact same-origin LiteRT WASM path, proof that no SDK-runtime CDN request occurred, fresh initialization after unload/route re-entry, and the known `LiteRtLm.delete()` no-op limitation without an immediate GPU-memory-reclamation claim;
- corpus, index, configuration, MiniSearch, and stemmer versions;
- context-budget breakdown and artifact size/fetch/hash/parse/hydration measurements;
- cold/warm load, first-token, total-response, cancellation, reset, unload, reload, route-cleanup, and visible memory/device-loss observations;
- exactly six case rows containing only case ID, disposition, useful-answer, factual-support, abstention, citation-validity, source-inspectability, and a short non-content rationale;
- privacy allowlist, citation-resolution, and both unsupported-case abstention results;
- package/model pin, Task 12 license-evidence link, unsupported/unqualified configurations, and known limitations;
- the candidate decision to proceed to exact noindexed Preview verification.

Do not include prompts, questions, responses, conversation history, selected source text, complete signed URLs/values, signatures, policies, transient CDN paths, provider identity headers, ETags, linked hashes/sizes, raw sensitive request data, reviewer identity, an aggregate quality percentage, unavailable-device placeholders, qualification checksums, or release-asset instructions. Do not describe provider metadata as artifact identity or claim per-browser runtime SHA-256 verification. Do not claim Preview, Production, or release completion inside this predeployment commit; those are live gates run against the exact SHA after the commit exists.

- [ ] **Step 7: Run all non-model gates again**

```bash
set -euo pipefail
cd /Users/jet/jet-web
test "$(pwd -P)" = /Users/jet/jet-web
npm ci
npm run verify:all
git diff --check
```

Expected: all pass.

- [ ] **Step 8: Commit the release candidate**

```bash
set -euo pipefail
cd /Users/jet/jet-web
test "$(pwd -P)" = /Users/jet/jet-web
git add src/pages/chatbot.astro astro.config.mjs README.md package.json package-lock.json tests/e2e/jets-ghost.spec.ts tests/deployment/core-production.spec.ts docs/verification/jets-ghost-2.1.0.md
git diff --cached --check
git diff --cached --name-only
git commit -m "feat(chatbot): release local Jet's Ghost"
test -z "$(git status --porcelain=v1 --untracked-files=no)"
```

- [ ] **Step 9: Qualify the exact final preview, then promote and read back production**

Push the final release-candidate commit through the user-approved remote workflow and wait for its Git-backed Vercel Preview. Production remains on the prior noindexed release throughout this blocking qualification. Set `CANDIDATE_URL` to the preview hostname, then bind and qualify that exact commit:

```bash
set -euo pipefail
cd /Users/jet/jet-web
test "$(pwd -P)" = /Users/jet/jet-web
EXPECTED_SHA=$(git rev-parse HEAD)
test -n "$CANDIDATE_URL"
mkdir -p test-results
umask 077
EVIDENCE_TMP=$(mktemp -d)
chmod 700 "$EVIDENCE_TMP"
trap 'rm -rf "$EVIDENCE_TMP"' EXIT HUP INT TERM
npx --yes vercel@55.0.0 inspect "$CANDIDATE_URL" --wait --timeout=5m --format=json > "$EVIDENCE_TMP/final-preview-inspect.raw.json"
npx tsx scripts/sanitize-vercel-evidence.ts sanitize-inspect --input="$EVIDENCE_TMP/final-preview-inspect.raw.json" --output="$EVIDENCE_TMP/final-preview-inspect.json"
PREVIEW_DEPLOYMENT_ID=$(EVIDENCE_TMP="$EVIDENCE_TMP" node -e "const d=require(process.env.EVIDENCE_TMP+'/final-preview-inspect.json'); process.stdout.write(d.id)")
npx --yes vercel@55.0.0 api "/v13/deployments/$PREVIEW_DEPLOYMENT_ID" --raw > "$EVIDENCE_TMP/final-preview-deployment.raw.json"
npx tsx scripts/sanitize-vercel-evidence.ts sanitize-deployment --input="$EVIDENCE_TMP/final-preview-deployment.raw.json" --output=test-results/jets-ghost-2.1.0-final-preview-vercel-deployment.json
EXPECTED_SHA="$EXPECTED_SHA" node -e "const d=require('./test-results/jets-ghost-2.1.0-final-preview-vercel-deployment.json'); if(d.readyState!=='READY'||d.target==='production'||d.gitSource?.sha!==process.env.EXPECTED_SHA) process.exit(1)"
npx tsx scripts/sanitize-vercel-evidence.ts verify-safe --input=test-results/jets-ghost-2.1.0-final-preview-vercel-deployment.json
rm -rf "$EVIDENCE_TMP"
trap - EXIT HUP INT TERM
EXPECTED_JETS_GHOST_NOINDEX=1 PRODUCTION_ORIGIN="https://$CANDIDATE_URL" npm run verify:production
npx tsx scripts/verify-model-delivery.ts --transport-only --output=test-results/jets-ghost-2.1.0-final-preview-model-delivery.json
npx cross-env REAL_MODEL_BASE_URL="https://$CANDIDATE_URL" npm run smoke:jets-ghost
```

This is a proportional two-case Preview smoke, not another full acceptance or 2 GB hash run. The transport-only check proves the pinned initial URL and durable redirect/origin/privacy policy; Task 13 Step 2 remains the byte-integrity proof. The smoke must prove one supported grounded answer with a valid citation and inspectable source, one unsupported abstention, privacy allowlist compliance, cleanup, exact canonical/OG/JSON-LD/navigation behavior, the complete platform-plus-explicit route matrix, About correctness, both retired `404`s, robots/sitemap/RSS behavior, exact `Cache-Control: public, max-age=31536000, immutable` on one versioned LiteRT `.wasm` response, and Preview `noindex` with zero `/chatbot/` sitemap memberships. If it fails, do not promote; the public production route remains on the earlier hard-noindex deployment. Terminal output must contain no question, response, history, selected source text, complete signed URL or value, signature, policy, transient CDN path, sensitive header, or prompt-bearing request record.

Only after the exact Preview passes may that exact commit be fast-forwarded/promoted to Production. If integration creates a merge/squash/rebase SHA, stop and repeat exact-Preview binding and the two-case Preview smoke for the new SHA. Repeat the one-Mac six-case qualification only if integration changed runtime code, corpus/index generation or content, context configuration, model/library pins, or lockfile resolution.

After exact promotion, perform production-specific readback and one two-case grounded smoke using the same harness in smoke mode:

```bash
set -euo pipefail
cd /Users/jet/jet-web
test "$(pwd -P)" = /Users/jet/jet-web
EXPECTED_SHA=$(git rev-parse HEAD)
EXPECTED_SHA="$EXPECTED_SHA" node -e "const d=require('./test-results/jets-ghost-2.1.0-final-preview-vercel-deployment.json'); if(d.gitSource?.sha!==process.env.EXPECTED_SHA) process.exit(1)"
umask 077
EVIDENCE_TMP=$(mktemp -d)
chmod 700 "$EVIDENCE_TMP"
trap 'rm -rf "$EVIDENCE_TMP"' EXIT HUP INT TERM
npx --yes vercel@55.0.0 inspect jetsanchez.com --wait --timeout=5m --format=json > "$EVIDENCE_TMP/jets-ghost-inspect.raw.json"
npx tsx scripts/sanitize-vercel-evidence.ts sanitize-inspect --input="$EVIDENCE_TMP/jets-ghost-inspect.raw.json" --output="$EVIDENCE_TMP/jets-ghost-inspect.json"
DEPLOYMENT_ID=$(EVIDENCE_TMP="$EVIDENCE_TMP" node -e "const d=require(process.env.EVIDENCE_TMP+'/jets-ghost-inspect.json'); process.stdout.write(d.id)")
npx --yes vercel@55.0.0 api "/v13/deployments/$DEPLOYMENT_ID" --raw > "$EVIDENCE_TMP/jets-ghost-deployment.raw.json"
npx tsx scripts/sanitize-vercel-evidence.ts sanitize-deployment --input="$EVIDENCE_TMP/jets-ghost-deployment.raw.json" --output=test-results/jets-ghost-2.1.0-vercel-deployment.json
EXPECTED_SHA="$EXPECTED_SHA" node -e "const d=require('./test-results/jets-ghost-2.1.0-vercel-deployment.json'); if(d.readyState!=='READY'||d.target!=='production'||d.gitSource?.sha!==process.env.EXPECTED_SHA) process.exit(1)"
npx tsx scripts/sanitize-vercel-evidence.ts verify-safe --input=test-results/jets-ghost-2.1.0-vercel-deployment.json
rm -rf "$EVIDENCE_TMP"
trap - EXIT HUP INT TERM
EXPECTED_JETS_GHOST_NOINDEX=0 npm run verify:production
npx tsx scripts/verify-model-delivery.ts --transport-only --output=test-results/jets-ghost-2.1.0-production-model-delivery.json
npx cross-env REAL_MODEL_BASE_URL=https://jetsanchez.com npm run smoke:jets-ghost
```

Production readback must prove `/chatbot/` has no `noindex`, owns exact canonical/OG/WebPage/SoftwareApplication identity and exactly one sitemap membership, and serves the exact approved SHA; the exact platform-plus-explicit chatbot route matrix; Ghost href `/chatbot/` present and Tools absent from every navigation representation; dormant `/tools/` noindexed and excluded; About and both retired-route assertions; extension-correct robots/RSS/sitemap endpoints; the exact immutable cache header on one versioned LiteRT `.wasm` response; activation/model request ordering; trusted-origin/private model delivery; one supported grounded answer with a valid citation and inspectable source; one unsupported abstention; privacy allowlist compliance; and cleanup. This transport/smoke readback does not claim an independent hash of the LiteRT-executed browser copy, reopen retrieval comparison, repeat the six-case Mac qualification, or repeat the full artifact download. If it fails, keep production on the prior noindexed state or roll back immediately and do not tag. Keep sanitized deployment/model-delivery files local and uncommitted; they are operational readback, not release assets or a certification archive.

- [ ] **Step 10: Record the deferred Search Console follow-up**

Never request indexing for `/chatbot/` while it is a prototype or Preview, and do not request indexing for `/rss.xml`. This release plan makes no `/chatbot/` indexing request. Record the non-blocking follow-up now, but do not wait for it before tagging: after the verified Production deployment has been live long enough for recrawl and the Page indexing report has refreshed, inspect and monitor `https://jetsanchez.com/chatbot/` in the `sc-domain:jetsanchez.com` property. Do not start validation for intentional retired-route `404`s, expected slashless alternate-canonical exclusions, or expected HTTP/www redirect exclusions. Search Console refresh is a later observation, not permission to remove `noindex`, a release gate, or a substitute for the exact Preview/Production release switch.

- [ ] **Step 11: Tag the verified production commit normally**

After Production readback and both real-model smoke cases pass, create a normal annotated `v2.1.0` tag at the exact deployed commit. The tag push requires explicit remote authorization. Do not create a GitHub Release, upload qualification evidence, create a tarball or checksum manifest, bind an evidence digest into the tag, or redownload release assets:

```bash
set -euo pipefail
cd /Users/jet/jet-web
test "$(pwd -P)" = /Users/jet/jet-web
EXPECTED_SHA=$(git rev-parse HEAD)
EXPECTED_SHA="$EXPECTED_SHA" node -e "const d=require('./test-results/jets-ghost-2.1.0-vercel-deployment.json'); if(d.readyState!=='READY'||d.target!=='production'||d.gitSource?.sha!==process.env.EXPECTED_SHA) process.exit(1)"
EXPECTED_SHA="$EXPECTED_SHA" node -e "const d=require('./test-results/jets-ghost-2.1.0-final-preview-vercel-deployment.json'); if(d.target==='production'||d.gitSource?.sha!==process.env.EXPECTED_SHA) process.exit(1)"
test "$(node -p \"require('./package.json').version\")" = "2.1.0"
if git rev-parse --verify refs/tags/v2.1.0 >/dev/null 2>&1; then exit 1; fi
git tag -a v2.1.0 "$EXPECTED_SHA" -m "v2.1.0" -m "Jet's Ghost local-first release"
test "$(git rev-list -n 1 v2.1.0)" = "$EXPECTED_SHA"
git push origin v2.1.0
REMOTE_SHA=$(git ls-remote --tags origin 'refs/tags/v2.1.0^{}' | awk '{print $1}')
test "$REMOTE_SHA" = "$EXPECTED_SHA"
```

Expected: the local annotated tag and remote `v2.1.0` tag point to the exact Production SHA. The committed Markdown remains the concise product qualification record; operational Preview/Production readback stays local and is not promoted into a release-asset ceremony.

---

## Jet's Ghost Completion Gate

```text
[ ] Only Gemma 4 E2B is exposed
[ ] Approved d406ed46 interface is integrated without redesign at semantic /chatbot with canonical https://jetsanchez.com/chatbot/
[ ] /chatbot returns platform 308 to terminal /chatbot/ 200; /tools/chatbot returns platform 308 to /tools/chatbot/, whose sole explicit legacy rule returns 308 to /chatbot/; Ghost href /chatbot/ replaces Tools in every navigation representation
[ ] /tools normalizes once to dormant noindexed /tools/; /tools/ is absent from sitemap/navigation and /toolshed/ is unaffected
[ ] Route entry and compatibility checking perform no LiteRT, corpus, index, model, engine, or prompt work
[ ] Qualification independently downloads exactly 2,008,432,640 model bytes and hashes those bytes to the pinned SHA-256
[ ] LiteRT's eight packaged WASM runtime assets load only from the exact versioned same-origin path after consent; the SDK default CDN is never used
[ ] Runtime model requests start at the exact pinned URL, remain within five trusted HTTPS redirects, and contain no application or conversation data
[ ] Documentation states that LiteRT-LM 0.14.0 URL loading does not independently verify each visitor's executed model bytes
[ ] No prompt, response, context, or history leaves the browser
[ ] Corpus and MiniSearch index contain exactly the tracked published assistant content and share one verified version
[ ] Rank-and-pack uses prebuilt constant-time lookups, considers every match, uses no candidate-count cap or quadratic tentative-array rebuild, and stays within the qualified 16K profile
[ ] Prior turn-local citation markers are removed from model-history replay and cannot resolve against a later turn
[ ] Every grounded conversation passes maxOutputTokens = 1,024, preserving estimator headroom
[ ] Cancellation, New session, unload, fresh SDK initialization, and route cleanup work on real WebGPU without claiming immediate WASM/GPU reclamation
[ ] Conversation exhaustion preserves history and requires an explicit new session
[ ] All six product cases were reviewed once on the available Apple Silicon Mac and no representative blocker remains
[ ] Both unsupported cases abstain and every rendered citation resolves to selected evidence
[ ] Unsupported visitors receive a coherent non-chat experience
[ ] README and verification evidence name the exact tested Mac, macOS, branded Chrome, measured behavior, unsupported configurations, and known limitations
[ ] License and attribution evidence is complete
[ ] Exact noindexed Preview passes automated verification plus one supported and one unsupported real-model smoke
[ ] Production is healthy at 2.1.0 and bound to the release Git SHA
[ ] Production /chatbot/ is index-follow with exact canonical/OG/JSON-LD agreement and exactly one sitemap entry; About, retired 404s, robots, RSS, and sitemap checks remain correct
[ ] Production passes one supported and one unsupported grounded smoke before the normal v2.1.0 tag is pushed
[ ] Prototype/Preview indexing was never requested, this release plan made no /chatbot/ request, RSS was not requested, and /chatbot/ monitoring waits for recrawl/report refresh without validating excluded classes
[ ] The exact Task 12 implementation tree was integrated into `/Users/jet/jet-web`, and the full verification/build/release workflow from Task 13 onward ran from that canonical folder
[ ] The separate consolidation report resolves temporary routes, migration scripts, compatibility shims, staging artifacts, unused dependencies, one-off scaffolding, stale docs/links, and production fake-runtime enablement; every retained test/verification artifact has an explicit permanent purpose
[ ] User-owned drafts were preserved, and tracked tests/plans/qualification fixtures contain no dependency on an active draft's existence, filename, route, or publication status
[ ] `/Users/jet/jet-web-v1-modernization`, obsolete fully integrated local branches, and stale worktree metadata were removed only after canonical tree equality, private draft-inventory equality, and the full canonical gate passed; `/Users/jet/jet-web` is the sole durable Jet Web repository/worktree folder
```
