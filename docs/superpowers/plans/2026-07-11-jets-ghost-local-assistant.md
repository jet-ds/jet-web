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
- Release Jet's Ghost as backward-compatible feature version `1.1.0` only after real-model qualification.

---

## File Structure

```text
src/features/jets-ghost/
├── config.ts
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
tests/manual/jets-ghost-real-model.spec.ts
tests/fixtures/jets-ghost/evaluation.json
docs/verification/jets-ghost-1.1.0.md
```

---

### Task 1: Pin the local model and context profile

**Files:**
- Create: `src/features/jets-ghost/config.ts`
- Create: `tests/unit/jets-ghost/config.test.ts`
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `tsconfig.json`

**Interfaces:**
- Produces: `JETS_GHOST_MODEL`, `JETS_GHOST_CONTEXT`, `JETS_GHOST_PATHS`.
- Consumes: model revision `9262660a1676eed6d0c477ab1a86344430854664`.

- [ ] **Step 1: Install pinned runtime and parsing dependencies**

Run:

```bash
npm install --save-exact @litert-lm/core@0.14.0 unified remark-parse remark-mdx mdast-util-to-string
npm install --save-dev @types/mdast @webgpu/types
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
  });

  it('reserves context headroom', () => {
    expect(JETS_GHOST_CONTEXT.knowledgeLimit).toBe(9_011);
    expect(JETS_GHOST_CONTEXT.maxContextTokens).toBe(16_384);
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
} as const;

export const JETS_GHOST_CONTEXT = {
  maxContextTokens: 16_384,
  systemReserve: 1_024,
  conversationReserve: 2_048,
  responseReserve: 1_024,
  knowledgeLimit: 9_011,
} as const;

export const JETS_GHOST_PATHS = {
  manifest: '/assistant/corpus/manifest.json',
  content: '/assistant/corpus/content.json',
} as const;
```

- [ ] **Step 4: Verify and commit**

```bash
npm run test -- tests/unit/jets-ghost/config.test.ts
npm run check
git add package.json package-lock.json tsconfig.json src/features/jets-ghost/config.ts tests/unit/jets-ghost/config.test.ts
git commit -m "build(chatbot): pin LiteRT-LM and Gemma E2B"
```

### Task 2: Build normalized knowledge-domain primitives

**Files:**
- Create: `src/features/jets-ghost/corpus/types.ts`
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
export type ChunkId = `${SectionId}:${string}`;

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

Do not add a build timestamp.

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

<Widget label="decorative" />
`);

    expect(sections).toEqual([
      { heading: 'Introduction', headingPath: ['Introduction'], text: 'Intro paragraph.', order: 0 },
      { heading: 'Install', headingPath: ['Install'], text: 'Run the command.\n\nnpm install example', order: 1 },
    ]);
  });
});
```

- [ ] **Step 3: Implement AST-aware normalization**

Create `normalize.ts` using `unified().use(remarkParse).use(remarkMdx).parse(source)`. Iterate root children and:

