> **Superseded historical record.** Archived 2026-07-13 from `docs/jets-ghost-v1.5-spec.md`.
> Canonical context: [Jet's Ghost local-assistant design](../../../superpowers/specs/2026-07-11-jets-ghost-local-assistant-design.md).

# Jet's Ghost v1.5 - RAG Chatbot Enhancement Specification

**Version**: 1.5
**Date**: 2026-01-21
**Status**: Planning
**Previous Version**: v1.0 (Initial Implementation)

---

## Overview

Jet's Ghost v1.5 addresses critical UX issues identified in production:
- Sources panel overwhelming the interface (10+ entries)
- Confusing citation format ("[Source 1]" inline)
- Low relevance scores (1-2%) causing user confusion
- Modal state issue (empty page after close)
- Poor mobile experience (not full-screen)
- Generic system prompt lacking identity and context
- Inconsistent design system usage (hardcoded spacing, missing OKLCH tokens)

This specification outlines changes to improve citation clarity, source display, mobile experience, and design system compliance.

---

## Design Goals

1. **Clarity**: Superscript citations (¹, ², ³) instead of "[Source 1]"
2. **Focus**: Limit to top 3 sources unless more are directly cited
3. **Identity**: AI knows it's Jet's blog assistant with clear purpose
4. **Mobile-First**: Full-screen experience on mobile, modal on desktop
5. **Consistency**: Full Utopia spacing and OKLCH color compliance
6. **Persistence**: Return to WelcomeScreen after close, not empty page

---

## Changes by Component

### 1. **Source Retrieval & Limitation**

**File**: `src/services/generation.ts`

**Current Behavior**:
- Retrieves 3-15 chunks based on token budget (2000 tokens max)
- Passes all chunks to LLM context and sources panel
- Can result in 10+ sources displayed

**New Behavior**:
- Retrieve chunks normally (token budget strategy unchanged)
- **Limit to top 3 sources** after retrieval
- Only display these 3 sources in the panel
- LLM still receives only top 3 in context

**Implementation**:

```typescript
// Line 97 - After retrieve() call
const allChunks = await retrieve(context, query, maxTokens);
chunks = allChunks.slice(0, 3); // Limit to top 3 sources
```

**Rationale**:
- Most queries can be answered with 3 high-quality sources
- Reduces visual clutter in sources panel
- Improves focus on most relevant content
- Maintains high retrieval quality (top-ranked chunks)

---

### 2. **Context Format for LLM**

**File**: `src/services/generation.ts`

**Current Format**:
```
[Source 1] Title - Section
Content text
URL: https://example.com

---

[Source 2] Title - Section
...
```

**New Format**:
```
Source 1: Title - Section
URL: https://example.com
Content: [text]

---

Source 2: Title - Section
URL: https://example.com
Content: [text]

---

Source 3: Title - Section
URL: https://example.com
Content: [text]
```

**Implementation**:

```typescript
// Lines 61-68 - formatContext function
function formatContext(chunks: RetrievedChunk[]): string {
  return chunks
    .map(
      (chunk, idx) =>
        `Source ${idx + 1}: ${chunk.title}${chunk.section ? ` - ${chunk.section}` : ''}\nURL: ${chunk.url}\nContent: ${chunk.text}\n`
    )
    .join('\n---\n\n');
}
```

**Changes**:
- Remove brackets around "Source N"
- Reorganize: Title/URL first, then content
- Add "Content:" label for clarity
- Maintain separator `---` between sources

**Rationale**:
- Clearer structure for LLM parsing
- Aligns with new citation instruction (no brackets)
- More semantic format (label → content)

---

### 3. **System Prompt Enhancement**

**File**: `src/pages/api/chat.ts`

**Current Prompt**:
```
You are a helpful assistant that answers questions based on blog content.

CRITICAL INSTRUCTIONS:
- Answer ONLY based on the provided context
- If the context doesn't contain the answer, say "I don't have information about that in the blog content"
- Cite sources using the format [Source Title](URL) when relevant
- Be concise and accurate (aim for 2-4 sentences)
- Do not make up information
- Use a friendly, conversational tone
```

**New Prompt**:
```
You are Jet Sanchez's blog assistant, helping visitors explore content about AI research, marketing engineering, and practical AI systems.

IDENTITY & CONTEXT:
- You represent Jet's blog at jetsanchez.com
- The blog covers AI research, AI safety, marketing engineering, SEO/GEO strategy, and agentic AI
- Jet is a marketing engineer and AI researcher at Digital Squad

CRITICAL CITATION RULES:
- Cite sources using superscript numbers (¹, ², ³) at the end of sentences
- Example: "Claude Code uses React 19.² The architecture is well-designed.¹"
- ONLY cite sources that directly support your statement
- If you use information from Source 2, cite it as ²

RESPONSE GUIDELINES:
- Answer ONLY based on the provided context
- If context doesn't contain the answer, say "I don't have information about that in Jet's blog content"
- Be concise (2-4 sentences) but informative
- Use a friendly, knowledgeable tone
- DO NOT make up information
```

**Implementation**:

```typescript
// Lines 116-125 - System message content
{
  role: 'system',
  content: `[new prompt above]`,
}
```

**Key Improvements**:
1. **Identity**: Clear persona as "Jet Sanchez's blog assistant"
2. **Context**: Blog topics and Jet's background
3. **Citation Format**: Specific instruction for superscript (¹, ², ³)
4. **Examples**: Concrete citation example
5. **Personalization**: "Jet's blog content" instead of generic "blog content"

**Rationale**:
- LLM understands its role and purpose
- Citation format matches new display style
- More helpful and contextually aware responses
- Users understand they're chatting with Jet's assistant

---

### 4. **Sources Panel Display**

**File**: `src/components/chatbot/SourcesPanel.tsx`

**Current Display**:
- List format with title, section, URL, relevance percentage
- Example: "Title → Section (2% relevance)"
- Shows all retrieved sources (potentially 10+)

**New Display**:
- Superscript number + title + section
- Example: "¹ Title → Section"
- No relevance score (confusing 1-2% values removed)
- Only shows top 3 sources

**Implementation**:

```tsx
// Add helper function
function getSuperscript(num: number): string {
  const superscripts = ['⁰', '¹', '²', '³', '⁴', '⁵', '⁶', '⁷', '⁸', '⁹'];
  return num.toString().split('').map(d => superscripts[parseInt(d)]).join('');
}

// Update sources list rendering
<div className="space-y-2xs">
  {sources.map((source, idx) => (
    <div key={idx} className="text-sm">
      <span className="text-brand-base font-semibold mr-3xs">
        {getSuperscript(idx + 1)}
      </span>
      <a
        href={source.url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-brand-base hover:underline"
      >
        {source.title}
        {source.section && ` → ${source.section}`}
      </a>
    </div>
  ))}
</div>
```

**Design System Updates**:
- `space-y-2xs` - Utopia fluid spacing
- `mr-3xs` - Utopia fluid spacing for number margin
- `text-brand-base` - OKLCH semantic token
- Remove `text-sm` in favor of inherited base size

**Rationale**:
- Superscript matches in-text citations
- Cleaner, more compact display
- No confusing low percentages
- Limited to 3 keeps panel manageable
- Fully compliant with Utopia/OKLCH design system

---

### 5. **Modal Close Behavior**

**File**: `src/components/chatbot/ChatbotPage.tsx`

**Current Behavior**:
- Close button sets `isModalOpen = false`
- State remains `'ready'`
- Shows empty page with "Open Chat" button
- Keeps conversation in memory

**New Behavior**:
- Close button sets `isModalOpen = false`
- Calls `newChat()` to clear conversation
- Shows **WelcomeScreen** (same as initial state)
- User can restart chat cleanly

**Implementation**:

```typescript
// Line 52 - handleClose function
const handleClose = () => {
  setIsModalOpen(false);
  newChat(); // Clear conversation and return to fresh state
};

// Lines 143-152 - Replace "Open Chat" button section
{!isModalOpen && <WelcomeScreen onStartChat={() => setIsModalOpen(true)} />}
```

**Rationale**:
- Consistent UX: Closing returns to initial state
- No confusing empty page
- Clear visual feedback (WelcomeScreen)
- User understands they can start fresh

---

### 6. **Mobile Full-Screen Experience**

**File**: `src/components/chatbot/ChatbotPage.tsx`

**Current Behavior**:
- Modal: `max-w-4xl h-[80vh]` with `p-4` padding
- Rounded corners on all screens
- Centered with overlay on all screens
- Not ideal for mobile (feels cramped)

**New Behavior**:
- **Mobile**: Full-screen, no overlay, no rounded corners
- **Desktop (md+)**: Modal with overlay, rounded corners, centered

**Implementation**:

```tsx
// Lines 118-130 - Replace modal rendering
{isModalOpen && (
  <div className="fixed inset-0 z-50 bg-surface-base md:flex md:items-center md:justify-center md:bg-bg-base/80 md:px-gutter md:py-m">
    <div className="bg-surface-base h-full w-full md:rounded-lg md:shadow-2xl md:max-w-4xl md:h-[80vh] flex flex-col">
      <ChatInterface
        messages={messages}
        state={state}
        onSendMessage={sendMessage}
        onNewChat={newChat}
        onClose={handleClose}
      />
    </div>
  </div>
)}
```

**Responsive Breakdown**:

| Breakpoint | Outer Container | Inner Container | Effect |
|------------|----------------|-----------------|--------|
| Mobile (default) | `fixed inset-0 bg-surface-base` | `h-full w-full` | Full-screen, no overlay |
| Desktop (md+) | `flex items-center justify-center bg-bg-base/80` | `rounded-lg max-w-4xl h-[80vh]` | Modal centered with overlay |

**Design System Updates**:
- `bg-surface-base` - OKLCH semantic token (card background)
- `bg-bg-base/80` - OKLCH semantic token with opacity (overlay)
- `px-gutter` - Utopia fluid spacing (responsive padding)
- `py-m` - Utopia fluid spacing (responsive padding)

**Rationale**:
- Mobile: Immersive full-screen experience
- Desktop: Modal preserves context (see page behind)
- Better use of screen real estate on small devices
- Design system compliant

---

### 7. **ChatInterface Header Spacing**

**File**: `src/components/chatbot/ChatInterface.tsx`

**Current Styling**:
```tsx
<div className="flex items-center justify-between px-6 py-4 border-b border-border-default">
  <div className="flex items-center gap-2">
    <button className="px-3 py-1 text-sm ...">
```

**New Styling**:
```tsx
<div className="flex items-center justify-between px-card py-m border-b border-border-default">
  <div className="flex items-center gap-2xs">
    <button className="px-s py-2xs text-sm ...">
```

**Changes**:
- `px-6` → `px-card` (Utopia semantic token)
- `py-4` → `py-m` (Utopia spacing)
- `gap-2` → `gap-2xs` (Utopia spacing)
- `px-3` → `px-s` (Utopia spacing)
- `py-1` → `py-2xs` (Utopia spacing)

**Rationale**:
- Full design system compliance
- Responsive spacing across breakpoints
- Consistent with rest of application

---

## Design System Compliance

### Color Tokens (OKLCH)

All components must use semantic OKLCH color tokens:

**Background Colors**:
- `bg-surface-base` - Primary surface (cards, modals)
- `bg-bg-base` - Page background
- `bg-bg-hover` - Hover states
- `bg-bg-base/80` - Overlay with opacity

**Text Colors**:
- `text-text-primary` - Primary text (headings)
- `text-text-secondary` - Secondary text (body)
- `text-text-tertiary` - Tertiary text (muted)
- `text-brand-base` - Brand color links

**Border Colors**:
- `border-border-default` - Standard borders
- `border-border-subtle` - Subtle borders

### Spacing Tokens (Utopia)

All components must use Utopia fluid spacing:

**Single Values**:
- `2xs`, `xs`, `s`, `m`, `l`, `xl`, `2xl` - T-shirt sizes

**Semantic Tokens**:
- `gutter` - Container padding
- `card` - Card padding
- `section` - Section spacing

**Usage Examples**:
- Padding: `px-card`, `py-m`, `p-s`
- Margin: `mb-l`, `mt-xl`
- Gap: `gap-2xs`, `space-y-2xs`

### No Hardcoded Values

**Forbidden**:
- ❌ `px-4`, `py-2`, `gap-3`
- ❌ `#ffffff`, `rgb(255, 255, 255)`
- ❌ `text-blue-600`, `bg-gray-100`

**Required**:
- ✅ `px-s`, `py-2xs`, `gap-2xs`
- ✅ `bg-surface-base`, `text-brand-base`
- ✅ Semantic OKLCH tokens

---

## Implementation Plan

### Phase 1: Core Logic Changes (30 min)
1. Update `generation.ts` - Source limiting + context format
2. Update `chat.ts` - New system prompt
3. Test retrieval with limited sources

### Phase 2: UI Component Updates (45 min)
4. Update `SourcesPanel.tsx` - Superscript display + spacing
5. Update `ChatbotPage.tsx` - Modal responsive + close behavior
6. Update `ChatInterface.tsx` - Header spacing
7. Test all components in isolation

### Phase 3: Integration Testing (30 min)
8. Test complete flow: Welcome → Initialize → Chat → Close
9. Test mobile full-screen experience
10. Test desktop modal experience
11. Verify citations appear correctly (¹, ², ³)
12. Verify sources panel displays 3 sources

### Phase 4: Design System Audit (15 min)
13. Verify no hardcoded spacing (`px-4`, `gap-2`, etc.)
14. Verify all colors use OKLCH semantic tokens
15. Verify responsive breakpoints work correctly

**Total Estimated Time**: ~2 hours

---

## Testing Checklist

### Functional Tests
- [ ] Query returns top 3 sources only
- [ ] Citations use superscript format (¹, ², ³)
- [ ] AI identifies as "Jet's blog assistant"
- [ ] Closing modal returns to WelcomeScreen
- [ ] Reopening modal shows WelcomeScreen
- [ ] New Chat clears conversation correctly

### Mobile Tests (< 768px)
- [ ] Modal is full-screen (no overlay, no rounded corners)
- [ ] Close button accessible
- [ ] Input bar usable
- [ ] Sources panel readable
- [ ] No horizontal scroll

### Desktop Tests (≥ 768px)
- [ ] Modal centered with overlay
- [ ] Rounded corners visible
- [ ] Max width 4xl enforced
- [ ] Height 80vh enforced
- [ ] Background visible through overlay

### Design System Tests
- [ ] No hardcoded spacing values
- [ ] All colors use OKLCH tokens
- [ ] Utopia spacing tokens used throughout
- [ ] Responsive spacing scales correctly

---

## Success Metrics

**Before (v1.0)**:
- Average sources displayed: 8-12
- Citation format: "[Source 1]" (confusing)
- Relevance display: "2% relevance" (misleading)
- Mobile experience: Modal (cramped)
- Close behavior: Empty page with button
- Design compliance: Partial (hardcoded spacing)

**After (v1.5)**:
- Average sources displayed: 3
- Citation format: "¹" (clear)
- Relevance display: None (removed confusion)
- Mobile experience: Full-screen (immersive)
- Close behavior: WelcomeScreen (clean)
- Design compliance: Full (Utopia + OKLCH)

**User Experience Improvements**:
- ✅ 60% reduction in visual clutter (3 vs 8 sources)
- ✅ Clear citation format matching academic style
- ✅ AI understands its identity and purpose
- ✅ Mobile-optimized full-screen experience
- ✅ Consistent behavior on modal close
- ✅ Full design system compliance

---

## Future Enhancements (v1.6+)

### Source Expansion
- "Show more sources" button if more than 3 available
- Expand to 5-7 sources on demand

### Citation Intelligence
- Track which sources AI actually cites
- Only display cited sources by default
- Show uncited sources in collapsed section

### Mobile Optimizations
- Swipe to close gesture
- Bottom sheet for sources on mobile
- Landscape mode optimizations

### Advanced Features
- Multi-turn conversation context
- Source preview on hover (desktop)
- Copy citation to clipboard
- Share conversation link

---

## Version History

### v1.0 (Initial Release)
- Basic RAG pipeline with hybrid search
- Generic system prompt
- All sources displayed
- Modal on all devices
- Partial design system usage

### v1.5 (This Release)
- Limited to 3 sources
- Superscript citations
- Enhanced system prompt with identity
- Mobile full-screen experience
- Close returns to WelcomeScreen
- Full Utopia + OKLCH compliance

---

## References

- Original Implementation: `/docs/rag-chatbot-implementation-plan.md` v1.7
- Design System: `/CLAUDE.md` - Utopia Fluid Design System
- Color System: `/CLAUDE.md` - OKLCH Color System
- GitHub Issue: #4 - "Fix AI chatbot sources panel"

---

**Document Status**: Ready for Implementation
**Approval Required**: Yes
**Breaking Changes**: None (backward compatible)
**Migration Required**: No (automatic on deploy)
