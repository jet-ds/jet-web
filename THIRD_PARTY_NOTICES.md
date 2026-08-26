# Egregore third-party notices

This index covers the exact browser model, runtime, runtime assets, retrieval libraries, and constrained Markdown renderer currently used by Egregore. The pinned LiteRT-LM model and runtime bytes remain unchanged; this notice adds the reviewed renderer graph. Complete license texts are available from the public license endpoints and the [Model and open-source licenses](https://jetsanchez.com/licenses/egregore/) surface.

## Self-hosted site fonts

The site distributes the following Latin, normal-style webfont files. The exact Fontsource packages below are build-time packaging sources; Fontsource is not identified as a font author or copyright holder.

| Family | Build-time package | Version | License | Copyright holder |
|---|---|---:|---|---|
| Brawler | `@fontsource/brawler` | `5.3.0` | SIL Open Font License 1.1 | Copyright 2011 The Brawler Project Authors (https://github.com/cyrealtype/Brawler) |
| Work Sans | `@fontsource-variable/work-sans` | `5.3.0` | SIL Open Font License 1.1 | Copyright 2019 The Work Sans Project Authors (https://github.com/weiweihuanghuang/Work-Sans) |
| JetBrains Mono | `@fontsource-variable/jetbrains-mono` | `5.3.0` | SIL Open Font License 1.1 | Copyright 2020 The JetBrains Mono Project Authors (https://github.com/JetBrains/JetBrainsMono) |

The font software is redistributed under the following terms.

### SIL Open Font License Version 1.1 — 26 February 2007

The goals of the Open Font License (OFL) are to stimulate worldwide development of collaborative font projects, to support the font creation efforts of academic and linguistic communities, and to provide a free and open framework in which fonts may be shared and improved in partnership with others.

The OFL allows the licensed fonts to be used, studied, modified and redistributed freely as long as they are not sold by themselves. The fonts, including any derivative works, can be bundled, embedded, redistributed and/or sold with any software provided that any reserved names are not used by derivative works. The fonts and derivatives, however, cannot be released under any other type of license. The requirement for fonts to remain under this license does not apply to any document created using the fonts or their derivatives.

#### Definitions

"Font Software" refers to the set of files released by the Copyright Holder(s) under this license and clearly marked as such. This may include source files, build scripts and documentation.

"Reserved Font Name" refers to any names specified as such after the copyright statement(s).

"Original Version" refers to the collection of Font Software components as distributed by the Copyright Holder(s).

"Modified Version" refers to any derivative made by adding to, deleting, or substituting — in part or in whole — any of the components of the Original Version, by changing formats or by porting the Font Software to a new environment.

"Author" refers to any designer, engineer, programmer, technical writer or other person who contributed to the Font Software.

#### Permission and conditions

Permission is hereby granted, free of charge, to any person obtaining a copy of the Font Software, to use, study, copy, merge, embed, modify, redistribute, and sell modified and unmodified copies of the Font Software, subject to the following conditions:

1. Neither the Font Software nor any of its individual components, in Original or Modified Versions, may be sold by itself.
2. Original or Modified Versions of the Font Software may be bundled, redistributed and/or sold with any software, provided that each copy contains the above copyright notice and this license. These can be included either as stand-alone text files, human-readable headers or in the appropriate machine-readable metadata fields within text or binary files as long as those fields can be easily viewed by the user.
3. No Modified Version of the Font Software may use the Reserved Font Name(s) unless explicit written permission has been granted by the corresponding Copyright Holder. This restriction only applies to the primary font name as presented to the users.
4. The name(s) of the Copyright Holder(s) or the Author(s) of the Font Software shall not be used to promote, endorse or advertise any Modified Version, except to acknowledge the contribution(s) of the Copyright Holder(s) and the Author(s) or with their explicit written permission.
5. The Font Software, modified or unmodified, in part or in whole, must be distributed entirely under this license, and must not be distributed under any other license. The requirement for fonts to remain under this license does not apply to any document created using the Font Software.

#### Termination

This license becomes null and void if any of the above conditions are not met.

#### Disclaimer

THE FONT SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO ANY WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT OF COPYRIGHT, PATENT, TRADEMARK, OR OTHER RIGHT. IN NO EVENT SHALL THE COPYRIGHT HOLDER BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, INCLUDING ANY GENERAL, SPECIAL, INDIRECT, INCIDENTAL, OR CONSEQUENTIAL DAMAGES, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF THE USE OR INABILITY TO USE THE FONT SOFTWARE OR FROM OTHER DEALINGS IN THE FONT SOFTWARE.

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

### `react-markdown@10.1.0`

- Version: `10.1.0`
- Lock integrity: `sha512-qKxVopLT/TyA6BX3Ue5NwabOsAzm0Q7kAPwq6L+wWDwisYs7R8vZ0nRXqq6rkueboxpkjvLGU9fWifiX/ZZFxQ==`
- Exact license SHA-256: `f6196c64e144f9a6fa9154c3a80bc8b89615a9567934b83a8951879f06ba2aef`
- License: [MIT license](/licenses/react-markdown-10.1.0-MIT.txt)
- `Copyright (c) Espen Hovlandsdal`

### `remark-gfm@4.0.1`

- Version: `4.0.1`
- Lock integrity: `sha512-1quofZ2RQ9EWdeN34S79+KExV1764+wCUGop5CPL1WGdD0ocPpu91lzPGbwWMECpEpd42kJGQwzRfyov9j4yNg==`
- Exact license SHA-256: `dd1081884a92952802f4803110a6bb543acea9a814c786d58605b4c1219b5ebb`
- License: [MIT license](/licenses/remark-gfm-4.0.1-MIT.txt)
- `Copyright (c) Titus Wormer <tituswormer@gmail.com>`

### Constrained Markdown renderer dependency graph

The reviewed browser renderer contains 73 runtime packages: the two direct packages above plus 71 transitive packages. Seventy-two packages are MIT-licensed. `@ungap/structured-clone@1.3.0` is ISC-licensed and retains `Copyright (c) 2021, Andrea Giammarchi, @WebReflection`. The complete [renderer dependency license bundle](/licenses/egregore-markdown-renderer-dependencies.txt) names every exact package version and groups the 21 unique authoritative license byte sets without omitting any copyright or permission notice.

- Exact combined license-bundle SHA-256: `edd3692451ecbfeeddfb1d83a0ec08e20a7e9f5984b96d4ff72c9eb7b86b0489`

## Notice and modification status

No upstream `NOTICE` file was present in the reviewed model repository, exact npm packages, renderer graph, or named upstream trees. No upstream `NOTICE` text is invented. The eight publicly served LiteRT-LM assets are copied without modification, and their identities are not changed by the renderer addition. A future patch, rebuild, model conversion, mirror, package upgrade, or authoritative upstream SBOM/notice inventory triggers a fresh audit.
