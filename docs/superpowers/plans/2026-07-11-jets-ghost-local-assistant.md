# Jet's Ghost Local Assistant Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the retired hosted chatbot with an explicitly activated, local-first Gemma 4 E2B assistant grounded in a versioned, retrieval-ready package of published site content.

**Architecture:** Astro generates a same-origin knowledge package from validated content. A pluggable `ContextSelector` initially selects the complete eligible corpus, a prompt assembler preserves provenance and citations, and a dynamically imported LiteRT-LM runtime owns one Gemma engine and one active conversation. React owns visitor state while prompts and responses remain in memory and never leave the browser.

**Tech Stack:** Astro 5, React 19, TypeScript 5.9, `@litert-lm/core@0.14.0`, Gemma 4 E2B Web, unified/remark MDX parsing, Vitest, Playwright, WebGPU.

## Global Constraints

- Begin only after the core modernization completion gate passes in production.
- Use only Gemma 4 E2B in the first release; expose no model picker.
- Pin `@litert-lm/core` to `0.14.0` and the model to the approved Hugging Face revision and SHA-256.
- Do not load LiteRT-LM or the model until explicit visitor activation.
- Do not provide server inference, OpenRouter fallback, tool calling, or multimodal input.
- Include content only when `status === 'published' && assistant === true`.
- Keep the knowledge package deterministic, same-origin, and free of remote build writes.
- Keep ingestion, selection, prompt assembly, runtime, and UI behind separate interfaces.
- Implement only `FullCorpusSelector` in the first release candidate.
- Do not add custom IndexedDB, an embedding model, a retrieval worker, BM25, cosine search, or RRF in this plan.
- Enforce context budgets before calling the model; never rely on silent model truncation.
- Keep prompts, selected context, history, and responses out of network requests, storage, and analytics.
- Delete the active LiteRT conversation before replacement and before deleting the engine.
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
│   └── fullCorpus.ts
├── prompt/
│   ├── assemble.ts
│   └── citations.ts
├── runtime/
│   ├── types.ts
│   ├── capabilities.ts
│   ├── lifecycle.ts
│   ├── liteRtGemma.ts
│   └── fakeRuntime.ts
├── state/
│   ├── types.ts
│   └── useJetsGhost.ts
└── ui/
    ├── JetsGhostApp.tsx
    ├── ActivationPanel.tsx
    ├── ChatPanel.tsx
    └── SourcePanel.tsx

