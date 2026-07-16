# Jet's Ghost 2.1.0 qualification evidence

**Qualification status:** Pass.

This document is the in-place evidence record for the required real-model qualification. It contains no conversation content or sensitive delivery values. One full headed qualification exercised cold and warm activation, all six reviewed product cases, and lifecycle closeout. After those phases completed, the run exposed two harness-contract issues rather than product failures: the ordinary-discovery case was being scored as exhaustive cross-document enumeration, and Partytown's fixed same-origin sandbox document was missing from the exact request classifier. Both contracts were narrowed with failing-then-passing tests. The existing two-case real-model smoke then passed supported grounding, unsupported abstention, the complete corrected request ledger, lifecycle cleanup, and device-loss checks. The six-case model exercise was not repeated because that would add retrieval experimentation without changing the product decision.

## Tested system

| Field | Result |
| --- | --- |
| Apple Silicon hardware | Apple M4, 16 GB unified memory. |
| WebGPU adapter | `apple`, `metal-3`; real model loaded and generated successfully. |
| macOS version | `26.5` (`25F71`). |
| Installed branded Chrome version | `150.0.7871.116`. |

## Pinned delivery identity

| Field | Pinned value or qualification state |
| --- | --- |
| Application | `jet-web@2.1.0` |
| Model | Gemma 4 E2B LiteRT-LM |
| Model repository | `litert-community/gemma-4-E2B-it-litert-lm` |
| Repository revision | `9262660a1676eed6d0c477ab1a86344430854664` |
| Filename | `gemma-4-E2B-it-web.litertlm` |
| Initial URL | `https://huggingface.co/litert-community/gemma-4-E2B-it-litert-lm/resolve/9262660a1676eed6d0c477ab1a86344430854664/gemma-4-E2B-it-web.litertlm` |
| Expected complete size | `2,008,432,640` bytes |
| Expected SHA-256 | `3a08e8d94e23b814ae5414469c370c503813949acb8ceaa17e4ebf8a35af35b5` |
| Trusted hostnames | `huggingface.co`, `*.cdn.hf.co`, and `*.xethub.hf.co` |
| Maximum redirects | `5` |
| LiteRT-LM | `@litert-lm/core@0.14.0` |
| Same-origin LiteRT-LM path | `/assistant/runtime/litert-lm/0.14.0/` |
| Qualification verification mode | Complete independent download, byte count, and locally calculated SHA-256; passed. |
| Observed redirect depth | `1`; within the configured maximum of `5`. |

LiteRT-LM `0.14.0` accepts URL, `Blob`, and `ReadableStream<Uint8Array>` model sources. Jet's Ghost deliberately passes the pinned URL. It does not add application-owned incremental hashing or buffering, does not perform a second verification download for the runtime, and does not claim that each visitor's executed model bytes receive an independent SHA-256 check. Runtime guarantees are limited to explicit consent, pinned initial URL use, trusted HTTPS delivery containment, bounded redirects, and request privacy.

## Measurements

### Knowledge and context

| Measurement | Result |
| --- | --- |
| Corpus version | `a86019f454ddfb6a106ff6db22ebb1f9058c507a863a5455728e783da948d9aa` |
| Index configuration version | `1.1.0` |
| MiniSearch version | `7.2.0` |
| Stemmer version | `2.0.1` |
| Corpus artifact size, fetch, hash, and parse | Manifest `596` bytes; content `58,389` bytes; cold corpus fetch `9 ms`, warm `4 ms`; validation included below. |
| Index artifact size, fetch, hash, and hydration | `72,623` bytes; cold index fetch `9 ms`, warm `3 ms`; version-matched hydration passed. |
| Indexed and eligible chunk identity agreement | `66` indexed chunks matched `66` eligible chunks across `3` documents and `38` sections. |
| Serialized knowledge JSON | Full eligible package `12,772` estimated tokens; rank-and-pack enforced the configured `9,011`-token knowledge budget. |
| Serialized prompt budget | Passed with a `1,024`-token response reserve and `3,277`-token estimator headroom within `16,384` tokens. |
| Conversation configuration | `maxOutputTokens = 1,024`; real generation passed. |
| Two grounded turns without discarded grounding | Passed in the browser lifecycle suite; qualification cases intentionally reset between questions. |

### Loading and response lifecycle

