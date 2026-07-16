# Jet's Ghost license verification

This is an engineering verification of the exact Jet's Ghost 2.1.0 distribution bundle, not legal advice. It records the evidence captured on 2026-07-16 and the implementation required to preserve that evidence in the repository and public build.

## Exact distribution identity

| Artifact | Exact identity | Distribution behavior |
|---|---|---|
| Gemma 4 E2B LiteRT-LM model | `litert-community/gemma-4-E2B-it-litert-lm` revision `9262660a1676eed6d0c477ab1a86344430854664`, `gemma-4-E2B-it-web.litertlm`, 2,008,432,640 bytes, SHA-256 `3a08e8d94e23b814ae5414469c370c503813949acb8ceaa17e4ebf8a35af35b5` | The browser downloads the pinned object directly from Hugging Face after explicit visitor action. The site does not mirror or rename it. |
| LiteRT-LM runtime | `@litert-lm/core@0.14.0`, npm integrity `sha512-JQhvU6o6JY/Hyg5D59Xblp2H/Ynu4+a6omjekV3a+N2weh9pLnI3+ZP8AlkTbTjJjST893p3VuXd7O8dWelDCA==`, tarball SHA-256 `07a56eac0b6a322764c6de908fa8cda83fa898ad15c256ae8a1e504df7189683` | Eight unmodified JavaScript and WebAssembly assets are copied to a versioned public path. Their byte counts and hashes are listed in `THIRD_PARTY_NOTICES.md`. |
| LiteRT utilities | `@litertjs/wasm-utils@2.5.0`, npm integrity `sha512-zhMAqJRJ3ROi48flZxYx+K2MiMllJVuH7oeumpSIfQMBeOb6JyLV/7ltLbY6E+nERUAfNwzIBqjslWAeXcO6iQ==`, tarball SHA-256 `31005ff8a5fb3b57e6deaa71302e7238f8943f096a1cadcc464e0213981010ae` | Bundled runtime dependency. |
| Search library | `minisearch@7.2.0`, npm integrity `sha512-dqT2XBYUOZOiC5t2HRnwADjhNS2cecp9u+TJRiJ1Qp/f5qjkeT5APcGPjHw+bz89Ms8Jp+cG4AlE+QZ/QnDglg==`, tarball SHA-256 `cb3b8126a3ea65d6b387787294f0792b0ea4a40b70f8f37688066a5638e0218a` | Bundled retrieval dependency. |
| Stemmer | `stemmer@2.0.1`, npm integrity `sha512-bkWvSX2JR4nSZFfs113kd4C6X13bBBrg4fBKv2pVdzpdQI2LA5pZcWzTFNdkYsiUNl13E4EzymSRjZ0D55jBYg==`, tarball SHA-256 `e94a3698cc7c6efcd2a9f29e94868c64c03416e86a1eea355bb3e5b059608900` | Bundled retrieval dependency. |

## Confirmed license obligations

Google's current Gemma Terms explicitly route Gemma 4 to the separate Apache License 2.0 and omit Gemma 4 from the Terms appendix. Accordingly, the legacy Gemma Terms special Notice and clickwrap wording do not apply to Gemma 4 and are not imported into this bundle. Google's standalone Prohibited Use Policy still uses generic Gemma wording, while the reviewed Gemma 4 Apache license does not incorporate that policy. The imperfect alignment between those policy pages is an advice-worthy residual ambiguity, not an identified prohibition or an evidence-backed obligation to add policy clickwrap.

- The model repository declares Apache License 2.0 and links the Gemma 4 model card. The complete Apache text is retained at `LICENSES/Apache-2.0.txt` and is exposed on the public license surface.
- `@litert-lm/core@0.14.0` and `@litertjs/wasm-utils@2.5.0` are Apache-2.0 licensed. The distribution preserves the license text, records the observed Google LLC and ODML Authors copyright statements, and provides a versioned license sibling beside the LiteRT-LM assets.
- `minisearch@7.2.0` and `stemmer@2.0.1` are MIT licensed. Their exact package license bytes and copyright notices are retained in versioned files and exposed publicly.
- The reviewed sources and packages contain no upstream `NOTICE` file. Apache section 4(d) therefore creates no identified upstream notice text to reproduce. No notice is invented.
- The project does not imply endorsement by Google, Google DeepMind, the ODML Authors, Luca Ongaro, Titus Wormer, Hugging Face, or the upstream projects.

