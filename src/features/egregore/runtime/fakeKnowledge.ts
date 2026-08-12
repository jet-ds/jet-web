import type { LoadedKnowledgeBase } from '../corpus/repository';
import type {
  ChunkId,
  DocumentId,
  KnowledgeChunk,
  KnowledgeDocument,
  KnowledgePackage,
  KnowledgeSection,
  SectionId,
} from '../corpus/types';
import { estimateTokens } from '../tokenEstimate';
import {
  buildSearchIndexArtifact,
  loadSearchIndex,
} from '../selection/searchIndex';
import { serializeSourcePayload } from '../sourcePayload';

const CORPUS_VERSION = 'a'.repeat(64);
const INDEX_SHA256 = 'b'.repeat(64);

const documents: KnowledgeDocument[] = [
  {
    id: 'blog:local-first-agentic-systems',
    order: 0,
    collection: 'blog',
    slug: 'local-first-agentic-systems',
    title: 'Local-First Agentic Systems',
    description: 'How local AI, agentic work, and systems thinking connect.',
    canonicalUrl: 'https://jetsanchez.com/blog/local-first-agentic-systems/',
    tags: ['local AI', 'agentic work', 'systems thinking'],
    author: 'Jet Sanchez',
    publishedAt: '2026-01-01T00:00:00.000Z',
    sourcePath: 'src/data/blog/local-first-agentic-systems.mdx',
    sourceHash: '1'.repeat(64),
  },
  {
    id: 'works:recursive-convergence-hypothesis',
    order: 1,
    collection: 'works',
    slug: 'recursive-convergence-hypothesis',
    title:
      'The Recursive Convergence Hypothesis: Emergent Sentience as a Structural Attractor of Recursive ASI',
    description: 'Research on recursive systems and emergent sentience.',
    canonicalUrl:
      'https://jetsanchez.com/works/recursive-convergence-hypothesis/',
    tags: ['AI research', 'recursive systems'],
    author: 'Jet Sanchez',
    publishedAt: '2026-01-02T00:00:00.000Z',
    sourcePath: 'src/data/works/recursive-convergence-hypothesis.mdx',
    sourceHash: '2'.repeat(64),
  },
];

const sections: KnowledgeSection[] = [
  {
    id: 'blog:local-first-agentic-systems#connections',
    documentId: 'blog:local-first-agentic-systems',
    heading: 'Connecting local AI and agentic work',
    headingPath: ['Connecting local AI and agentic work'],
    order: 0,
  },
  {
    id: 'works:recursive-convergence-hypothesis#structural-attractor',
    documentId: 'works:recursive-convergence-hypothesis',
    heading: 'The structural-attractor argument',
    headingPath: ['The structural-attractor argument'],
    order: 0,
  },
];

function chunk(
  id: ChunkId,
  documentId: DocumentId,
  sectionId: SectionId,
  text: string,
  order: number,
  contentHash: string,
): KnowledgeChunk {
  return {
    id,
    documentId,
    sectionId,
    text,
    estimatedTokens: estimateTokens(text),
    order,
    contentHash,
    sameTextOccurrence: 0,
  };
}

const chunks: KnowledgeChunk[] = [
  chunk(
    `blog:local-first-agentic-systems#connections:${'3'.repeat(64)}:0`,
    'blog:local-first-agentic-systems',
    'blog:local-first-agentic-systems#connections',
    "Jet's published work connects local-first AI with agentic work and systems thinking.",
    0,
    '3'.repeat(64),
  ),
  chunk(
    `blog:local-first-agentic-systems#connections:${'4'.repeat(64)}:0`,
    'blog:local-first-agentic-systems',
    'blog:local-first-agentic-systems#connections',
    'The practical projects explore browser-local tools, technical workflows, and grounded assistance.',
    1,
    '4'.repeat(64),
  ),
  chunk(
    `works:recursive-convergence-hypothesis#structural-attractor:${'5'.repeat(64)}:0`,
    'works:recursive-convergence-hypothesis',
    'works:recursive-convergence-hypothesis#structural-attractor',
    'The recursive convergence hypothesis develops a structural-attractor argument about emergent sentience in recursive ASI.',
    0,
    '5'.repeat(64),
  ),
  chunk(
    `works:recursive-convergence-hypothesis#structural-attractor:${'6'.repeat(64)}:0`,
    'works:recursive-convergence-hypothesis',
    'works:recursive-convergence-hypothesis#structural-attractor',
    'The research connects recursive systems, AI safety, and the conditions under which sentience could emerge.',
    1,
    '6'.repeat(64),
  ),
];

const knowledgePackage: KnowledgePackage = {
  schemaVersion: '1.0.0',
  segmentationVersion: '1.0.0',
  corpusVersion: CORPUS_VERSION,
  sourceCommit: 'egregore-fake-knowledge',
  documents,
  sections,
  chunks,
  statistics: {
    documentCount: documents.length,
    sectionCount: sections.length,
    chunkCount: chunks.length,
    estimatedContentTokens: chunks.reduce(
      (total, item) => total + item.estimatedTokens,
      0,
    ),
    fullCorpusKnowledgeTokens: serializeSourcePayload(
      chunks.map((item, index) => {
        const document = documents.find(({ id }) => id === item.documentId)!;
        const section = sections.find(({ id }) => id === item.sectionId)!;
        return {
          citationId: `S${index + 1}` as `S${number}`,
          documentId: document.id,
          sectionId: section.id,
          chunkId: item.id,
          title: document.title,
          canonicalUrl: document.canonicalUrl,
          heading: section.heading,
          text: item.text,
        };
      }),
    ).estimatedTokens,
  },
};

async function buildFakeKnowledgeBase(): Promise<LoadedKnowledgeBase> {
  const searchArtifact = buildSearchIndexArtifact(knowledgePackage);
  const documentsById = new Map(
    documents.map((document) => [document.id, document]),
  );
  const sectionsById = new Map(
    sections.map((section) => [section.id, section]),
  );
  const chunksById = new Map(chunks.map((item) => [item.id, item]));
  const neighborsByChunkId = new Map<
    ChunkId,
    { previous?: ChunkId; next?: ChunkId }
  >([
    [chunks[0].id, { next: chunks[1].id }],
    [chunks[1].id, { previous: chunks[0].id }],
    [chunks[2].id, { next: chunks[3].id }],
    [chunks[3].id, { previous: chunks[2].id }],
  ]);

  return {
    package: knowledgePackage,
    searchIndex: await loadSearchIndex(searchArtifact, CORPUS_VERSION),
    documentsById,
    sectionsById,
    chunksById,
    neighborsByChunkId,
    indexSha256: INDEX_SHA256,
    indexConfigVersion: searchArtifact.indexConfigVersion,
    miniSearchVersion: searchArtifact.miniSearchVersion,
    stemmerVersion: searchArtifact.stemmerVersion,
  };
}

export function createFakeKnowledgeRepository(): {
  load: (signal?: AbortSignal) => Promise<LoadedKnowledgeBase>;
  unload: () => void;
} {
  let loaded: Promise<LoadedKnowledgeBase> | undefined;
  return {
    load: (signal) => {
      if (signal?.aborted === true) {
        return Promise.reject(new DOMException('Aborted', 'AbortError'));
      }
      loaded ??= buildFakeKnowledgeBase();
      return loaded;
    },
    unload: () => {
      loaded = undefined;
    },
  };
}