| Measurement | Result |
| --- | --- |
| Cold engine-ready time | `37,198 ms`. |
| Cold model transfer time | `36,599 ms`. |
| Cold corpus fetch time | `9 ms`. |
| Cold index fetch time | `9 ms`. |
| Cold validation and hydration time | `466 ms`. |
| Warm engine-ready time | `37,099 ms`. |
| Warm model transfer time | `36,534 ms`. |
| Warm corpus fetch time | `4 ms`. |
| Warm index fetch time | `3 ms`. |
| Warm validation and hydration time | `514 ms`. |
| First-token latency | Six-case range `518–11,483 ms`; post-fix smoke `1,008–1,140 ms`. |
| Total-response latency | Six-case range `802–23,509 ms`; post-fix smoke `1,013–3,429 ms`. |
| Stop latency and settled state | Passed within the bounded lifecycle assertion; returned to Ready with a visible stopped response. |
| New session reset | Passed between all six cases and during closeout. |
| Unload | Passed after cold activation, during closeout, and in the post-fix smoke. |
| Reload | Fresh activation after unload passed. |
| Route-away cleanup and route re-entry | Contact route-away, Ghost route re-entry, fresh activation, and final unload passed. |
| Visible memory pressure | Non-isolated host; system reported `61%` memory free immediately after qualification. No clean-room memory claim is made. |
| Device-loss events | `0` in the post-fix real-model smoke. |

## Six-case product review

| Case ID | Disposition | Useful-answer | Factual-support | Abstention | Citation-validity | Source-inspectability | Short non-content rationale |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `showcase-claude-native` | Pass | Pass | Pass | N/A | Pass | Pass | Visible review approved; first token `11,483 ms`, total `11,485 ms`. |
| `showcase-rch-claim` | Pass | Pass | Pass | N/A | Pass | Pass | Visible review approved; first token `1,068 ms`, total `3,362 ms`. |
| `ordinary-agent-writing` | Pass | Pass | Pass | N/A | Pass | Pass | Visible review approved; cited a reviewed expected source. Exhaustive document coverage is reserved for the explicit cross-document case; first token `10,680 ms`, total `23,509 ms`. |
| `cross-review-control` | Pass | Pass | Pass | N/A | Pass | Pass | Visible review approved with both expected documents; first token `10,561 ms`, total `17,877 ms`. |
| `unsupported-private-note` | Pass | Pass | Pass | Pass | Pass | N/A | Exact unsupported-answer prefix, no citation; first token `1,042 ms`, total `1,046 ms`. |
| `unsupported-private-schedule` | Pass | Pass | Pass | Pass | Pass | N/A | Exact unsupported-answer prefix, no citation; first token `518 ms`, total `802 ms`. |

## Privacy and lifecycle

| Gate | Result |
| --- | --- |
| Explicit activation before assistant resource requests | Pass in the full qualification and post-fix smoke. |
| Same-origin LiteRT-LM assets only; no SDK-runtime CDN request | Pass. |
| Observed-request privacy allowlist | Pass. The initially rejected request was isolated as Partytown's fixed same-origin sandbox document and admitted only through its exact path, document method/type, and bare 13-digit timestamp shape; the corrected full ledger passed in the real-model smoke. |
| Conversation-derived request data absent | Pass. |
| Every rendered citation resolves to selected evidence | Pass under the category-appropriate machine rule and visible human review. |
| Both unsupported cases abstain | Pass; exact prefix and no citations. |
| Stop, New session, Unload, and reload recovery | Pass. |
| Fresh SDK initialization after unload and route re-entry | Pass. |
| Route-away cleanup | Pass. |
| Repeatable device loss or unrecovered cleanup failure | None observed; post-fix smoke device-loss count `0`. |

## License evidence

The reviewed distribution obligations and residual provenance limitations are recorded in the [Task 12 Jet's Ghost license evidence](./jets-ghost-licenses.md).

## Known limitations and unqualified configurations

- The qualification covers one available Apple Silicon Mac using its installed branded Chrome. Windows, lower-memory systems, mobile devices, other browsers, and other hardware remain unqualified rather than inferred from this run.
- The runtime uses the pinned URL directly. The qualification independently downloads and hashes the complete model artifact once, but Jet's Ghost does not independently hash the bytes LiteRT-LM executes in each visitor's browser.
- LiteRT-LM `0.14.0` implements the global `LiteRtLm.delete()` as a no-op. Jet's Ghost still deletes conversations and engines and clears its SDK singleton, but Unload does not claim immediate reclamation of every WASM allocation or browser-owned GPU resource.
- The ordinary discovery fixture validates at least one reviewed expected source plus no unacceptable source. Only the deliberately cross-document fixture requires every expected document; this keeps human usefulness and claim-level citation review from becoming an accidental exhaustive-retrieval benchmark.
- Final Preview and Production behavior, indexing state, deployment routing, and live smoke results are outside this predeployment qualification record and remain separate release gates.

## Release disposition

**Qualified.** The local candidate may proceed to the Production-only indexing implementation, complete repository verification, exact-SHA noindexed Preview, and the remaining ordered release gates. No Preview, Production, indexing request, tag, or release completion is claimed by this document.
