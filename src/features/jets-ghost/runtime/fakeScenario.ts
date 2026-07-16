import type {
  SelectedSource,
  SelectionResult,
} from '../selection/types';

export const FAKE_SCENARIOS = [
  'default',
  'checking',
  'unsupported',
  'load-failure',
  'generation-failure',
  'reset-failure',
  'unload-failure',
  'loading',
  'unloading',
  'long-stream',
  'stop-recovery',
  'citations',
  'zero-citation',
  'exhaustion',
  'late-event',
] as const;

export type FakeScenario = typeof FAKE_SCENARIOS[number];

export interface FakeScenarioRequest {
  testBuild: boolean;
  hostname: string;
  search: string;
  pathname?: string;
  sessionAuthorized?: boolean;
}

export interface ResolvedFakeScenario {
  scenario: FakeScenario;
  slowStream: boolean;
}

type ScenarioFailurePoint =
  | 'capability'
  | 'load'
  | 'generation'
  | 'reset'
  | 'unload';

export interface FakeScenarioConfiguration {
  responseChunks: readonly string[];
  failures?: Partial<Record<ScenarioFailurePoint, true | number>>;
  capabilityDelayMs?: number;
  loadDelayMs?: number;
  unloadDelayMs?: number;
  chunkDelayMs?: number;
  exhaustAfterCompletedGenerations?: number;
  emitLateChunkAfterCancellation?: boolean;
}

const DEFAULT_RESPONSE_CHUNKS = [
  "Jet's published work connects local-first AI ",
  'with systems thinking [S1].',
] as const;

const LONG_RESPONSE_CHUNKS = [
  "Jet's published work connects local-first AI ",
  'with systems thinking [S1]. ',
  'Across the archive, practical implementation notes sit beside research questions, ',
  'with each response grounded in the published material available on this site. ',
  'That combination keeps the answer useful while preserving a clear path back ',
  'to the exact source a reader can inspect for context and nuance.',
] as const;

const FAKE_SOURCE_SENTINEL = 'JG_SOURCE_SENTINEL_4a6c1b';

export function getFakeScenarioConfiguration(
  scenario: FakeScenario,
): FakeScenarioConfiguration {
  switch (scenario) {
    case 'checking':
      return { responseChunks: DEFAULT_RESPONSE_CHUNKS, capabilityDelayMs: 60_000 };
    case 'unsupported':
      return { responseChunks: DEFAULT_RESPONSE_CHUNKS, failures: { capability: true } };
    case 'load-failure':
      return { responseChunks: DEFAULT_RESPONSE_CHUNKS, failures: { load: 1 } };
    case 'generation-failure':
      return { responseChunks: DEFAULT_RESPONSE_CHUNKS, failures: { generation: 1 } };
    case 'reset-failure':
      return { responseChunks: DEFAULT_RESPONSE_CHUNKS, failures: { reset: 1 } };
    case 'unload-failure':
      return { responseChunks: DEFAULT_RESPONSE_CHUNKS, failures: { unload: 1 } };
    case 'loading':
      return { responseChunks: DEFAULT_RESPONSE_CHUNKS, loadDelayMs: 60_000 };
    case 'unloading':
      return { responseChunks: DEFAULT_RESPONSE_CHUNKS, unloadDelayMs: 5_000 };
    case 'long-stream':
    case 'stop-recovery':
      return { responseChunks: LONG_RESPONSE_CHUNKS, chunkDelayMs: 120 };
    case 'citations':
      return {
        responseChunks: [
          'The research develops a structural-attractor argument [S2] [S3], ',
          'while related published work provides implementation context [S1] [S2].',
        ],
      };
    case 'zero-citation':
      return {
        responseChunks: [
          "Jet's published archive includes writing, research, and project notes.",
        ],
      };
    case 'exhaustion':
      return {
        responseChunks: DEFAULT_RESPONSE_CHUNKS,
        exhaustAfterCompletedGenerations: 1,
      };
    case 'late-event':
      return {
        responseChunks: LONG_RESPONSE_CHUNKS,
        chunkDelayMs: 120,
        emitLateChunkAfterCancellation: true,
      };
    case 'default':
      return { responseChunks: DEFAULT_RESPONSE_CHUNKS, capabilityDelayMs: 50 };
  }
}

function withCitationId(
  source: SelectedSource,
  index: number,
): SelectedSource {
  return {
    ...source,
    citationId: `S${index + 1}`,
  };
}

export function configureFakeCitationSelection(
  selection: SelectionResult,
): SelectionResult {
  const primary = selection.sources[0];
  if (primary === undefined) return selection;

  const duplicateDocument = selection.sources.find((source) => (
    source !== primary
    && source.canonicalUrl === primary.canonicalUrl
  ));
  const distinctDocument = selection.sources.find((source) => (
    source.canonicalUrl !== primary.canonicalUrl
  ));
  if (duplicateDocument === undefined || distinctDocument === undefined) {
    return selection;
  }

  const fixtureSources = [distinctDocument, primary, duplicateDocument];
  const fixtureIds = new Set(fixtureSources.map(({ chunkId }) => chunkId));
  const remaining = selection.sources.filter(({ chunkId }) => !fixtureIds.has(chunkId));

  return {
    ...selection,
    sources: [...fixtureSources, ...remaining].map(withCitationId),
  };
}

export function configureFakeSourceSentinel(
  selection: SelectionResult,
): SelectionResult {
  if (selection.sources.length === 0) return selection;

  return {
    ...selection,
    sources: selection.sources.map((source, index) => (
      index === 0
        ? { ...source, text: `${source.text} ${FAKE_SOURCE_SENTINEL}` }
        : source
    )),
  };
}

export function resolveFakeScenario({
  testBuild,
  hostname,
  search,
  pathname,
  sessionAuthorized = false,
}: FakeScenarioRequest): ResolvedFakeScenario | null {
  if (
    !testBuild
    || (hostname !== '127.0.0.1' && hostname !== 'localhost')
  ) return null;

  const searchParams = new URLSearchParams(search);
  const explicitFakeRuntime = searchParams.get('runtime') === 'fake';
  const continuedFakeRuntime = sessionAuthorized
    && pathname === '/chatbot/'
    && searchParams.get('runtime') === null;
  if (!explicitFakeRuntime && !continuedFakeRuntime) return null;

  const requestedScenario = searchParams.get('scenario');
  const scenario = requestedScenario !== null
    && (FAKE_SCENARIOS as readonly string[]).includes(requestedScenario)
    ? requestedScenario as FakeScenario
    : 'default';

  return {
    scenario,
    slowStream: searchParams.get('stream') === 'slow',
  };
}
