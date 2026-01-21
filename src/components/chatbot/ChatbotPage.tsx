/**
 * ChatbotPage Component - Page-level Orchestration
 *
 * Based on: /docs/rag-chatbot-implementation-plan.md v1.7
 * Spec: Activation Boundary - Resources load only on user action
 *
 * Orchestrates the chatbot page flow:
 * 1. WelcomeScreen (default state)
 * 2. User clicks "Start Chat"
 * 3. Initialization (loading model, artifacts, worker)
 * 4. Modal with ChatInterface
 */

import { useState, useEffect } from 'react';
import { useChatbot } from '../../hooks/useChatbot';
import { WelcomeScreen } from './WelcomeScreen';
import { InitializationScreen } from './InitializationScreen';
import { ChatInterface } from './ChatInterface';
import { ERROR_MESSAGES, isRecoverableError } from '../../types/chatbot';

/**
 * ChatbotPage - Main chatbot page component
 *
 * State flow:
 * - uninitialized: Show WelcomeScreen
 * - initializing: Show InitializationScreen with progress
 * - ready/retrieving/generating/streaming: Show ChatInterface in modal
 * - error: Show error message
 */
export function ChatbotPage() {
  const {
    state,
    initSubstate,
    initProgress,
    messages,
    error,
    initialize,
    sendMessage,
    newChat,
    cleanup,
  } = useChatbot();

  const [isModalOpen, setIsModalOpen] = useState(false);

  // Handle "Start Chat" button click
  const handleStartChat = async () => {
    await initialize();
    setIsModalOpen(true);
  };

  // Handle modal close
  const handleClose = () => {
    setIsModalOpen(false);
    newChat(); // Clear conversation and return to fresh state
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  // Render based on state
  if (state === 'uninitialized') {
    return <WelcomeScreen onStartChat={handleStartChat} />;
  }

  if (state === 'initializing') {
    return (
      <InitializationScreen
        substate={initSubstate!}
        progress={initProgress}
      />
    );
  }

  if (state === 'error') {
    const errorMessage = error
      ? ERROR_MESSAGES[error.type] || error.message
      : 'An unknown error occurred';

    const canRetry = error ? isRecoverableError(error.type) : false;

    return (
      <div className="flex items-center justify-center min-h-[600px]">
        <div className="max-w-md text-center space-y-l">
          <div className="text-6xl mb-m">⚠️</div>
          <h2 className="text-2xl font-bold leading-tight text-text-primary">
            {canRetry ? 'Temporary Error' : 'Initialization Failed'}
          </h2>
          <p className="text-text-tertiary">{errorMessage}</p>
          <div className="flex gap-m justify-center">
            {canRetry && (
              <button
                onClick={handleStartChat}
                className="px-m py-s bg-brand-base text-brand-contrast rounded-lg hover:bg-brand-hover transition-colors"
              >
                Retry
              </button>
            )}
            <button
              onClick={() => window.location.reload()}
              className="px-m py-s bg-text-secondary text-surface-base rounded-lg hover:bg-text-tertiary transition-colors"
            >
              Reload Page
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ready, retrieving, generating, streaming states - show chat modal
  return (
    <>
      {/* Modal - Full screen on mobile, centered on desktop */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-surface-base md:bg-black/30 md:backdrop-blur-sm md:flex md:items-center md:justify-center md:px-gutter md:py-m">
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

      {/* Show WelcomeScreen when modal is closed */}
      {!isModalOpen && <WelcomeScreen onStartChat={handleStartChat} />}
    </>
  );
}
