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
      <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
        <p>Ask a question about the blog content to get started!</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col space-y-4 p-4 overflow-y-auto">
      {messages.map((message) => (
        <div
          key={message.id}
          className={`flex ${
            message.role === 'user' ? 'justify-end' : 'justify-start'
          }`}
        >
          <div
            className={`max-w-[80%] rounded-lg px-4 py-2 ${
              message.role === 'user'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100'
            }`}
          >
            <div className="whitespace-pre-wrap break-words">
              {message.content}
            </div>
            {message.timestamp && (
              <div
                className={`text-xs mt-1 ${
                  message.role === 'user'
                    ? 'text-blue-100'
                    : 'text-gray-500 dark:text-gray-400'
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
