# Jet's Ghost 2.1.0 chat experience

**Status:** Final approved interface direction and implementation prototype for 2.1.0

**Canonical production route:** `/chatbot/`

**Current prototype route:** `/tools/chatbot/` (to move during integration)

This note records the final interaction decisions represented by the prototype. The interface, responsive treatment, animation states, copy, and activation boundaries are approved as the 2.1.0 design direction. Integration into the broader Jet's Ghost architecture and release plan still needs to connect the real local runtime and corpus, reverse the temporary route redirects, and harden the experience with the plan's full test and accessibility matrix. The prototype itself does not load the production model or answer from the production corpus.

## Design direction

Jet's Ghost uses one calm, full-viewport canvas. The navigation dock remains visible as the site-level escape hatch; there is no second sidebar or modal frame. The empty state borrows the restraint of current Claude and ChatGPT chat surfaces, while the local-model lifecycle remains visible through Jet's own status, color, typography, and spacing system.

The composer is the visual anchor. Before the first submitted message, the exact reliability disclosure **Jet’s Ghost can make mistakes. Check cited sources.** sits immediately above the composer form inside its stack. Choosing a suggested question only fills and focuses the draft, so the disclosure remains. The first actual submit removes it without reserved space; it returns only after a successful New session transition or a successful requested Unload, while generation, reset, and unload failures preserve the submitted state. Suggested questions follow the same session boundary. User turns use a compact surface; assistant responses remain unboxed for readable long-form answers.

Inline citation links remain exact and independently usable. Beneath each completed or stopped assistant response, a collapsed source disclosure derives only from that turn's validated citations, never from selected or packed context that the answer did not cite. It deduplicates cited chunks by `canonicalUrl` in stable first-citation order and uses the first cited ID, title, and URL for each document. A response with zero cited documents renders no disclosure; a stopped response may still render its separate **Stopped** label.

The disclosure is collapsed by default and its trigger reads **1 source** or **N sources** with a chevron. It is a semantic button whose `aria-expanded` and `aria-controls` identify an in-flow source region and list owned by that response. Expanded items are clean text links that show the citation number and full document title with natural wrapping and no title truncation. The trigger has a minimum 44px touch target, visible keyboard focus, and reduced-motion-safe state changes. The list stays within the assistant response column: full-width-safe at 320px and 430px, aligned at tablet portrait and landscape widths, and compact with a controlled readable width on desktop.

The genuinely content-sized, chrome-free status group sits before the stable header actions in the right flex row and contains only the state dot and compact label. It has no fixed or minimum width, placeholder or invisible sizer, border, background, rounded container, shadow, or padding. **Ready** stays compact; **Responding** grows leftward while the action boxes and brand anchor remain fixed. New session and Unload remain mounted through conversational lifecycle states so those actions, not status width, own the right edge. New session is enabled only when a new session can start safely; Unload stays enabled for safe requests and retries and is disabled during active unloading. Intro, compatibility, consent, loading, load-error, and unsupported states have no header actions and are exempt from neighboring-anchor stability. The row adds no artificial gap beyond its normal `gap-2xs`. Visible copy is restricted to exactly six compact labels: **Not running**, **Checking**, **Load ready**, **Loading**, **Ready**, and **Responding**. The production lifecycle maps every internal state to one of those values; the header never appends a loading percentage.

Label changes crossfade inside the natural-width status group with outgoing and incoming layers sharing one CSS-grid cell. Both layers contribute intrinsic width until the outgoing fade completes, then the group shrinks without clipping the longer label. Reduced-motion preference renders only the current normal-flow label and replaces it immediately. The animation is presentation-only and must not become a second lifecycle machine. A separate visually hidden polite live region announces fuller lifecycle language, including cancellation, reset, unload, and error states; the visible compact label is not itself the live region.

Composer metadata follows the visitor's input mode. The keyboard hint **Enter sends · Shift+Enter newline** is removed from touch/mobile layout with `display: none`; it appears only at the explicit desktop/tablet width plus fine-pointer breakpoint. **Local only** remains visible at every width. The mobile metadata row aligns naturally to the end without an empty left column or reserved placeholder, while a desktop keyboard shows both items on one nowrap line with space between them.

Composer focus follows actual interaction modality rather than viewport width. Pointer, touch, and pen submissions blur the textarea synchronously before generation and remain blurred after completion, cancellation, or recovery; every key event from a touch- or pen-focused composer preserves virtual-keyboard modality through Enter. Mouse focus followed by hardware Enter may become keyboard modality. Keyboard Load, hardware-Enter submit, and keyboard New session retain or restore composer focus, while pointer/touch Load and New session do not summon a virtual keyboard.

