# Jet's Ghost 2.1.0 chat experience

**Status:** Final approved interface direction and implementation prototype for 2.1.0

**Canonical production route:** `/chatbot`

**Current prototype route:** `/tools/chatbot` (to move during integration)

This note records the final interaction decisions represented by the prototype. The interface, responsive treatment, animation states, copy, and activation boundaries are approved as the 2.1.0 design direction. Integration into the broader Jet's Ghost architecture and release plan still needs to connect the real local runtime and corpus, reverse the temporary route redirects, and harden the experience with the plan's full test and accessibility matrix. The prototype itself does not load the production model or answer from the production corpus.

## Design direction

Jet's Ghost uses one calm, full-viewport canvas. The navigation dock remains visible as the site-level escape hatch; there is no second sidebar or modal frame. The empty state borrows the restraint of current Claude and ChatGPT chat surfaces, while the local-model lifecycle remains visible through Jet's own status, color, typography, and spacing system.

The composer is the visual anchor. Suggested questions disappear once the conversation begins. User turns use a compact surface; assistant responses remain unboxed for readable long-form answers. Sources sit directly beneath the response instead of occupying a permanent panel before they exist.

Jet's Ghost is a first-class site experience rather than a child of Tools. For 2.1.0, `/chatbot` is the canonical route and receives a dedicated Ghost dock item in place of Tools. `/tools/chatbot` permanently redirects to `/chatbot`. The Tools hub may remain dormant for future utilities, but it should not occupy primary navigation until it contains multiple standalone tools.

## Recommended activation and loading boundaries

| Moment | Work allowed | Work deferred |
| --- | --- | --- |
| Ghost dock click / route navigation | Render the Astro shell and React interface. | No LiteRT import, corpus request, capability probe, model request, or engine creation. |
| Check compatibility | Inspect secure-context and WebGPU capabilities and report supported, warning, or unsupported. | No model or corpus download. No engine creation. |
| Load Jet's Ghost | After the visitor has seen the approximate 2 GB and GPU-memory disclosure, dynamically import LiteRT, fetch the versioned corpus, fetch the pinned model, and create one engine and conversation. | No prompt is assembled and no generation occurs. |
| Ready before the first message | Keep the engine and corpus warm for this page instance; focus the composer. | No additional activation step and no conversation data leaves the browser. |
| First and later messages | Select grounded context, assemble the prompt, and generate locally. | Do not silently download a second model, change runtime strategy, or persist the thread. |
| New session | Delete/reset the current conversation, preserve the loaded engine and corpus, then clear the visible transcript only after reset succeeds. | Do not re-download the model. |
| Unload or route away | Cancel generation, delete the conversation, unload corpus resources, then delete the engine; suppress late stream events. | No background engine or session survives the page instance. |

This preserves the approved two-action consent model: compatibility is cheap and reversible; the explicit load button is the only boundary that authorizes the heavy download and GPU allocation. Loading on route navigation or on the first submitted message is not recommended. Route activation would violate informed consent, while first-message activation makes the primary action feel broken behind a multi-minute download.

Progress should be determinate only when the runtime exposes trustworthy byte or phase data. Otherwise show the current phase and elapsed time without inventing a percentage. The prototype simulates staged progress for interaction review without presenting an “illustrative progress” disclaimer in the interface.

## assistant-ui evaluation

assistant-ui is viable but not the recommended dependency for the first 2.1.0 release.

As checked on 2026-07-12, `@assistant-ui/react` 0.14.26 supports React 18 and 19. Its External Store Runtime can translate Jet's existing message state and callbacks, supports streaming and cancellation, and leaves rendering composable. The project is MIT-licensed and actively maintained. It would be a credible choice if Jet's Ghost later needs branching, message editing, persisted thread lists, attachments, tool parts, or several interchangeable chat backends.

For 2.1.0, the trade-off points the other way:

- Jet's Ghost has one session-only thread, one local runtime, and no tools, attachments, editing, branching, or persistence.
- Its most important states happen before a thread exists: capability, consent, a roughly 2 GB download, local engine creation, unload, and unsupported recovery.
- The existing architecture already owns lifecycle and message state, so External Store Runtime would wrap that state rather than simplify it.
- The core package currently carries a wider dependency and capability surface than this focused experience needs, while its styled starters target a broader shadcn-style chat product.

The prototype therefore stays custom and installs no assistant-ui packages. Re-evaluate assistant-ui when at least two of the richer thread capabilities become committed product requirements, or when maintaining accessible message/composer primitives is demonstrably costing more than the adapter layer.

## Prototype scope

The branch implements the approved full-screen layout, compatibility/consent/loading/ready/generating states, stateful ghost animations, session controls, responsive dock clearance, Utopia-based desktop/mobile typography, mustard accent treatment, and a transparent canned response that demonstrates message and citation presentation. The current preview remains mounted at `/tools/chatbot` so the broader integration work can move it to `/chatbot`, reverse the redirect, replace Tools with Ghost in the dock, and update canonical, sitemap, structured-data, containment, and navigation tests together. It deliberately stops at the local-generation boundary; the production model, corpus, privacy allowlist, runtime lifecycle, accessibility hardening, and full test matrix remain governed by the integrated Jet's Ghost plan.
