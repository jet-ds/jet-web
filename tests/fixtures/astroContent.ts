interface StubEntry {
  id: string;
  filePath?: string;
  body?: string;
  data: unknown;
}

interface StubState {
  blog: StubEntry[];
  works: StubEntry[];
  calls: string[];
}

const stateKey = '__egregoreAstroContentStub__';
const globalState = globalThis as typeof globalThis & { [stateKey]?: StubState };

function state(): StubState {
  globalState[stateKey] ??= { blog: [], works: [], calls: [] };
  return globalState[stateKey];
}

export function setAstroContentStub(collections: {
  blog: StubEntry[];
  works: StubEntry[];
}): void {
  globalState[stateKey] = {
    blog: collections.blog,
    works: collections.works,
    calls: [],
  };
}

export function getAstroContentCalls(): string[] {
  return [...state().calls];
}

export async function getCollection(name: 'blog' | 'works'): Promise<StubEntry[]> {
  state().calls.push(name);
  return state()[name];
}