The repository-level `THIRD_PARTY_NOTICES.md`, exact license files, pre-load disclosure, README provenance, public license page, plain-text endpoints, and build verifier implement these obligations for the known bundle.

## Verified upstream packaging and provenance defects

The published `@litert-lm/core@0.14.0` package does not map cleanly to the reviewed upstream tag/source layout, and neither the package nor repository supplied a complete authoritative SBOM or transitive inventory. The pinned model repository also omits a repository-local license file and `NOTICE`, even though its metadata declares Apache-2.0 and the linked Gemma license source supplies the applicable text.

These are real upstream packaging and provenance defects. They limit the strength of source-to-tarball and transitive-completeness claims, but the absence of an authoritative SBOM does not by itself block distribution of the exact reviewed bundle.

## Hypothetical undisclosed transitive-license risk

An undisclosed generated-code, embedded-binary, or transitive dependency license could exist outside the evidence exposed by the exact packages and upstream sources. That is a residual supply-chain risk, not a confirmed conflicting obligation. The risk is bounded operationally by pinning package and asset bytes, recording their hashes, avoiding local modifications, and requiring a fresh audit when any model, package, asset, mirror, conversion, or upstream inventory changes.

## Actual release blockers

No presently identified license blocks distribution of the exact known bundle.

Actual license-compliance blockers are tied to identified terms. Redistributing the known Apache-licensed runtime copies without giving recipients the Apache text would fail [Apache License 2.0 section 4(a)](https://www.apache.org/licenses/LICENSE-2.0.txt). Redistributing copies or substantial portions of MiniSearch or stemmer without their copyright and permission notices would fail the condition in each exact MIT license. A newly confirmed applicable upstream notice or incompatible license term could also block until satisfied or removed.

The stable public routes, byte-equality checks, pinned hashes, and pre-load placement are project delivery gates, not established license requirements in their own right. In particular, pre-load UI timing is a transparency and recipient-access design choice; Apache 2.0 does not state that timing requirement. A missing route or changed pin correctly fails this project's release pipeline because the reviewed evidence is no longer proven. Any pin or hash drift triggers re-audit rather than proving a legal prohibition.

## Primary evidence

- [Pinned model repository README](https://huggingface.co/litert-community/gemma-4-E2B-it-litert-lm/blob/9262660a1676eed6d0c477ab1a86344430854664/README.md)
- [Gemma 4 model card](https://ai.google.dev/gemma/docs/core/model_card_4)
- [Gemma Apache 2.0 license](https://ai.google.dev/gemma/apache_2)
- [Gemma Terms routing Gemma 4 to a separate license](https://ai.google.dev/gemma/terms)
- [Generic Gemma Prohibited Use Policy](https://ai.google.dev/gemma/prohibited_use_policy)
- [LiteRT-LM license at reviewed commit](https://github.com/google-ai-edge/LiteRT-LM/blob/80f301ff9a3b02c2c1e7be2dd1a567752f7b51b6/LICENSE)
- [LiteRT license at reviewed commit](https://github.com/google-ai-edge/LiteRT/blob/5c5b9ce68875f51af2fee3d7d7a9929df8be977f/LICENSE)
- `@litert-lm/core@0.14.0`: [registry metadata](https://registry.npmjs.org/%40litert-lm%2Fcore/0.14.0), [exact tarball](https://registry.npmjs.org/@litert-lm/core/-/core-0.14.0.tgz)
- `@litertjs/wasm-utils@2.5.0`: [registry metadata](https://registry.npmjs.org/%40litertjs%2Fwasm-utils/2.5.0), [exact tarball](https://registry.npmjs.org/@litertjs/wasm-utils/-/wasm-utils-2.5.0.tgz)
- `minisearch@7.2.0`: [registry metadata](https://registry.npmjs.org/minisearch/7.2.0), [exact tarball](https://registry.npmjs.org/minisearch/-/minisearch-7.2.0.tgz), [exact upstream license](https://github.com/lucaong/minisearch/blob/3d239d1c3ae7aef1bf5d8945dd7b5f0709f646f5/LICENSE.txt)
- `stemmer@2.0.1`: [registry metadata](https://registry.npmjs.org/stemmer/2.0.1), [exact tarball](https://registry.npmjs.org/stemmer/-/stemmer-2.0.1.tgz), [exact upstream license](https://github.com/words/stemmer/blob/74966c2bc432fc0f7873142268badded3368f405/license)
