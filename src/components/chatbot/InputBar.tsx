/**
 * InputBar Component - Chat Input Field
 *
 * Based on: /docs/rag-chatbot-implementation-plan.md v1.7
 * Spec: Phase 4 - LLM Integration (UI Components)
 *
 * Text input for user queries with send button and loading states.
 */

import { useState, type FormEvent } from 'react';

interface InputBarProps {
  onSend: (query: string) => Promise<void>;
  disabled: boolean;
  placeholder?: string;
}

/**
 * InputBar - Input field with send button
 *
 * Features:
 * - Text input with multiline support
 * - Send button (or Enter key)
 * - Disabled state during processing
 * - Dynamic placeholder based on chatbot state
 */
export function InputBar({
  onSend,
  disabled,
  placeholder = 'Ask about blog content...',
}: InputBarProps) {
  const [query, setQuery] = useState('');
  const [isSending, setIsSending] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!query.trim() || disabled || isSending) {
      return;
    }

    const userQuery = query.trim();
    setQuery(''); // Clear input immediately
    setIsSending(true);

    try {
      await onSend(userQuery);
    } catch (error) {
      console.error('[InputBar] Send error:', error);
      // Re-populate input on error
      setQuery(userQuery);
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex gap-s px-card py-m border-t border-border-default">
      <textarea
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled || isSending}
        rows={1}
        className="flex-1 resize-none rounded-lg border border-border-default bg-surface-base px-s py-2xs text-text-primary placeholder-text-tertiary focus:outline-none focus:ring-2 focus:ring-brand-base disabled:opacity-50 disabled:cursor-not-allowed"
        style={{
          minHeight: '44px',
          maxHeight: '120px',
        }}
      />
      <button
        type="submit"
        disabled={disabled || isSending || !query.trim()}
        className="px-m py-s bg-brand-base text-brand-contrast rounded-lg hover:bg-brand-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
      >
        {isSending ? 'Sending...' : 'Send'}
      </button>
    </form>
  );
}
