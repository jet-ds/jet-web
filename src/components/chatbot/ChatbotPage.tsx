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
    // Note: We don't cleanup resources on close - they stay in memory
    // for faster re-opening. Cleanup happens on page unmount.
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
        <div className="max-w-md text-center space-y-6">
          <div className="text-6xl mb-4">⚠️</div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {canRetry ? 'Temporary Error' : 'Initialization Failed'}
          </h2>
          <p className="text-gray-600 dark:text-gray-400">{errorMessage}</p>
          <div className="flex gap-3 justify-center">
            {canRetry && (
              <button
                onClick={handleStartChat}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Retry
              </button>
            )}
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
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
      {/* Modal Overlay */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="bg-white dark:bg-gray-900 rounded-lg shadow-2xl w-full max-w-4xl h-[80vh] flex flex-col">
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

      {/* Background content when modal is open */}
      {isModalOpen && (
        <div className="flex items-center justify-center min-h-[600px]">
          <div className="text-center text-gray-500 dark:text-gray-400">
            <p>Chat is open</p>
          </div>
        </div>
      )}

      {/* Show button to re-open modal if closed */}
      {!isModalOpen && (
        <div className="flex items-center justify-center min-h-[600px]">
          <button
            onClick={() => setIsModalOpen(true)}
            className="px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold text-lg shadow-lg"
          >
            Open Chat
          </button>
        </div>
      )}
    </>
  );
}
