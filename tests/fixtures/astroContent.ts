interface StubEntry {
  id: string;
  filePath?: string;
  body?: string;
  data: unknown;
}

interface StubState {
  blog: StubEntry[];
  works: StubEntry[];
  profile: StubEntry[];
  calls: string[];
}

const stateKey = '__egregoreAstroContentStub__';
const globalState = globalThis as typeof globalThis & {
  [stateKey]?: StubState;
};

function state(): StubState {
  globalState[stateKey] ??= { blog: [], works: [], profile: [], calls: [] };
  return globalState[stateKey];
}

export function setAstroContentStub(collections: {
  blog: StubEntry[];
  works: StubEntry[];
  profile?: StubEntry[];
}): void {
  globalState[stateKey] = {
    blog: collections.blog,
    works: collections.works,
    profile: collections.profile ?? [],
    calls: [],
  };
}

export function getAstroContentCalls(): string[] {
  return [...state().calls];
}

export async function getCollection(
  name: 'blog' | 'works' | 'profile',
): Promise<StubEntry[]> {
  state().calls.push(name);
  return state()[name];
}