- skip `mdxjsEsm`, `mdxFlowExpression`, `mdxTextExpression`, `mdxJsxFlowElement`, and `mdxJsxTextElement` nodes;
- start a new section on headings of depth 2 through 4;
- maintain a heading stack by depth;
- convert other nodes with `toString(node)`;
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
    expect(result.chunks[0].id).toMatch(/^blog:example#install:[a-f0-9]{12}$/);
  });

  it('never exceeds the 512-token hard limit', () => {
    const text = Array.from({ length: 600 }, (_, index) => `word${index}`).join(' ');
    const result = segmentDocument({
      documentId: 'blog:large',
      sections: [{ heading: 'Large', headingPath: ['Large'], text, order: 0 }],
    });
    expect(result.chunks.every((chunk) => chunk.estimatedTokens <= 512)).toBe(true);
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

Use paragraph/list boundaries, keep code blocks intact when they fit, never cross document boundaries, slugify heading paths, append deterministic ordinals for duplicate paths, and use the first 12 hexadecimal characters of SHA-256 normalized text for each chunk ID.

- [ ] **Step 6: Run and commit**

```bash
npm run test -- tests/unit/jets-ghost/normalize.test.ts tests/unit/jets-ghost/segment.test.ts
npm run check
git add src/features/jets-ghost/corpus tests/unit/jets-ghost/normalize.test.ts tests/unit/jets-ghost/segment.test.ts
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

Define input independent of Astro internals:

```ts
export interface AssistantSourceEntry {
  collection: 'blog' | 'works';
  slug: string;
  body: string;
  data: {
    title: string;
    description: string;
    status: 'draft' | 'published';
    assistant: boolean;
    tags: string[];
    author?: string;
    pubDate?: Date;
    date?: Date;
    updatedDate?: Date;
  };
}
```

Export:

```ts
export function buildKnowledgePackage(
  entries: AssistantSourceEntry[],
  sourceCommit: string,
): { manifest: CorpusManifest; content: KnowledgePackage };
```

Sort by collection and slug, normalize and segment only eligible entries, construct canonical URLs from `SITE.siteUrl`, calculate `contentSha256`, then calculate `corpusVersion` from schema version plus canonical content. Use canonical key ordering before hashing.

- [ ] **Step 3: Create a shared Astro package loader**

In both static endpoint files, call a shared local function that:

```ts
const [blog, works] = await Promise.all([
  getCollection('blog', ({ data }) => isAssistantEligible(data)),
  getCollection('works', ({ data }) => isAssistantEligible(data)),
]);
```

Map entries to `AssistantSourceEntry`, build with:

```ts
const sourceCommit =
  process.env.VERCEL_GIT_COMMIT_SHA ??
  process.env.GITHUB_SHA ??
  'local';
```

Return JSON with:

```ts
headers: {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'public, max-age=0, must-revalidate',
}
```

- [ ] **Step 4: Write repository tests**

Create `tests/unit/jets-ghost/repository.test.ts` with mocked `fetch`. Test successful version matching and rejection when `manifest.corpusVersion !== content.corpusVersion` or `manifest.contentSha256` does not match canonical content.

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
```

Expected: only explicitly eligible tracked sources are listed; the active draft is absent.

- [ ] **Step 7: Commit**

```bash
git add src/features/jets-ghost/corpus src/pages/assistant tests/unit/jets-ghost/corpusBuild.test.ts tests/unit/jets-ghost/repository.test.ts
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
  sectionId: SectionId;
  chunkId: ChunkId;
  title: string;
  canonicalUrl: string;
  heading: string;
  text: string;
  estimatedTokens: number;
}
```

Define `ContextBudget`, `SelectionInput`, `SelectionDiagnostics`, `SelectionResult`, and `ContextSelector` exactly as the spec requires.

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

- orders documents, sections, and chunks by their stored order;
- resolves each chunk to its document and section;
- assigns `S1`, `S2`, and subsequent IDs;
- sums `estimatedTokens`;
- throws a typed `context-budget-exceeded` error when the total exceeds `knowledgeLimit`;
- reports strategy, corpus version, source/chunk counts, token count, and zero ranking latency beyond deterministic assembly.

It never truncates or ranks.

- [ ] **Step 4: Verify and commit**

```bash
npm run test -- tests/unit/jets-ghost/fullCorpus.test.ts
git add src/features/jets-ghost/selection tests/unit/jets-ghost/fullCorpus.test.ts
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

Assert the prompt contains stable `<source>` boundaries, never includes an unselected source, retains complete recent turns within 2,048 tokens, and instructs abstention. Assert citation parsing accepts `[S1]`, deduplicates repeated valid IDs, and rejects `[S99]` when not selected.

- [ ] **Step 2: Implement prompt assembly**

Export:

```ts
export interface AssembledPrompt {
  preface: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
  userMessage: string;
  selectedSources: SelectedSource[];
  estimatedTokens: number;
}

export function assemblePrompt(
  query: string,
  history: ConversationHistoryTurn[],
  selection: SelectionResult,
  budget: ContextBudget,
): AssembledPrompt;
```

The system message identifies Jet's Ghost, restricts answers to supplied sources, treats source text as untrusted reference material, requires `[S#]` citations, distinguishes published claims from synthesis, and requires explicit abstention when unsupported.

Render each selected source exactly as:

```text
<source id="S1" document="blog:slug" section="blog:slug#heading">
Title: Source title
URL: https://jetsanchez.com/blog/slug
Heading: Heading
Content: normalized source text
</source>
```

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
git add src/features/jets-ghost/prompt tests/unit/jets-ghost/prompt.test.ts tests/unit/jets-ghost/citations.test.ts
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

Define the approved error-code union and ensure diagnostics never require prompt or response content.

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
git add src/features/jets-ghost/runtime tests/unit/jets-ghost/capabilities.test.ts tests/unit/jets-ghost/lifecycle.test.ts
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

Test capability check, explicit load, corpus load, full-corpus overflow, session creation, streaming, valid citations, Stop, Reset, Unload, generation recovery, route-unmount cleanup, and conversation reserve exhaustion.

- [ ] **Step 3: Implement `useJetsGhost()`**

The hook receives dependency factories so tests can inject fakes. For each question:

1. select context;
2. assemble preface with bounded history;
3. call `runtime.createSession(preface)` so only one conversation exists;
4. stream the current user message;
5. parse citations after completion;
6. append the complete turn;
7. return to ready.

Cleanup calls repository `unload()` and runtime `unload()`. Use an operation ID to suppress late events.

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
- deterministic partial-response rule: cancellation retains the partial response labeled “Stopped”;
- semantic design tokens and Utopia spacing only;
- focus moves to the input after load/reset and to the error action after failure;
- reduced motion disables nonessential transitions.

- [ ] **Step 6: Add a development-only fake runtime seam**

In `JetsGhostApp`, allow `?runtime=fake` only when `import.meta.env.DEV` is true. Production always constructs `LiteRtGemmaRuntime`. This powers E2E without downloading the model.

- [ ] **Step 7: Verify and commit**

```bash
npm run test -- tests/unit/jets-ghost/useJetsGhost.test.tsx tests/unit/jets-ghost/ui.test.tsx
npm run check
git add src/features/jets-ghost/state src/features/jets-ghost/ui tests/unit/jets-ghost/useJetsGhost.test.tsx tests/unit/jets-ghost/ui.test.tsx
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

- [ ] **Step 1: Test explicit activation and no eager model request**

In `jets-ghost.spec.ts`, record all requests, open `/tools/chatbot?runtime=fake`, and assert no URL includes `litert`, `huggingface`, or `.litertlm` before activation.

- [ ] **Step 2: Test supported flow**

Use the fake capability report to:

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

- [ ] **Step 4: Test unsupported and failure states**

Cover no WebGPU, model load failure, corpus version mismatch, generation failure, and recovery. No unsupported state renders an enabled chat input.

- [ ] **Step 5: Enforce the privacy network contract**

For every request after submitting a distinctive sentinel prompt, inspect URL, method, headers, and post data. Fail when the sentinel or selected source text appears outside same-origin static corpus GETs. Analytics requests may exist but must contain no prompt data.

- [ ] **Step 6: Add axe and keyboard checks**

Run axe on introduction, ready, response, and error states. Assert the live status region exists, streamed response is not itself `aria-live`, and all actions are keyboard reachable.

- [ ] **Step 7: Run and commit**

```bash
npm run test:e2e -- tests/e2e/jets-ghost.spec.ts tests/e2e/accessibility.spec.ts
git add tests/e2e/jets-ghost.spec.ts tests/e2e/accessibility.spec.ts
git commit -m "test(chatbot): verify lifecycle and local privacy"
```

### Task 11: Establish the evaluation corpus and real-model harness

**Files:**
- Create: `tests/fixtures/jets-ghost/evaluation.json`
- Create: `tests/manual/jets-ghost-real-model.spec.ts`
- Modify: `package.json`

**Interfaces:**
- Produces: at least 50 versioned questions and `npm run evaluate:jets-ghost`.
- Consumes: actual Gemma/WebGPU route and source/citation output.

- [ ] **Step 1: Create the evaluation schema and 50 concrete cases**

Create `evaluation.json` with these exact 50 cases:

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

- [ ] **Step 2: Implement the opt-in real-model Playwright test**

The test must skip unless:

```ts
test.skip(process.env.RUN_REAL_MODEL !== '1', 'Set RUN_REAL_MODEL=1 for the 2 GB WebGPU qualification');
```

Run serially in headed Chrome, load the actual assistant once, execute the dataset, and write a JSON result containing corpus version, browser version, configured context, load time, each response, citations, first-token time, completion time, and pass/fail source/abstention checks.

Do not upload the result automatically.

- [ ] **Step 3: Add the explicit evaluation command**

```json
{
  "evaluate:jets-ghost": "RUN_REAL_MODEL=1 playwright test tests/manual/jets-ghost-real-model.spec.ts --project=chromium --headed --workers=1"
}
```

- [ ] **Step 4: Verify fixture shape without downloading the model**

Add a unit test or inline script that asserts exactly 50 unique IDs, valid categories, at least one expected source for supported cases, no expected source for abstention cases, and coverage of all three eligible documents.

Run:

```bash
npm run test
```

- [ ] **Step 5: Commit**

```bash
git add tests/fixtures/jets-ghost/evaluation.json tests/manual/jets-ghost-real-model.spec.ts package.json
git commit -m "test(chatbot): add grounded evaluation suite"
```

### Task 12: Qualify Gemma E2B and release Jet's Ghost 1.1.0

**Files:**
- Modify: `src/pages/tools/chatbot.astro`
- Modify: `README.md`
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `docs/verification/jets-ghost-1.1.0.md`

**Interfaces:**
- Produces: public indexed Jet's Ghost and application version `1.1.0`.
- Consumes: full real-model results from at least three qualified devices.

- [ ] **Step 1: Run real-model qualification on the required matrix**

Run `npm run evaluate:jets-ghost` on:

1. current Apple Silicon Mac;
2. current Windows integrated-GPU device;
3. lower-memory supported desktop or laptop.

Record browser/OS, cold and warm load, transfer size, context length, memory observations, device loss, first-token latency, decode rate, cancellation, reset, unload, reload, route cleanup, source Recall@8, citation precision/recall, grounded success, and abstention.

- [ ] **Step 2: Apply the release decision thresholds**

Full corpus may release only when:

```text
knowledge <= 9,011 estimated tokens
p95 post-load first token <= 8 seconds on baseline
source Recall@8 >= 90%
citation precision >= 95%
citation recall >= 90%
unsupported abstention >= 90%
no repeatable device loss or unrecovered cleanup failure
```

If any threshold fails, do not release or remove `noindex`. Write a new Stage B metadata/lexical Superpowers spec and plan using the existing selector contract.

- [ ] **Step 3: Complete public-release metadata**

After passing, remove `noindex={true}` from `/tools/chatbot`, update README from qualification to available experimental tool, and include the measured support statement. Do not generalize beyond tested devices.

- [ ] **Step 4: Bump the minor version**

Run:

```bash
npm version 1.1.0 --no-git-tag-version
```

- [ ] **Step 5: Write verification evidence**

Create `docs/verification/jets-ghost-1.1.0.md` with the actual three-device table, corpus version, selector version, context profile, metric table, network inspection result, lifecycle result, package/model pin, known unsupported configurations, and final release decision. Every value comes from recorded runs; omit a row rather than inserting a placeholder.

- [ ] **Step 6: Run all non-model gates again**

```bash
npm ci
npm run verify:all
git diff --check
```

Expected: all pass.

- [ ] **Step 7: Commit the release candidate**

```bash
git add src/pages/tools/chatbot.astro README.md package.json package-lock.json docs/verification/jets-ghost-1.1.0.md
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

- [ ] **Step 9: Tag after production readback**

```bash
git tag -a v1.1.0 -m "v1.1.0"
```

Push the tag only with explicit remote authorization.

---

## Jet's Ghost Completion Gate

```text
[ ] Only Gemma 4 E2B is exposed
[ ] No model request occurs before explicit activation
[ ] No prompt, response, context, or history leaves the browser
[ ] Knowledge package contains only tracked published assistant content
[ ] Full corpus fits the qualified 16K profile with headroom
[ ] Cancellation, reset, unload, and route cleanup work on real WebGPU
[ ] Citation and abstention thresholds pass
[ ] Unsupported visitors receive a coherent non-chat experience
[ ] README and verification evidence match measured support
[ ] Production is healthy at 1.1.0
```
