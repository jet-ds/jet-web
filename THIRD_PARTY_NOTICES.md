# Egregore third-party notices

This index covers the exact browser model, runtime, runtime assets, and retrieval libraries currently used by Egregore. The component pins and license bytes remain unchanged from the 2.1.0 release record. Complete license texts are available from the public [Apache 2.0 license](/licenses/apache-2.0.txt) endpoint and the [Model and open-source licenses](https://jetsanchez.com/licenses/egregore/) surface.

## Apache License 2.0 artifacts

The full [Apache License 2.0](/licenses/apache-2.0.txt) text applies to all entries in this section.

### Gemma 4 E2B LiteRT-LM model

- Repository: `litert-community/gemma-4-E2B-it-litert-lm`
- Revision: `9262660a1676eed6d0c477ab1a86344430854664`
- Filename: `gemma-4-E2B-it-web.litertlm`
- URL: `https://huggingface.co/litert-community/gemma-4-E2B-it-litert-lm/resolve/9262660a1676eed6d0c477ab1a86344430854664/gemma-4-E2B-it-web.litertlm`
- Size: `2,008,432,640` bytes
- SHA-256: `3a08e8d94e23b814ae5414469c370c503813949acb8ceaa17e4ebf8a35af35b5`
- Pinned model card: `https://huggingface.co/litert-community/gemma-4-E2B-it-litert-lm/blob/9262660a1676eed6d0c477ab1a86344430854664/README.md`
- Google model card: `https://ai.google.dev/gemma/docs/core/model_card_4`
- License source: `https://ai.google.dev/gemma/apache_2`

The pinned repository declares `apache-2.0`, identifies `google/gemma-4-E2B-it` as the base model, and contains no model-specific copyright line or upstream `NOTICE` file. Google DeepMind is retained as model provenance through the linked model cards, not converted into an invented copyright notice.

### `@litert-lm/core@0.14.0` and eight served runtime assets

- Version: `0.14.0`
- Lock integrity: `sha512-JQhvU6o6JY/Hyg5D59Xblp2H/Ynu4+a6omjekV3a+N2weh9pLnI3+ZP8AlkTbTjJjST893p3VuXd7O8dWelDCA==`
- Exact npm tarball SHA-256: `07a56eac0b6a322764c6de908fa8cda83fa898ad15c256ae8a1e504df7189683`
- Corroborating license: `https://github.com/google-ai-edge/LiteRT-LM/blob/80f301ff9a3b02c2c1e7be2dd1a567752f7b51b6/LICENSE`

Observed package-header statements:

- `Copyright 2025 Google LLC`
- `Copyright 2026 Google LLC`
- `Copyright 2026 The ODML Authors.`

The site serves these exact, unmodified files under `/assistant/runtime/litert-lm/0.14.0/`:

| Asset | Bytes | SHA-256 |
|---|---:|---|
| `litertlm_wasm_asyncify_internal.js` | 299,492 | `0923d5f9aec5d67d4727bc3a5d1f7c8b869888e6871af7aebf7f4409d85f205a` |
| `litertlm_wasm_asyncify_internal.wasm` | 31,087,784 | `b5fc9badbc1269e11a0e584f8181dd344a89b20c9b23af588a8425b61fc0aa91` |
| `litertlm_wasm_compat_asyncify_internal.js` | 299,703 | `e70290e04da1707ad5a0ab6b2d7710fe142cde2531f5d7af911ee0e6ca01121b` |
| `litertlm_wasm_compat_asyncify_internal.wasm` | 31,061,346 | `6241ce86fe188a9d082e411bed3f9e48ed7f6ca489b2a593b789f7a7c007296e` |
| `litertlm_wasm_compat_internal.js` | 292,178 | `cf05b41a3b9a61fe9dab3aa89466187e08cda08ca8a8ef12f6a2eeaf280208bd` |
| `litertlm_wasm_compat_internal.wasm` | 19,821,785 | `ddae2e0bdadbd465adbf1c8a5243a466e2a225e2a0d54261c43fcfc81e3d9947` |
| `litertlm_wasm_internal.js` | 291,938 | `7445e88c57cab3e645dff2136e9321d0a9e7be0616afbec1c928e7fdb5691d6f` |
| `litertlm_wasm_internal.wasm` | 19,848,204 | `54c3c54b6fedc89267556ba73abeab2f6ec3cfdece8c6e9e0e2d71e9786f437b` |

### `@litertjs/wasm-utils@2.5.0`

- Version: `2.5.0`
- Lock integrity: `sha512-zhMAqJRJ3ROi48flZxYx+K2MiMllJVuH7oeumpSIfQMBeOb6JyLV/7ltLbY6E+nERUAfNwzIBqjslWAeXcO6iQ==`
- Exact npm tarball SHA-256: `31005ff8a5fb3b57e6deaa71302e7238f8943f096a1cadcc464e0213981010ae`
- Corroborating license: `https://github.com/google-ai-edge/LiteRT/blob/5c5b9ce68875f51af2fee3d7d7a9929df8be977f/LICENSE`
- Observed statement: `Copyright 2025 Google LLC`

## MIT-licensed artifacts

### `minisearch@7.2.0`

- Version: `7.2.0`
- Lock integrity: `sha512-dqT2XBYUOZOiC5t2HRnwADjhNS2cecp9u+TJRiJ1Qp/f5qjkeT5APcGPjHw+bz89Ms8Jp+cG4AlE+QZ/QnDglg==`
- Exact npm tarball SHA-256: `cb3b8126a3ea65d6b387787294f0792b0ea4a40b70f8f37688066a5638e0218a`
- Exact license SHA-256: `70d37354d6395629fb99edb28cb37a5d356ffa24a48cd02a5def5b83a300a899`
- License: [MIT license](/licenses/minisearch-7.2.0-MIT.txt)
- `Copyright 2022 Luca Ongaro`

### `stemmer@2.0.1`

- Version: `2.0.1`
- Lock integrity: `sha512-bkWvSX2JR4nSZFfs113kd4C6X13bBBrg4fBKv2pVdzpdQI2LA5pZcWzTFNdkYsiUNl13E4EzymSRjZ0D55jBYg==`
- Exact npm tarball SHA-256: `e94a3698cc7c6efcd2a9f29e94868c64c03416e86a1eea355bb3e5b059608900`
- Exact license SHA-256: `9966260ba3ea9d6a5f839297dca80ddc99735a34b4ae82811cac7b956d2e3afd`
- License: [MIT license](/licenses/stemmer-2.0.1-MIT.txt)
- `Copyright (c) 2014 Titus Wormer <tituswormer@gmail.com>`

## Notice and modification status

No upstream `NOTICE` file was present in the reviewed model repository, exact npm packages, or named upstream trees. No upstream `NOTICE` text is invented. The eight publicly served LiteRT-LM assets are copied without modification. A future patch, rebuild, model conversion, mirror, package upgrade, or authoritative upstream SBOM/notice inventory triggers a fresh audit.
