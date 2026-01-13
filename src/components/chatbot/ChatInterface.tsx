/**
 * ChatInterface Component - Main Chat UI
 *
 * Based on: /docs/rag-chatbot-implementation-plan.md v1.7
 * Spec: Phase 4 - LLM Integration (UI Components)
 *
 * Orchestrates the chat UI with message display, input, and source attribution.
 */

import React from 'react';
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
  const [showNewChatConfirm, setShowNewChatConfirm] = React.useState(false);

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

  // Handle new chat with confirmation
  const handleNewChat = () => {
    setShowNewChatConfirm(false);
    onNewChat();
  };

  return (
    <div className="flex flex-col h-full bg-surface-base">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border-default">
        <h2 className="text-xl font-semibold text-text-primary">
          Chat with Blog Content
        </h2>
        <div className="flex items-center gap-2">
          {/* New Chat Button */}
          <button
            onClick={() => setShowNewChatConfirm(true)}
            disabled={messages.length === 0}
            className="px-3 py-1 text-sm text-text-secondary hover:bg-bg-hover rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            title="Start a new conversation"
          >
            New Chat
          </button>
          {/* Close Button */}
          <button
            onClick={onClose}
            className="text-text-tertiary hover:text-text-primary text-2xl leading-none"
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

      {/* New Chat Confirmation Dialog */}
      {showNewChatConfirm && (
        <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-surface-base rounded-lg p-6 max-w-sm mx-4 shadow-xl">
            <h3 className="text-lg font-semibold text-text-primary mb-2">
              Start New Chat?
            </h3>
            <p className="text-text-tertiary mb-6">
              This will clear the current conversation. This action cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowNewChatConfirm(false)}
                className="px-4 py-2 text-text-secondary hover:bg-bg-hover rounded transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleNewChat}
                className="px-4 py-2 bg-brand-base text-brand-contrast rounded hover:bg-brand-hover transition-colors"
              >
                New Chat
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