Conversation movement uses intentional sticky follow inside the conversation scroller and end sentinel, never the page body. Submission advances to the new user turn and assistant state; touch submission performs its final positioning only after software-keyboard visual-viewport changes settle. New streamed content follows while the reader remains within a small bottom threshold. Manual scroll-away suspends following, later content exposes a compact accessible **Jump to latest** control, and reaching the bottom or activating that control restores follow without moving composer focus. Programmatic movement respects reduced motion, and safe in-flow bottom clearance keeps completed responses and their collapsed source disclosure clear of the composer and navigation dock.

Jet's Ghost is a first-class site experience rather than a child of Tools. For 2.1.0, `/chatbot/` is the canonical `200` document and receives a dedicated Ghost dock item in place of Tools. Vercel normalizes `/chatbot` to `/chatbot/` and `/tools/chatbot` to `/tools/chatbot/`; the sole explicit legacy rule permanently redirects `/tools/chatbot/` to `/chatbot/`. The Tools hub may remain dormant for future utilities, but it should not occupy primary navigation until it contains multiple standalone tools.

## Recommended activation and loading boundaries

| Moment | Work allowed | Work deferred |
| --- | --- | --- |
| Ghost dock click / route navigation | Render the Astro shell and React interface. | No LiteRT import, corpus request, capability probe, model request, or engine creation. |
| Check compatibility | Inspect secure-context and WebGPU capabilities and report supported, warning, or unsupported. | No model or corpus download. No engine creation. |
| Load Jet's Ghost | After the visitor has seen the approximate 2 GB and GPU-memory disclosure, dynamically import LiteRT, fetch the versioned corpus, fetch the pinned model, and create one engine and conversation. | No prompt is assembled and no generation occurs. |
| Loading | Use the loading-only phase-in ghost, mono eyebrow, independently cycling themed serif headline, monotonic elapsed time, and reserved secondary reassurance slot while the non-abortable LiteRT call is pending. | No progress bar, ring spinner, fabricated percentage, or Cancel or Unload action that the runtime cannot honor. Closing or reloading the document remains the browser-owned way to terminate the page and its work. |
| Ready before the first message | Keep the engine and corpus warm for this page instance; focus the composer only when Load was initiated with keyboard interaction modality. | No additional activation step and no conversation data leaves the browser. |
| First and later messages | Select grounded context, assemble the prompt, and generate locally. | Do not silently download a second model, change runtime strategy, or persist the thread. |
| New session | Delete/reset the current conversation, preserve the loaded engine and corpus, then clear the visible transcript only after reset succeeds; restore composer focus only for keyboard initiation. | Do not re-download the model. |
| Unload or route away | Cancel generation, delete the conversation, unload corpus resources, then delete the engine; suppress late stream events. | No background engine or session survives the page instance. |

This preserves the approved two-action consent model: compatibility is cheap and reversible; the explicit load button is the only boundary that authorizes the heavy download and GPU allocation. Loading on route navigation or on the first submitted message is not recommended. Route activation would violate informed consent, while first-message activation makes the primary action feel broken behind a multi-minute download.

LiteRT-LM 0.14.0 exposes neither trustworthy byte progress nor in-place load cancellation. Loading therefore uses a new phase-in animation rather than the existing horizontal ghost travel or outward particle trail. The ghost holds the center while two staggered slate-blue afterimages expand and dissolve behind it; four mustard binary particles follow curved inward paths and disappear into it. The main ghost gently resolves through opacity and scale only. This animation is indeterminate and never takes the visual form of a filling track or ring.

Below that visual, the content hierarchy remains stable for the entire lifecycle: the mono **LOADING ON THIS DEVICE** eyebrow; a large themed serif headline cycling every 12 seconds through **Haunting Jet's archive**, **Waking the ghost**, and **Feeding it ones and zeroes**; monotonic elapsed time; then a reserved one-line secondary-message slot. At 36 seconds, that already-reserved slot reveals **First load may take a few minutes.** in text-xs tertiary body text without replacing or resetting the headline cycle or moving the surrounding stack at standard 320px-and-wider layouts. The slot is broad enough for the exact English copy on those normal layouts and reserves only one line height before the threshold; zoom, enlarged text, localization, and unusually constrained widths may wrap and reflow naturally.

The phase-in visual and cycling headline are decorative and are not live regions; the separate factual lifecycle announcement remains the accessible status. Reduced motion freezes a centered ghost, faint fixed afterimages, and fixed binary particles while the headline and timer continue to provide liveness. The screen offers no Cancel or Unload control until loading has completed. It never invents a percentage, and no percentage is appended to the header status group.

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
