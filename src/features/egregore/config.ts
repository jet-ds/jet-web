export const EGREGORE_MODEL = {
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

export const EGREGORE_MODEL_CACHE = {
  schemaVersion: 'v1',
} as const;

export const EGREGORE_CONTEXT = {
  maxContextTokens: 8_192,
  systemLimit: 640,
  questionLimit: 384,
  responseReserve: 1_024,
  knowledgeLimit: 6_144,
  estimatorHeadroom: 1_024,
} as const;

export const EGREGORE_PATHS = {
  manifest: '/assistant/corpus/manifest.json',
  content: '/assistant/corpus/content.json',
  index: '/assistant/corpus/index.json',
  liteRtWasm: '/assistant/runtime/litert-lm/0.14.0/',
  liteRtLicense: '/assistant/runtime/litert-lm/0.14.0/LICENSE.txt',
} as const;
