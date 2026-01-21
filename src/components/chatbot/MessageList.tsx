/**
 * MessageList Component - Chat Message Display
 *
 * Based on: /docs/rag-chatbot-implementation-plan.md v1.7
 * Spec: Phase 4 - LLM Integration (UI Components)
 *
 * Displays conversation history with user and assistant messages.
 * Supports streaming (incrementally updating last message).
 */

import type { Message } from '../../types/chatbot';

interface MessageListProps {
  messages: Message[];
}

/**
 * MessageList - Displays all messages in the conversation
 *
 * Features:
 * - User and assistant message styling
 * - Markdown rendering (if needed)
 * - Auto-scroll to latest message
 * - Streaming support (updates as tokens arrive)
 */
export function MessageList({ messages }: MessageListProps) {
  if (messages.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-text-tertiary">
        <p>Ask a question about the blog content to get started!</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col space-y-m px-gutter py-s overflow-y-auto">
      {messages.map((message) => (
        <div
          key={message.id}
          className={`flex ${
            message.role === 'user' ? 'justify-end' : 'justify-start'
          }`}
        >
          <div
            className={`max-w-[80%] rounded-lg px-s py-s ${
              message.role === 'user'
                ? 'bg-brand-base text-brand-contrast'
                : 'bg-bg-subtle text-text-primary'
            }`}
          >
            <div className="whitespace-pre-line break-words">
              {message.content.trim()}
            </div>
            {message.timestamp && (
              <div
                className={`text-xs mt-2xs ${
                  message.role === 'user'
                    ? 'text-brand-contrast opacity-80'
                    : 'text-text-tertiary'
                }`}
              >
                {new Date(message.timestamp).toLocaleTimeString()}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