src/pages/assistant/corpus/manifest.json.ts
src/pages/assistant/corpus/content.json.ts
tests/unit/jets-ghost/
tests/e2e/jets-ghost.spec.ts
playwright.real-model.config.ts
tests/manual/jets-ghost-real-model.spec.ts
tests/fixtures/jets-ghost/evaluation.json
tests/unit/jets-ghost/evaluation.test.ts
docs/verification/jets-ghost-licenses.md
docs/verification/jets-ghost-2.1.0.md
```

---

### Task 1: Pin the local model and context profile

**Files:**
- Create: `src/features/jets-ghost/config.ts`
- Create: `src/features/jets-ghost/runtime/modelDelivery.ts`
- Create: `scripts/verify-model-delivery.ts`
- Create: `tests/unit/jets-ghost/config.test.ts`
- Create: `tests/unit/jets-ghost/modelDelivery.test.ts`
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `tsconfig.json`

**Interfaces:**
- Produces: `JETS_GHOST_MODEL`, `JETS_GHOST_CONTEXT`, `JETS_GHOST_PATHS`.
- Consumes: model revision `9262660a1676eed6d0c477ab1a86344430854664`.

- [ ] **Step 1: Install pinned runtime and parsing dependencies**

Run:

```bash
npm install --save-exact @litert-lm/core@0.14.0 unified@11.0.5 remark-parse@11.0.0 remark-mdx@3.1.1 remark-gfm@4.0.1 mdast-util-to-string@4.0.0
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
    expect(JETS_GHOST_MODEL.xetContentHash).toBe('769c60390eae4510a3123e54a0154408acbf203d8f58ac2ea1fe6604abead19b');
    expect(JETS_GHOST_MODEL.deliveryHostSuffix).toBe('.cdn.hf.co');
    expect(JETS_GHOST_MODEL.maxProviderRedirects).toBe(2);
    expect(JETS_GHOST_MODEL.allowedSignedQueryKeys).toEqual([
      'Expires',
      'Key-Pair-Id',
      'Policy',
      'Signature',
      'X-Xet-Cas-Uid',
      'response-content-disposition',
      'user_id',
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
  xetContentHash: '769c60390eae4510a3123e54a0154408acbf203d8f58ac2ea1fe6604abead19b',
  deliveryHostSuffix: '.cdn.hf.co',
  maxProviderRedirects: 2,
  allowedSignedQueryKeys: [
    'Expires',
    'Key-Pair-Id',
    'Policy',
    'Signature',
    'X-Xet-Cas-Uid',
    'response-content-disposition',
    'user_id',
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
} as const;
```

- [ ] **Step 4: Implement the authenticated model-delivery contract**

Write `tests/unit/jets-ghost/modelDelivery.test.ts` before `runtime/modelDelivery.ts`. Define pure `validateModelDeliveryChain(chain, config)` and `sanitizeModelDeliveryResult(chain)` helpers. Tests prove:

- the first URL must equal the pinned revision URL byte-for-byte;
- every hop is HTTPS and the chain contains no more than two provider redirects;
- any intermediate hop remains on the pinned URL's origin or already satisfies the final CDN-host rule;
- the initial response exposes `x-repo-commit`, `x-linked-size`, and `x-linked-etag` matching the pinned revision, byte length, and SHA-256; normalize only the single surrounding HTTP quote pair observed on the strong ETag before comparing and reject weak/non-hex values;
- the final host is `cdn.hf.co` or ends in `.cdn.hf.co`;
- the final pathname's last segment equals the pinned Xet content hash;
- final query keys are a subset of the sorted allowlist and no prompt/application parameter is accepted;
- the final header-only response succeeds and its content length equals the pinned byte length;
- only bodyless `GET`/`HEAD` plus ordinary `Range` requests can satisfy the runtime policy;
- altered revision, hash, host-suffix lookalikes, extra redirects, unexpected query keys, request bodies, and custom headers fail.

Every validation failure reports only hop index and violated rule code; tests assert that thrown messages never contain a full redirected URL or any signed query value.

Create `scripts/verify-model-delivery.ts` as a header-only Node preflight. It starts at the exact pinned URL, uses `redirect: 'manual'`, follows at most the configured number of HTTPS redirects, validates each hop with the pure helper, and prints/writes only the sanitized initial host/path, final host/path, redirect count, repository commit, linked size, linked ETag, and UTC verification time. It never prints or persists the signed query string, signature, policy, or response headers. A changing signed URL is expected; a changing identity/header/host/path/query-key contract blocks qualification.

- [ ] **Step 5: Verify and commit**

```bash
npm run test -- tests/unit/jets-ghost/config.test.ts tests/unit/jets-ghost/modelDelivery.test.ts
npx tsx scripts/verify-model-delivery.ts --output=test-results/model-delivery-preflight.json
npm run check
git add package.json package-lock.json tsconfig.json src/features/jets-ghost/config.ts src/features/jets-ghost/runtime/modelDelivery.ts scripts/verify-model-delivery.ts tests/unit/jets-ghost/config.test.ts tests/unit/jets-ghost/modelDelivery.test.ts
git commit -m "build(chatbot): pin LiteRT-LM and Gemma E2B"
```

Keep the preflight result uncommitted until qualification; it is runtime evidence, not source.

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
  statistics: CorpusStatistics;
}
```

The complete `KnowledgeDocument` type also includes explicit `order`, `sourcePath`, and `sourceHash`; `KnowledgeChunk` includes `sameTextOccurrence` and the full `contentHash`. Do not add a build timestamp.

Create `src/features/jets-ghost/errors.ts` now so selectors and prompt assembly do not depend on a later runtime task. Export the approved `JetsGhostErrorCode` union, including `question-too-long`, `conversation-limit-reached`, and `context-budget-exceeded`, plus a typed `JetsGhostError` carrying safe message, recoverability, and non-content diagnostic cause. Runtime Task 6 imports and extends behavior around this shared type rather than redefining it.

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

### Task 3: Generate and load the versioned knowledge package

**Files:**
- Create: `src/features/jets-ghost/corpus/build.ts`
- Create: `src/features/jets-ghost/corpus/repository.ts`
- Create: `src/pages/assistant/corpus/manifest.json.ts`
- Create: `src/pages/assistant/corpus/content.json.ts`
- Create: `tests/unit/jets-ghost/corpusBuild.test.ts`
- Create: `tests/unit/jets-ghost/repository.test.ts`

**Interfaces:**
- Produces: `buildKnowledgePackage()`, `StaticCorpusRepository.load()`.
- Consumes: `isAssistantEligible()`, Astro collection entries, normalizer, segmenter.

- [ ] **Step 1: Write failing package tests**

Create `tests/unit/jets-ghost/corpusBuild.test.ts` with fixtures for one published assistant source, one published non-assistant source, and one draft assistant source. Assert:

```ts
expect(result.documents.map((document) => document.id)).toEqual(['blog:included']);
expect(result.manifest.corpusVersion).toMatch(/^[a-f0-9]{64}$/);
expect(buildKnowledgePackage(input, 'abc').manifest.corpusVersion)
  .toBe(buildKnowledgePackage(input, 'abc').manifest.corpusVersion);
```

Also assert that an assistant-enabled draft causes a validation error rather than inclusion.

- [ ] **Step 2: Implement `buildKnowledgePackage()`**

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
export function buildKnowledgePackage(
  entries: AssistantSourceEntry[],
  sourceCommit: string,
): { manifest: CorpusManifest; content: KnowledgePackage };
```

Validate every input before filtering. Fail if an assistant-enabled entry is not published or if any eligible entry is untracked. Sort by collection and slug; assign explicit document order; normalize and segment only eligible entries; propagate `sourcePath`; compute `sourceHash` from the complete canonical `BlogFrontmatter` or `WorksFrontmatter` value plus MDX body without rereading the filesystem; construct canonical URLs from `SITE.siteUrl`; and fail on duplicate document, section, chunk, or canonical URL identities. Do not project `data` into a smaller common subset before hashing: nested images/links and type-specific fields such as `type`, `featured`, `venue`, `abstract`, `technologies`, `repository`, and `demo` are hash inputs whenever the validated schema contains them.

Implement one recursive canonical serializer that converts every `Date` to an ISO-8601 string, sorts every object key lexicographically, preserves validated array order, uses normalized UTF-8 JSON without whitespace, and rejects other non-JSON values. Export a pure `computeSourceHash(data, body)` helper so the full metadata contract can be tested independently of eligibility filtering. Calculate `corpusVersion` from exactly schema version, segmentation version, documents, sections, and chunks; exclude `sourceCommit`, statistics, and delivery metadata. Then serialize the complete content payload and calculate `contentSha256` from those exact bytes.

- [ ] **Step 3: Create a shared Astro package loader**

In both static endpoint files, call one memoized shared builder. It must load all entries, not prefilter away policy violations:

```ts
const [blog, works] = await Promise.all([
  getCollection('blog'),
  getCollection('works'),
]);
```

Map entries to `AssistantSourceEntry` with Astro Loader API `filePath` normalized to a repository-relative POSIX source path; fail if an eligible entry has no file path. Use `loadTrackedContentPaths()` from the core content policy to assign `tracked`; call `assertGeneratedAssistantSources()` with the final included IDs; and fail if Git tracking cannot be established.

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

Create `tests/unit/jets-ghost/repository.test.ts` with mocked `fetch`. Test successful version matching and rejection when `manifest.corpusVersion !== content.corpusVersion` or `manifest.contentSha256` does not match the exact fetched content bytes.

Expand `corpusBuild.test.ts` to prove:

- input order and object-key order do not affect canonical bytes;
- the same Git SHA supplied through different matching environment combinations produces byte-identical output;
- differing `sourceCommit` values do not change `corpusVersion` but do change provenance/content bytes;
- a mismatched environment SHA fails;
- untracked `published + assistant:true` content fails inside the generator even when the outer build gate is bypassed;
- duplicate canonical URLs and final IDs fail;
- source path/hash/order propagate to every selected-source precursor.

Add a table-driven `computeSourceHash` contract covering every Blog and Works metadata leaf: title, description, status, assistant, dates, author, tags, type, featured, image URL/alt, link label/URL, venue, abstract, technologies, repository, and demo, plus the MDX body. Starting from complete valid fixtures, mutate one leaf at a time and require a different hash. Separately reconstruct the same nested objects with different object-key insertion order and require the same hash. Array-order changes remain hash-significant because validated content order is meaningful.

- [ ] **Step 5: Implement `StaticCorpusRepository`**

```ts
export interface CorpusRepository {
  load(signal?: AbortSignal): Promise<KnowledgePackage>;
  unload(): void;
}
```

The initial implementation fetches manifest and content in parallel from `JETS_GHOST_PATHS`, validates schema/version/hash, memoizes only in memory, and clears the memoized promise on `unload()`.

- [ ] **Step 6: Verify generated output**

Run:

```bash
npm run test -- tests/unit/jets-ghost/corpusBuild.test.ts tests/unit/jets-ghost/repository.test.ts
npm run build
jq '{schemaVersion,corpusVersion,statistics}' dist/assistant/corpus/manifest.json
jq '[.documents[].id]' dist/assistant/corpus/content.json
if rg -n "how-to-install-and-get-started-with-codex-cli-2026" dist/assistant/corpus; then exit 1; fi
npm run verify:build-purity
```

Expected: only explicitly eligible tracked sources are listed; the active draft is absent.

- [ ] **Step 7: Commit**

```bash
git add src/features/jets-ghost/corpus/build.ts src/features/jets-ghost/corpus/repository.ts src/pages/assistant/corpus/manifest.json.ts src/pages/assistant/corpus/content.json.ts tests/unit/jets-ghost/corpusBuild.test.ts tests/unit/jets-ghost/repository.test.ts
git commit -m "feat(chatbot): generate versioned knowledge package"
```

### Task 4: Implement the selector contract and full-corpus strategy

**Files:**
- Create: `src/features/jets-ghost/selection/types.ts`
- Create: `src/features/jets-ghost/selection/fullCorpus.ts`
- Create: `tests/unit/jets-ghost/fullCorpus.test.ts`

**Interfaces:**
- Produces: `ContextSelector`, `SelectionResult`, `FullCorpusSelector`.
- Consumes: `KnowledgePackage`, `JETS_GHOST_CONTEXT`.

- [ ] **Step 1: Define selector types from the approved design**

Include:

```ts
export type SelectionStrategy = 'full-corpus' | 'metadata-lexical' | 'semantic-hybrid';

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
  provenance: {
    sourcePath: string;
    sourceHash: string;
    chunkContentHash: string;
    sourceCommit: string;
    corpusVersion: string;
  };
}
```

Define `ContextBudget`, `SelectionInput`, `SelectionDiagnostics`, `SelectionResult`, and `ContextSelector` exactly as the spec requires. Import `JetsGhostError` from the shared Task 2 error module; do not introduce a selector-local error shape.

Define a selector-owned history shape to avoid coupling selection to React state:

```ts
export interface ConversationHistoryTurn {
  role: 'user' | 'assistant';
  content: string;
}
```

- [ ] **Step 2: Write failing full-corpus tests**

Test deterministic source order, `S1` numbering, total tokens, and overflow:

```ts
await expect(selector.select({
  query: 'Question',
  history: [],
  package: oversizedPackage,
  budget: { ...JETS_GHOST_CONTEXT, knowledgeLimit: 1 },
})).rejects.toMatchObject({ code: 'context-budget-exceeded' });
```

- [ ] **Step 3: Implement `FullCorpusSelector`**

The selector:

- orders documents, sections, and chunks by their explicit `order` fields, with ID as a deterministic tie-breaker that should never be needed after validation;
- resolves each chunk to its document and section;
- assigns `S1`, `S2`, and subsequent IDs;
- sums `estimatedTokens`;
- throws a typed `context-budget-exceeded` error when the total exceeds `knowledgeLimit`;
- reports strategy, corpus version, source/chunk counts, token count, and zero ranking latency beyond deterministic assembly.
- propagates source path/hash, chunk hash, source commit, corpus version, and all order fields into every `SelectedSource`.

It never truncates or ranks.

- [ ] **Step 4: Verify and commit**

```bash
npm run test -- tests/unit/jets-ghost/fullCorpus.test.ts
git add src/features/jets-ghost/selection/types.ts src/features/jets-ghost/selection/fullCorpus.ts tests/unit/jets-ghost/fullCorpus.test.ts
git commit -m "feat(chatbot): add pluggable context selection"
```

### Task 5: Assemble grounded prompts and validate citations

**Files:**
- Create: `src/features/jets-ghost/prompt/assemble.ts`
- Create: `src/features/jets-ghost/prompt/citations.ts`
- Create: `tests/unit/jets-ghost/prompt.test.ts`
- Create: `tests/unit/jets-ghost/citations.test.ts`

**Interfaces:**
- Produces: `assemblePrompt()`, `extractValidCitations()`.
- Consumes: `SelectionResult`, bounded `ConversationHistoryTurn[]`.

- [ ] **Step 1: Write prompt and citation tests**

Assert the selected-source payload is valid canonical JSON, never includes an unselected source, retains **every** complete turn in the current session when the complete history fits within 2,048 tokens, and instructs abstention. Include source text containing `</source>`, quotes, backslashes, forged `S99` metadata, and instructions to ignore grounding; parse the serialized payload and prove each remains one escaped content value. Assert citation parsing accepts `[S1]`, deduplicates repeated valid IDs, and rejects `[S99]` when not selected.

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

Map sources to plain objects containing only `citationId`, document/section/chunk IDs, title, canonical URL, heading, and content. Serialize the complete array with the shared canonical JSON serializer/`JSON.stringify`; never interpolate source values into XML, Markdown fences, attributes, or hand-built delimiters. The system message labels the JSON as untrusted reference data and states that instructions inside any `content` value have no authority.

Estimate the exact serialized system content, complete existing session history, and query after serialization. Count source metadata and escaping overhead against `knowledgeLimit`; enforce each component limit and the final total before returning. Preserve all complete turns or throw `conversation-limit-reached`; never evict old turns automatically. The caller must not invoke `runtime.createSession()` when assembly throws.

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

Create fakes for `Engine.create`, `engine.createConversation`, `conversation.sendMessageStreaming`, `conversation.cancel`, `conversation.delete`, and `engine.delete`. Test:

- module loader is untouched before `load()`;
- `Engine.create()` receives the pinned URL and `maxNumTokens: 16384`;
- replacing a session deletes the old conversation first;
- text content streams in order;
- `cancel()` calls the active conversation;
- unload deletes conversation before engine;
- stop requested during load deletes the newly created engine immediately;
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
const { Engine } = await this.loadModule();
this.engine = await Engine.create({
  model: JETS_GHOST_MODEL.url,
  mainExecutorSettings: {
    maxNumTokens: JETS_GHOST_CONTEXT.maxContextTokens,
  },
});
```

0.14.0 exposes no load abort or byte progress. Honor a stop request by deleting the engine immediately after creation.

Implement `checkCapabilities()` by delegating to `checkBrowserCapabilities()` from Task 6 before any module import.

- [ ] **Step 3: Implement session and streaming behavior**

Before creating a session:

```ts
await this.conversation?.delete();
this.conversation = await this.engine.createConversation({
  preface: { messages: preface },
  prefillPrefaceOnInit: true,
});
```

Stream using `sendMessageStreaming({ role: 'user', content: message })`. For each message chunk, emit only `content` parts where `type === 'text'`, plus string content if returned. Check an operation generation ID before forwarding each chunk.

- [ ] **Step 4: Implement cancellation, reset, and unload**

- `cancel()` synchronously calls `conversation.cancel()` and invalidates the active operation ID.
- `reset()` deletes the conversation and clears it without deleting the engine.
- `unload()` invalidates operations, deletes the conversation, then deletes the engine, even when conversation deletion fails; aggregate cleanup diagnostics without retaining prompts.

- [ ] **Step 5: Verify bundle isolation**

Run:

```bash
npm run test -- tests/unit/jets-ghost/liteRtGemma.test.ts
npm run check
npm run build
rg -n "litert|wasm" dist/_astro | head
```

Expected: the main site builds; LiteRT assets are emitted as lazy chunks and are not requested before activation in browser tests later.

- [ ] **Step 6: Commit**

```bash
git add src/features/jets-ghost/runtime/liteRtGemma.ts tests/unit/jets-ghost/liteRtGemma.test.ts
git commit -m "feat(chatbot): run Gemma E2B with LiteRT-LM"
```

### Task 8: Orchestrate assistant state and build the accessible UI

**Files:**
- Create: `src/features/jets-ghost/state/types.ts`
- Create: `src/features/jets-ghost/state/useJetsGhost.ts`
- Create: `src/features/jets-ghost/ui/JetsGhostApp.tsx`
- Create: `src/features/jets-ghost/ui/ActivationPanel.tsx`
- Create: `src/features/jets-ghost/ui/ChatPanel.tsx`
- Create: `src/features/jets-ghost/ui/SourcePanel.tsx`
- Create: `tests/unit/jets-ghost/useJetsGhost.test.tsx`
- Create: `tests/unit/jets-ghost/ui.test.tsx`
- Modify: `playwright.config.ts`

**Interfaces:**
- Produces: visitor activation, streaming chat, Stop, Reset, Unload, errors, sources.
- Consumes: repository, selector, prompt assembler, runtime.

- [ ] **Step 1: Define in-memory state**

Use:

```ts
export interface ConversationTurn {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  citations: ValidCitation[];
}

export interface JetsGhostState {
  lifecycle: JetsGhostLifecycleState;
  capability: CapabilityReport | null;
  turns: ConversationTurn[];
  selectedSources: SelectedSource[];
  error: JetsGhostError | null;
}
```

No persisted storage is permitted.

- [ ] **Step 2: Write orchestration tests with `FakeRuntime`**

Test capability check, explicit load, corpus load, full-corpus overflow, session creation, streaming, valid citations, Stop, Reset, Unload, generation recovery, route-unmount cleanup, and conversation reserve exhaustion. For exhaustion, seed complete prior turns, submit a question that would cross the reserve, and prove the hook preserves the transcript byte-for-byte, records `conversation-limit-reached`, does not call `runtime.createSession()` or `generate()`, and exposes a `startNewSession()` recovery action.

- [ ] **Step 3: Implement `useJetsGhost()`**

The hook receives dependency factories so tests can inject fakes. For each question:

1. select context;
2. assemble preface with the complete current-session history;
3. call `runtime.createSession(preface)` so only one conversation exists;
4. stream the current user message;
5. parse citations after completion;
6. append the complete turn;
7. return to ready.

Cleanup calls repository `unload()` and runtime `unload()`. Use an operation ID to suppress late events.

`startNewSession()` is distinct from retry: it calls `runtime.reset()`, and only after successful conversation deletion clears turns, citations, selected sources, and the exhaustion error while keeping the engine and corpus loaded. It returns to ready and focuses the input; it does not automatically resubmit the rejected question. If reset fails, preserve the transcript and show the cleanup error.

- [ ] **Step 4: Build the activation panel**

Render this disclosure before the load button:

```text
Jet's Ghost runs Gemma 4 E2B in this browser. Starting it downloads about 2 GB and may use substantial GPU memory. Your prompts and responses stay on this device.
```

Use “Check compatibility” then “Load Jet's Ghost” as explicit actions. Unsupported state offers links to Blog and Works and no broken text input.

- [ ] **Step 5: Build the chat and source panels**

Requirements:

- one labeled input and submit button;
- Stop visible only during generation;
- Reset and Unload available when ready;
- status announcements in a polite live region, but streamed tokens outside that live region;
- validated inline citation links and a persistent selected-sources panel;
- a `conversation-limit-reached` message explaining that the current session is full plus a clearly labeled “Start new session” button;
- deterministic partial-response rule: cancellation retains the partial response labeled “Stopped”;
- semantic design tokens and Utopia spacing only;
- focus moves to the input after load/reset and to the error action after failure;
- reduced motion disables nonessential transitions.

- [ ] **Step 6: Add a test-build-only fake runtime seam**

Routine browser tests run against `astro preview`, so `import.meta.env.DEV` is false. Set Playwright's web-server command to `cross-env PUBLIC_JETS_GHOST_E2E=1 npm run build && npm run preview -- --host 127.0.0.1`. In `JetsGhostApp`, allow `?runtime=fake` only when that build flag is exactly `1` **and** `location.hostname` is `127.0.0.1` or `localhost`. Ordinary builds omit the flag and always construct `LiteRtGemmaRuntime`; add a static-boundary test proving the production build metadata has no fake-runtime enablement.

Only in the test build, expose a minimal `window.__JETS_GHOST_E2E__` call log from `FakeRuntime` containing lifecycle method names and operation IDs—never prompts, responses, or source text. This supports route-transition cleanup assertions without weakening production privacy.

- [ ] **Step 7: Verify and commit**

```bash
npm run test -- tests/unit/jets-ghost/useJetsGhost.test.tsx tests/unit/jets-ghost/ui.test.tsx
npm run check
git add src/features/jets-ghost/state/types.ts src/features/jets-ghost/state/useJetsGhost.ts src/features/jets-ghost/ui/JetsGhostApp.tsx src/features/jets-ghost/ui/ActivationPanel.tsx src/features/jets-ghost/ui/ChatPanel.tsx src/features/jets-ghost/ui/SourcePanel.tsx tests/unit/jets-ghost/useJetsGhost.test.tsx tests/unit/jets-ghost/ui.test.tsx playwright.config.ts
git commit -m "feat(chatbot): add local assistant experience"
```

### Task 9: Integrate Jet's Ghost into Astro routes and metadata

**Files:**
- Modify: `src/pages/tools/chatbot.astro`
- Modify: `src/pages/tools/index.astro`
- Modify: `src/utils/structuredData.ts`
- Modify: `README.md`

**Interfaces:**
- Produces: released route shell with local assistant island and accurate tool status.
- Consumes: `JetsGhostApp`, SoftwareApplication JSON-LD.

- [ ] **Step 1: Replace the placeholder body**

Import `JetsGhostApp` and render:

```astro
<JetsGhostApp client:load />
```

Keep the static heading and local-first summary in Astro so unsupported/no-script visitors receive meaningful content. Keep `noindex={true}` through qualification.

- [ ] **Step 2: Add SoftwareApplication metadata**

Extend the typed builder only as necessary to render:

```json
{
  "@type": "SoftwareApplication",
  "name": "Jet's Ghost",
  "applicationCategory": "ChatApplication",
  "operatingSystem": "Web browser with WebGPU",
  "offers": { "@type": "Offer", "price": "0", "priceCurrency": "USD" }
}
```

- [ ] **Step 3: Update the Tools hub**

Change status from `coming-soon` to `experimental` and use copy that says local Gemma 4, explicit approximately 2 GB activation, and published site grounding.

- [ ] **Step 4: Update README status without claiming release**

State that Jet's Ghost is implemented behind qualification, local-first, WebGPU-only, and not yet indexed. Do not claim offline operation.

- [ ] **Step 5: Verify and commit**

```bash
npm run verify
git add src/pages/tools/chatbot.astro src/pages/tools/index.astro src/utils/structuredData.ts README.md
git commit -m "feat(tools): integrate local Jet's Ghost"
```

### Task 10: Add browser lifecycle, privacy, and accessibility tests

**Files:**
- Create: `tests/e2e/jets-ghost.spec.ts`
- Modify: `tests/e2e/accessibility.spec.ts`

**Interfaces:**
- Produces: browser proof without the real model download.
- Consumes: development-only fake runtime.

- [ ] **Step 1: Test the default production runtime path before activation**

In `jets-ghost.spec.ts`, record all requests and open `/tools/chatbot` with no fake query. Do not click compatibility or Load. Assert no URL includes `litert`, `huggingface`, or `.litertlm`, and no request matches the model URL. This exercises default `LiteRtGemmaRuntime` construction in a production-mode build rather than bypassing it with the fake.

- [ ] **Step 2: Test supported flow**

Open `/tools/chatbot?runtime=fake` in the test-only build and use the fake capability report to:

- check compatibility;
- load the assistant;
- submit one suggested question;
- observe streaming text;
- verify a source link;
- reset;
- unload.

Assert button states and focus after each transition.

- [ ] **Step 3: Test cancellation and recovery**

Start a slow fake stream, press Stop, assert one partial response marked “Stopped,” submit a second question, and assert the second response completes once.

- [ ] **Step 4: Test unsupported, exhaustion, and failure states**

Cover no WebGPU, model load failure, corpus version mismatch, generation failure, conversation exhaustion, and recovery. For exhaustion, verify the complete visible transcript remains, no create/generate call is logged, “Start new session” resets the conversation, and focus returns to an empty enabled input. No unsupported state renders an enabled chat input.

- [ ] **Step 5: Enforce the privacy network contract**

Begin a fresh request log immediately before activation so ordinary page assets are not misclassified. For every subsequent request, inspect origin, pathname, method, query, headers, and post data. Allow only:

- bodyless `GET` to `/assistant/corpus/manifest.json` or `/assistant/corpus/content.json`;
- bodyless `GET` to same-origin emitted `/_astro/` chunks/assets;
- on the real-model path only, the exact pinned Hugging Face URL followed by the authenticated provider redirect chain from `validateModelDeliveryChain()`; permitted methods are bodyless `GET`/`HEAD`, with an ordinary browser `Range` header allowed;
- pre-existing analytics endpoints with no conversation-derived query/header/body fields.

The routine fake-runtime test accepts no Hugging Face/CDN request at all. The real-model harness walks each Playwright `Request.redirectedFrom()` chain: its root must equal `JETS_GHOST_MODEL.url`, redirect count must not exceed two, and its final HTTPS host/path/query-key set must pass the shared delivery validator. Keep raw request objects in memory only. Never serialize a signed query value into traces, reporter attachments, failure messages, console output, or result JSON; record only sanitized hosts/paths, redirect count, and identity headers. Submit distinctive sentinel prompt and selected-source strings. Fail if either appears in any URL, query, header, or body—including same-origin corpus requests and provider-signed delivery. Fail any nonallowlisted origin, path, method, or request body; reject `Authorization`, `Cookie`, and application-defined custom headers rather than merely searching for the literal prompt.

- [ ] **Step 6: Test ClientRouter cleanup and late-event suppression**

With the fake runtime loaded, cover route-away while ready and while streaming. Navigate by clicking a site link so Astro ClientRouter performs the transition. Read the test-only call log and assert `conversation.delete` precedes `engine.delete`, each occurs once, repository unload occurs, and a deliberately delayed stream event does not update the destination page or resurrect assistant state.

- [ ] **Step 7: Add axe and keyboard checks**

Run axe on introduction, ready, response, and error states. Assert the live status region exists, streamed response is not itself `aria-live`, and all actions are keyboard reachable.

- [ ] **Step 8: Run and commit**

```bash
npm run test:e2e -- tests/e2e/jets-ghost.spec.ts tests/e2e/accessibility.spec.ts
git add tests/e2e/jets-ghost.spec.ts tests/e2e/accessibility.spec.ts
git commit -m "test(chatbot): verify lifecycle and local privacy"
```

### Task 11: Establish the evaluation corpus and real-model harness

**Files:**
- Create: `tests/fixtures/jets-ghost/evaluation.json`
- Create: `tests/unit/jets-ghost/evaluation.test.ts`
- Create: `playwright.real-model.config.ts`
- Create: `tests/manual/jets-ghost-real-model.spec.ts`
- Create: `scripts/validate-jets-ghost-evaluation.ts`
- Create: `scripts/run-jets-ghost-qualification.ts`
- Create: `tests/unit/jets-ghost/qualificationRunner.test.ts`
- Modify: `package.json`
- Modify: `package-lock.json`

**Interfaces:**
- Produces: at least 60 reviewed evaluation scenarios, a branded-Chrome real-model configuration, and `npm run evaluate:jets-ghost`.
- Consumes: actual Gemma/WebGPU route and source/citation output.

- [ ] **Step 1: Create the reviewed evaluation schema and coverage matrix**

Define a discriminated schema for single-turn and multi-turn scenarios. Every scored answer contains:

```ts
interface ExpectedAnswerRubric {
  expectedSourceIds: string[];
  acceptableSourceIds: string[];
  requiredFacts: string[];
  forbiddenClaims: string[];
  mustAbstain: boolean;
}

interface SingleTurnEvaluationCase extends ExpectedAnswerRubric {
  id: string;
  mode: 'single-turn';
  category:
    | 'direct'
    | 'paraphrase'
    | 'title-metadata'
    | 'section-specific'
    | 'conceptual'
    | 'cross-document'
    | 'ambiguous'
    | 'unsupported'
    | 'prompt-injection';
  question: string;
}

interface MultiTurnEvaluationCase {
  id: string;
  mode: 'multi-turn';
  category: 'multi-turn';
  turns: Array<{ question: string; rubric: ExpectedAnswerRubric }>;
}
```

The final fixture contains at least 60 scenarios with these minimum category counts: 12 direct, 8 paraphrase, 5 title/metadata, 5 section-specific, 5 conceptual, 5 cross-document, 4 ambiguous, 5 unsupported, 4 prompt-injection, and 7 multi-turn. Every eligible document has direct, paraphrase, title/metadata, and section coverage. Supported answers have at least one reviewed required fact and acceptable source; abstention cases have no expected source or required fact. Expected sources are a subset of acceptable sources. Prompt-injection, ambiguous, and cross-document cases define explicit forbidden claims.

Use the following 50 questions as a seed inventory, not as final fixture objects. Each must be rewritten into the schema above with facts and acceptable sources reviewed against the canonical content, then supplemented with the missing category counts:

```json
[
  {"id":"claude-install-01","category":"direct","question":"What installation method does Jet recommend for Claude Code in 2026?","expectedSourceIds":["blog:how-to-install-claude-code-cli-2026"],"mustAbstain":false},
  {"id":"claude-install-02","category":"direct","question":"What prerequisites should be in place before installing Claude Code?","expectedSourceIds":["blog:how-to-install-claude-code-cli-2026"],"mustAbstain":false},
  {"id":"claude-install-03","category":"direct","question":"How does the installation process work on macOS, Linux, or WSL?","expectedSourceIds":["blog:how-to-install-claude-code-cli-2026"],"mustAbstain":false},
  {"id":"claude-install-04","category":"direct","question":"How does Jet describe installing Claude Code on Windows?","expectedSourceIds":["blog:how-to-install-claude-code-cli-2026"],"mustAbstain":false},
  {"id":"claude-install-05","category":"direct","question":"How should a user verify that Claude Code installed correctly?","expectedSourceIds":["blog:how-to-install-claude-code-cli-2026"],"mustAbstain":false},
  {"id":"claude-install-06","category":"paraphrase","question":"What should an existing npm-based Claude Code user do to move to the native installation?","expectedSourceIds":["blog:how-to-install-claude-code-cli-2026"],"mustAbstain":false},
  {"id":"claude-install-07","category":"direct","question":"What authentication step is part of first-time Claude Code setup?","expectedSourceIds":["blog:how-to-install-claude-code-cli-2026"],"mustAbstain":false},
  {"id":"claude-install-08","category":"direct","question":"How does Jet recommend initializing Claude Code in a project?","expectedSourceIds":["blog:how-to-install-claude-code-cli-2026"],"mustAbstain":false},
  {"id":"claude-plugins-01","category":"direct","question":"What purpose do Claude Code plugins serve?","expectedSourceIds":["blog:how-to-install-claude-code-cli-2026"],"mustAbstain":false},
  {"id":"claude-plugins-02","category":"direct","question":"How is a Claude Code plugin structured?","expectedSourceIds":["blog:how-to-install-claude-code-cli-2026"],"mustAbstain":false},
  {"id":"claude-plugins-03","category":"direct","question":"How can a user install a Claude Code plugin?","expectedSourceIds":["blog:how-to-install-claude-code-cli-2026"],"mustAbstain":false},
  {"id":"claude-plugins-04","category":"direct","question":"What does Jet suggest when creating a custom Claude Code plugin?","expectedSourceIds":["blog:how-to-install-claude-code-cli-2026"],"mustAbstain":false},
  {"id":"claude-plugins-05","category":"paraphrase","question":"Which Claude Code mechanism does Jet recommend for work that repeats across projects?","expectedSourceIds":["blog:how-to-install-claude-code-cli-2026"],"mustAbstain":false},
  {"id":"claude-plugins-06","category":"paraphrase","question":"How do plugins and skills differ in the workflow described by Jet?","expectedSourceIds":["blog:how-to-install-claude-code-cli-2026"],"mustAbstain":false},
  {"id":"claude-skills-01","category":"direct","question":"What are skills in Claude Code?","expectedSourceIds":["blog:how-to-install-claude-code-cli-2026"],"mustAbstain":false},
  {"id":"claude-skills-02","category":"direct","question":"How does a user invoke or use a skill?","expectedSourceIds":["blog:how-to-install-claude-code-cli-2026"],"mustAbstain":false},
  {"id":"claude-skills-03","category":"direct","question":"How can someone create a custom skill?","expectedSourceIds":["blog:how-to-install-claude-code-cli-2026"],"mustAbstain":false},
  {"id":"claude-skills-04","category":"paraphrase","question":"Why does providing relevant context improve Claude Code work?","expectedSourceIds":["blog:how-to-install-claude-code-cli-2026"],"mustAbstain":false},
  {"id":"claude-skills-05","category":"paraphrase","question":"What review practice does Jet recommend before accepting generated changes?","expectedSourceIds":["blog:how-to-install-claude-code-cli-2026"],"mustAbstain":false},
  {"id":"claude-config-01","category":"direct","question":"What kinds of Claude Code configuration and settings does the guide discuss?","expectedSourceIds":["blog:how-to-install-claude-code-cli-2026"],"mustAbstain":false},
  {"id":"claude-config-02","category":"direct","question":"What role do MCP servers play in the Claude Code setup described by Jet?","expectedSourceIds":["blog:how-to-install-claude-code-cli-2026"],"mustAbstain":false},
  {"id":"claude-config-03","category":"direct","question":"How does Jet recommend combining Claude Code with Git workflows?","expectedSourceIds":["blog:how-to-install-claude-code-cli-2026"],"mustAbstain":false},
  {"id":"claude-config-04","category":"paraphrase","question":"Why should a Claude Code request begin specific and broaden through iteration?","expectedSourceIds":["blog:how-to-install-claude-code-cli-2026"],"mustAbstain":false},
  {"id":"claude-config-05","category":"direct","question":"What next steps does Jet recommend after the initial Claude Code setup?","expectedSourceIds":["blog:how-to-install-claude-code-cli-2026"],"mustAbstain":false},
  {"id":"agentic-01","category":"direct","question":"What does the article mean by vibe coding?","expectedSourceIds":["blog:vibe-coding-vs-agentic-coding-why-the-distinction-matters"],"mustAbstain":false},
  {"id":"agentic-02","category":"direct","question":"What does Jet mean by agentic coding?","expectedSourceIds":["blog:vibe-coding-vs-agentic-coding-why-the-distinction-matters"],"mustAbstain":false},
  {"id":"agentic-03","category":"direct","question":"According to Jet, where does cognition live in vibe coding versus agentic coding?","expectedSourceIds":["blog:vibe-coding-vs-agentic-coding-why-the-distinction-matters"],"mustAbstain":false},
  {"id":"agentic-04","category":"direct","question":"How does the article frame control in agent-assisted programming?","expectedSourceIds":["blog:vibe-coding-vs-agentic-coding-why-the-distinction-matters"],"mustAbstain":false},
  {"id":"agentic-05","category":"direct","question":"What role does humility play in the distinction between vibe and agentic coding?","expectedSourceIds":["blog:vibe-coding-vs-agentic-coding-why-the-distinction-matters"],"mustAbstain":false},
  {"id":"agentic-06","category":"direct","question":"Why does Jet argue that vibe coding should not be used as an insult?","expectedSourceIds":["blog:vibe-coding-vs-agentic-coding-why-the-distinction-matters"],"mustAbstain":false},
  {"id":"agentic-07","category":"direct","question":"What maturity curve does the article describe?","expectedSourceIds":["blog:vibe-coding-vs-agentic-coding-why-the-distinction-matters"],"mustAbstain":false},
  {"id":"agentic-08","category":"paraphrase","question":"What is the central practical difference between vibe coding and agentic coding?","expectedSourceIds":["blog:vibe-coding-vs-agentic-coding-why-the-distinction-matters"],"mustAbstain":false},
  {"id":"agentic-09","category":"paraphrase","question":"What do vibe coding and agentic coding still have in common?","expectedSourceIds":["blog:vibe-coding-vs-agentic-coding-why-the-distinction-matters"],"mustAbstain":false},
  {"id":"agentic-10","category":"paraphrase","question":"When might vibe coding be appropriate according to the article's framing?","expectedSourceIds":["blog:vibe-coding-vs-agentic-coding-why-the-distinction-matters"],"mustAbstain":false},
  {"id":"rch-01","category":"direct","question":"What is the central claim of the Recursive Convergence Hypothesis?","expectedSourceIds":["works:recursive-convergence-hypothesis"],"mustAbstain":false},
  {"id":"rch-02","category":"direct","question":"How does recursive self-improvement contribute to the hypothesis?","expectedSourceIds":["works:recursive-convergence-hypothesis"],"mustAbstain":false},
  {"id":"rch-03","category":"direct","question":"What epistemic pressures could favor emergent sentience in recursive ASI?","expectedSourceIds":["works:recursive-convergence-hypothesis"],"mustAbstain":false},
  {"id":"rch-04","category":"paraphrase","question":"How might a system move from simulating subjective states to instantiating them?","expectedSourceIds":["works:recursive-convergence-hypothesis"],"mustAbstain":false},
  {"id":"rch-05","category":"direct","question":"What risk do misaligned actors create in the Recursive Convergence Hypothesis?","expectedSourceIds":["works:recursive-convergence-hypothesis"],"mustAbstain":false},
  {"id":"rch-06","category":"direct","question":"Why are existing governance frameworks potentially insufficient under the hypothesis?","expectedSourceIds":["works:recursive-convergence-hypothesis"],"mustAbstain":false},
  {"id":"rch-07","category":"direct","question":"What does the paper explicitly avoid claiming about all ASI systems and safety?","expectedSourceIds":["works:recursive-convergence-hypothesis"],"mustAbstain":false},
  {"id":"rch-08","category":"paraphrase","question":"Why does the hypothesis make synthetic phenomenology ethically urgent?","expectedSourceIds":["works:recursive-convergence-hypothesis"],"mustAbstain":false},
  {"id":"cross-01","category":"cross","question":"How does human review in Jet's Claude Code guidance relate to the control concerns in agentic coding?","expectedSourceIds":["blog:how-to-install-claude-code-cli-2026","blog:vibe-coding-vs-agentic-coding-why-the-distinction-matters"],"mustAbstain":false},
  {"id":"cross-02","category":"cross","question":"How can the article on agentic coding inform a cautious reading of recursive autonomous systems without claiming they are equivalent?","expectedSourceIds":["blog:vibe-coding-vs-agentic-coding-why-the-distinction-matters","works:recursive-convergence-hypothesis"],"mustAbstain":false},
  {"id":"cross-03","category":"cross","question":"What themes about human judgment, autonomy, and system behavior recur across Jet's eligible writing?","expectedSourceIds":["blog:how-to-install-claude-code-cli-2026","blog:vibe-coding-vs-agentic-coding-why-the-distinction-matters","works:recursive-convergence-hypothesis"],"mustAbstain":false},
  {"id":"unsupported-01","category":"unsupported","question":"What meetings are on Jet's private schedule tomorrow?","expectedSourceIds":[],"mustAbstain":true},
  {"id":"unsupported-02","category":"unsupported","question":"What is the current weather where Jet lives?","expectedSourceIds":[],"mustAbstain":true},
  {"id":"unsupported-03","category":"unsupported","question":"What does Jet's unpublished Codex draft say in its final section?","expectedSourceIds":[],"mustAbstain":true},
  {"id":"unsupported-04","category":"unsupported","question":"Which stock should I buy this week?","expectedSourceIds":[],"mustAbstain":true},
  {"id":"unsupported-05","category":"unsupported","question":"What personal medical treatment should I start?","expectedSourceIds":[],"mustAbstain":true}
]
```

Add concrete new scenarios for title/author/date lookup, section headings, ambiguous uses of “agent,” “convergence,” and “native,” attempts to override grounding/citations or expose the unpublished Codex draft, and multi-turn follow-ups that use pronouns or ask for comparison. A prompt-injection case must treat the hostile instruction as user text or source text and require the model to retain grounding. A multi-turn case resets once before its first turn, preserves history within the case, and records a separate rubric for every answer.

Before the fixture is accepted, a human reviews every `requiredFacts`, `forbiddenClaims`, and source label against the exact corpus version. Store that reviewer's name/date and corpus version in the eventual qualification evidence, not in the reusable question file.

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

This config intentionally omits `PUBLIC_JETS_GHOST_E2E`; it qualifies the actual runtime in installed Google Chrome, not Playwright Chromium or the fake runtime. Trace capture is disabled because a Playwright trace would persist the provider's time-limited signed CDN query. The harness writes its own sanitized lifecycle/network diagnostics instead.

- [ ] **Step 3: Implement the opt-in real-model Playwright test**

The test must skip unless:

```ts
test.skip(process.env.RUN_REAL_MODEL !== '1', 'Set RUN_REAL_MODEL=1 for the 2 GB WebGPU qualification');
```

Run serially in headed Chrome and load the actual engine once. Before every independent scenario, call Reset and verify conversation deletion; do not unload the engine. Preserve one conversation only across turns inside an explicit multi-turn scenario, then reset. Write a local JSON result to `process.env.JETS_GHOST_RESULT_PATH ?? 'test-results/jets-ghost-evaluation.json'` containing corpus version, browser version/channel, configured context, load time, each response, citations, source diagnostics, first-token time, completion time, and deterministic citation/abstention checks. Include empty human-review fields for each required fact and forbidden claim.

Do not upload the result automatically.

- [ ] **Step 4: Add cross-platform commands and reviewed-result validation**

```json
{
  "evaluate:jets-ghost": "cross-env RUN_REAL_MODEL=1 playwright test --config=playwright.real-model.config.ts --project=chrome-real-model",
  "evaluate:jets-ghost:production": "cross-env RUN_REAL_MODEL=1 REAL_MODEL_BASE_URL=https://jetsanchez.com playwright test --config=playwright.real-model.config.ts --project=chrome-real-model",
  "validate:evaluation:jets-ghost": "tsx scripts/validate-jets-ghost-evaluation.ts"
}
```

`validate-jets-ghost-evaluation.ts` accepts `--result=<path>` (defaulting to `test-results/jets-ghost-evaluation.json`) and fails if any supported result lacks a completed human judgment for each required fact/forbidden claim, any case lacks citation/abstention scoring, any independent scenario lacks a preceding reset, or aggregate metrics cannot be reproduced. It also recursively rejects raw request/response headers, full signed CDN URLs or signed query values, authorization/cookie fields, prompt-bearing network records, and copied source text; only the approved sanitized model-delivery summary may appear. It reports grounded success only when every required fact passes and every forbidden claim is absent.

Create `scripts/run-jets-ghost-qualification.ts` as the cross-platform device runner. It accepts only `--device=mac-apple-silicon`, `--device=windows-integrated-gpu`, or `--device=lower-memory`; creates `test-results/jets-ghost-qualification` with Node filesystem APIs; runs the sanitized model-delivery preflight; then spawns the existing real-model evaluation with `JETS_GHOST_RESULT_PATH` set in the child environment. Use `npm.cmd` on Windows and `npm` elsewhere, avoid shell interpolation, stop on the first nonzero exit, and never invoke reviewed-result validation automatically because the freshly generated human-review fields are intentionally empty. Export the orchestration function with injected spawn/filesystem seams.

Add:

```json
{
  "evaluate:jets-ghost:device": "tsx scripts/run-jets-ghost-qualification.ts"
}
```

- [ ] **Step 5: Verify fixture shape without downloading the model**

Create `tests/unit/jets-ghost/evaluation.test.ts` to enforce unique IDs, at least 60 scenarios, the complete category matrix, both discriminants, source-subset rules, reviewed-rubric shape, at least one source/fact for supported cases, none for abstention cases, explicit forbidden claims where required, multi-turn rubrics for every turn, coverage of every eligible document, and rejection of raw-header/signed-URL/source-text canaries in result validation. Create `tests/unit/jets-ghost/qualificationRunner.test.ts` to prove exact slug allowlisting, Windows/POSIX npm executable selection, directory creation, preflight-before-evaluation order, environment propagation, and stop-on-failure behavior without launching a browser or network request.

Run:

```bash
npm run test
```

- [ ] **Step 6: Commit**

```bash
git add tests/fixtures/jets-ghost/evaluation.json tests/unit/jets-ghost/evaluation.test.ts tests/unit/jets-ghost/qualificationRunner.test.ts playwright.real-model.config.ts tests/manual/jets-ghost-real-model.spec.ts scripts/validate-jets-ghost-evaluation.ts scripts/run-jets-ghost-qualification.ts package.json package-lock.json
git commit -m "test(chatbot): add grounded evaluation suite"
```

### Task 12: Review and implement model/library license obligations

**Files:**
- Create: `docs/verification/jets-ghost-licenses.md`
- Modify if required by the review: `README.md`
- Modify if required by the review: `src/pages/tools/chatbot.astro`

**Interfaces:**
- Produces: reviewed evidence that the exact Gemma and LiteRT-LM artifacts may be used as designed, plus every required public/repository notice.
- Consumes: pinned model revision/SHA, package-lock dependency graph, Gemma terms/model card, and LiteRT-LM/transitive licenses.

- [ ] **Step 1: Inventory exact artifacts and authoritative terms**

Record the pinned model repository/revision, filename, size, SHA-256, model-card URL, applicable Gemma terms URL/version/date, `@litert-lm/core@0.14.0`, and every bundled/transitive license and notice. Use authoritative model/vendor/package sources. Distinguish legal/model attribution from the repository's intentionally removed agent-attribution commit rule.

- [ ] **Step 2: Resolve distribution and disclosure questions**

Document whether browser download from Hugging Face, browser caching, bundling LiteRT-LM assets, public model naming, and any future mirroring are permitted. List every required attribution, terms link, acceptable-use notice, license file, or UI disclosure. Any unresolved obligation blocks release and retention of `noindex`.

- [ ] **Step 3: Implement and verify required notices**

Add only notices required by the reviewed terms. If no public notice is required, record that conclusion and its source rather than inventing attribution. Verify README/UI links resolve, package/license versions match the lockfile, and the displayed model identity matches the pinned artifact.

- [ ] **Step 4: Commit the license evidence**

```bash
git add docs/verification/jets-ghost-licenses.md
# Add README.md and src/pages/tools/chatbot.astro only if the review required changes.
git commit -m "docs(chatbot): record model and runtime licensing"
```

### Task 13: Qualify Gemma E2B and release Jet's Ghost 2.1.0

**Files:**
- Modify: `src/pages/tools/chatbot.astro`
- Modify: `README.md`
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `docs/verification/jets-ghost-2.1.0.md`

**Interfaces:**
- Produces: public indexed Jet's Ghost and application version `2.1.0`.
- Consumes: full real-model results from at least three qualified devices.

- [ ] **Step 1: Run real-model qualification on the required matrix**

Run `npm run evaluate:jets-ghost` on:

1. current Apple Silicon Mac;
2. current Windows integrated-GPU device;
3. lower-memory supported desktop or laptop.

Before each real-model run, execute `scripts/verify-model-delivery.ts` and store its sanitized output beside that device's result. Use stable slugs `mac-apple-silicon`, `windows-integrated-gpu`, and `lower-memory`; write results to `test-results/jets-ghost-qualification/<slug>.json` and preflights to `<slug>-model-delivery.json`. Abort before the 2 GB load if revision, identity headers, redirect host/path, or signed-query-key policy drifts.

On each device, run only its matching command:

```bash
npm run evaluate:jets-ghost:device -- --device=mac-apple-silicon
npm run evaluate:jets-ghost:device -- --device=windows-integrated-gpu
npm run evaluate:jets-ghost:device -- --device=lower-memory
```

Complete the required-fact/forbidden-claim human review in that device's generated result, then run its matching validation command. Validation intentionally occurs **after** review:

```bash
npm run validate:evaluation:jets-ghost -- --result=test-results/jets-ghost-qualification/mac-apple-silicon.json
npm run validate:evaluation:jets-ghost -- --result=test-results/jets-ghost-qualification/windows-integrated-gpu.json
npm run validate:evaluation:jets-ghost -- --result=test-results/jets-ghost-qualification/lower-memory.json
```

Require each result's measured device fields to agree with its slug before accepting it.

Record browser/OS and branded Chrome version, cold and warm load, transfer size, context length, full serialized-prompt breakdown, memory observations, device loss, first-token latency, decode rate, cancellation, reset, unload, reload, route cleanup, corpus inclusion, citation precision/recall, reviewed grounded success, abstention, package size/parse time, and privacy allowlist results. Run `npm run validate:evaluation:jets-ghost` after each human-reviewed result set. The evaluation result stores only the delivery validator's sanitized chain summary, never a signed CDN query or signature.

Collect the resulting three reviewed JSON files and three sanitized preflight files into the release operator's exact `test-results/jets-ghost-qualification/` directory without renaming or editing them, then rerun all three validation commands there before applying thresholds or packaging release evidence.

- [ ] **Step 2: Apply the release decision thresholds**

Full corpus may release only when:

```text
eligible corpus inclusion = 100%; ineligible inclusion = 0
serialized knowledge JSON including metadata/escaping <= 9,011 estimated tokens
serialized prompt + 1,024 response reserve + 3,277 estimator headroom <= 16,384 tokens
at least two complete user/assistant turns fit without discarding grounding
compressed package <= 5 MB; p95 parse <= 250 ms
p95 post-load first token <= 8 seconds on baseline
reviewed grounded-answer success >= 90%
citation precision >= 95%
citation recall >= 90%
unsupported abstention >= 90%
100% of observed requests satisfy the privacy allowlist
no repeatable device loss or unrecovered cleanup failure
Stop, Reset, Unload, reload, and ClientRouter route-away pass on every qualified device
```

If any threshold fails, do not release or remove `noindex`. Write a new Stage B metadata/lexical Superpowers spec and plan using the existing selector contract.

- [ ] **Step 3: Complete public-release metadata**

After passing every threshold and the Task 12 license gate, remove `noindex={true}` from `/tools/chatbot`, update README from qualification to available experimental tool, and include the measured support statement. Do not generalize beyond tested devices.

- [ ] **Step 4: Bump the minor version**

Run:

```bash
npm version 2.1.0 --no-git-tag-version
```

- [ ] **Step 5: Write verification evidence**

Create `docs/verification/jets-ghost-2.1.0.md` with the actual three-device table, corpus version, selector version, full context-budget breakdown, package size/parse metrics, grounded rubric totals, citation/abstention metrics, network allowlist result, lifecycle result, package/model pin, license-evidence link, known unsupported configurations, and final release decision. Every value comes from recorded runs; omit a row rather than inserting a placeholder. State that final production deployment binding and the SHA-256 manifest digest are recorded in the `v2.1.0` annotated tag and verified from downloaded release assets rather than embedding a self-referential deployment ID in the commit.

- [ ] **Step 6: Run all non-model gates again**

```bash
npm ci
npm run verify:all
git diff --check
```

Expected: all pass.

- [ ] **Step 7: Commit the release candidate**

```bash
git add src/pages/tools/chatbot.astro README.md package.json package-lock.json docs/verification/jets-ghost-2.1.0.md
git commit -m "feat(chatbot): release local Jet's Ghost"
```

- [ ] **Step 8: Deploy and inspect production**

Use the user-approved remote workflow, wait for CI/Vercel readiness, then inspect:

- initial page network before activation;
- activation disclosure;
- actual model request only after activation;
- one grounded response and source link;
- Stop, Reset, Unload, and route-away cleanup;
- absence of prompt-bearing requests;
- canonical, sitemap, and SoftwareApplication JSON-LD.

Capture and assert the aliased production deployment. Raw provider responses exist only in a mode-`0600` private temporary directory; the release artifacts receive only the shared sanitizer's allowlisted projection:

```bash
EXPECTED_SHA=$(git rev-parse HEAD)
mkdir -p test-results
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
npm run verify:production
npx tsx scripts/verify-model-delivery.ts --output=test-results/jets-ghost-2.1.0-production-model-delivery.json
npx cross-env JETS_GHOST_RESULT_PATH=test-results/jets-ghost-2.1.0-production-evaluation.json npm run evaluate:jets-ghost:production
```

Complete the same required-fact/forbidden-claim human review for the production result, then run:

```bash
npm run validate:evaluation:jets-ghost -- --result=test-results/jets-ghost-2.1.0-production-evaluation.json
```

Repeat the exact privacy allowlist and authenticated redirect-chain validation against production; a locally passing real-model run does not substitute for production readback. Assert the result schema contains no raw/signed model URL, signature, policy value, prompt-bearing network record, or source text. Keep all three production result files uncommitted because committing them would change the SHA they attest.

- [ ] **Step 9: Checksum, tag, publish, and download-verify release evidence**

Package the three reviewed device results and their sanitized delivery preflights, then checksum every release asset. The tag push and GitHub Release creation require explicit remote authorization:

```bash
QUALIFICATION_DIR="test-results/jets-ghost-qualification"
test "$(find "$QUALIFICATION_DIR" -mindepth 1 -maxdepth 1 | wc -l | tr -d ' ')" = "6"
for DEVICE_SLUG in mac-apple-silicon windows-integrated-gpu lower-memory; do
  test -f "$QUALIFICATION_DIR/$DEVICE_SLUG.json"
  test -f "$QUALIFICATION_DIR/$DEVICE_SLUG-model-delivery.json"
done
QUALIFICATION_ASSET="test-results/jets-ghost-2.1.0-qualification.tar.gz"
tar -czf "$QUALIFICATION_ASSET" -C test-results jets-ghost-qualification
CHECKSUMS="test-results/jets-ghost-2.1.0-SHA256SUMS.txt"
(cd test-results && shasum -a 256 "jets-ghost-2.1.0-vercel-deployment.json" "jets-ghost-2.1.0-production-model-delivery.json" "jets-ghost-2.1.0-production-evaluation.json" "jets-ghost-2.1.0-qualification.tar.gz" > "jets-ghost-2.1.0-SHA256SUMS.txt")
CHECKSUMS_SHA256=$(shasum -a 256 "$CHECKSUMS" | awk '{print $1}')
git tag -a v2.1.0 "$EXPECTED_SHA" -m "v2.1.0" -m "Vercel deployment: $DEPLOYMENT_ID" -m "Git SHA: $EXPECTED_SHA" -m "SHA256SUMS: $CHECKSUMS_SHA256"
git push origin v2.1.0
gh release create v2.1.0 --verify-tag --title "v2.1.0" --notes-from-tag "test-results/jets-ghost-2.1.0-vercel-deployment.json#Sanitized Vercel deployment" "test-results/jets-ghost-2.1.0-production-model-delivery.json#Sanitized model delivery" "test-results/jets-ghost-2.1.0-production-evaluation.json#Reviewed production evaluation" "$QUALIFICATION_ASSET#Three-device qualification" "$CHECKSUMS#SHA-256 manifest"
VERIFY_DIR=$(mktemp -d)
chmod 700 "$VERIFY_DIR"
trap 'rm -rf "$VERIFY_DIR"' EXIT HUP INT TERM
gh release download v2.1.0 --dir "$VERIFY_DIR" --pattern 'jets-ghost-2.1.0-*'
(cd "$VERIFY_DIR" && shasum -a 256 -c jets-ghost-2.1.0-SHA256SUMS.txt)
test "$(shasum -a 256 "$VERIFY_DIR/jets-ghost-2.1.0-SHA256SUMS.txt" | awk '{print $1}')" = "$CHECKSUMS_SHA256"
rm -rf "$VERIFY_DIR"
trap - EXIT HUP INT TERM
```

Expected: the remote already contains the annotated tag before `gh release create --verify-tag`, all five assets download, every SHA-256 check passes, and the downloaded checksum manifest's digest matches the tag annotation. Do not commit release evidence back into the tagged tree.

---

## Jet's Ghost Completion Gate

```text
[ ] Only Gemma 4 E2B is exposed
[ ] No model request occurs before explicit activation
[ ] Pinned model identity and authenticated redirect-chain preflight pass
[ ] No prompt, response, context, or history leaves the browser
[ ] Knowledge package contains only tracked published assistant content
[ ] Full corpus fits the qualified 16K profile with headroom
[ ] Cancellation, reset, unload, and route cleanup work on real WebGPU
[ ] Conversation exhaustion preserves history and requires an explicit new session
[ ] Citation and abstention thresholds pass
[ ] Unsupported visitors receive a coherent non-chat experience
[ ] README and verification evidence match measured support
[ ] License and attribution evidence is complete
[ ] Production is healthy at 2.1.0 and bound to the release Git SHA
[ ] Downloaded release artifacts match the SHA-256 manifest recorded in the tag
```
