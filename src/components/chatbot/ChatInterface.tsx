/**
 * ChatInterface Component - Main Chat UI
 *
 * Based on: /docs/rag-chatbot-implementation-plan.md v1.7
 * Spec: Phase 4 - LLM Integration (UI Components)
 *
 * Orchestrates the chat UI with message display, input, and source attribution.
 */

import { MessageList } from './MessageList';
import { InputBar } from './InputBar';
import { SourcesPanel } from './SourcesPanel';
import type { Message, ChatbotState } from '../../types/chatbot';

interface ChatInterfaceProps {
  messages: Message[];
  state: ChatbotState;
  onSendMessage: (query: string) => Promise<void>;
  onNewChat: () => void;
  onClose: () => void;
}

/**
 * ChatInterface - Main chat UI component
 *
 * Features:
 * - Message list with conversation history
 * - Input bar for user queries
 * - Source attribution panel
 * - Header with title and close button
 * - Action bar for chat management
 */
export function ChatInterface({
  messages,
  state,
  onSendMessage,
  onNewChat,
  onClose,
}: ChatInterfaceProps) {
  // Get last assistant message for source attribution
  const lastMessage = messages.length > 0 ? messages[messages.length - 1] : null;
  const showSources =
    lastMessage?.role === 'assistant' && lastMessage.sources && lastMessage.sources.length > 0;

  // Determine if input should be disabled
  const isProcessing = state === 'retrieving' || state === 'generating' || state === 'streaming';
  const inputDisabled = state !== 'ready' && !isProcessing;

  // Dynamic placeholder based on state
  const getPlaceholder = () => {
    switch (state) {
      case 'retrieving':
        return 'Searching blog content...';
      case 'generating':
      case 'streaming':
        return 'Generating response...';
      case 'ready':
        return 'Ask about blog content...';
      default:
        return 'Initializing...';
    }
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-900">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
          Chat with Blog Content
        </h2>
        <div className="flex items-center gap-2">
          {/* New Chat Button */}
          <button
            onClick={onNewChat}
            disabled={messages.length === 0}
            className="px-3 py-1 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            New Chat
          </button>
          {/* Close Button */}
          <button
            onClick={onClose}
            className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 text-2xl leading-none"
            aria-label="Close chat"
          >
            ×
          </button>
        </div>
      </div>

      {/* Chat Body */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto">
          <MessageList messages={messages} />
        </div>

        {/* Sources Panel */}
        {showSources && (
          <div className="px-4 pb-4">
            <SourcesPanel sources={lastMessage.sources!} />
          </div>
        )}
      </div>

      {/* Input Bar */}
      <InputBar
        onSend={onSendMessage}
        disabled={inputDisabled}
        placeholder={getPlaceholder()}
      />
    </div>
  );
}
