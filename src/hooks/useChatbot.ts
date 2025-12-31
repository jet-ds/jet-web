/**
 * useChatbot Hook - Chat State Orchestration
 *
 * Based on: /docs/rag-chatbot-implementation-plan.md v1.7
 * Spec: Phase 4 - LLM Integration (State Management)
 *
 * Orchestrates the entire chatbot lifecycle:
 * - Initialization (lazy loading)
 * - Message sending (retrieval + generation)
 * - State management
 * - Cleanup
 */

import { useCallback } from 'react';
import { useChatbotStore } from '../stores/chatbot';
import { initializeChatbot } from '../services/initialization';
import { retrieveAndGenerate } from '../services/generation';

/**
 * useChatbot - Main chatbot hook
 *
 * Returns:
 * - state: Current chatbot state (uninitialized, initializing, ready, etc.)
 * - initSubstate: Initialization substep (for loading UI)
 * - initProgress: Initialization progress (0-100)
 * - messages: Conversation history
 * - error: Error object (if any)
 * - initialize: Function to initialize chatbot
 * - sendMessage: Function to send user query
 * - newChat: Function to start new conversation
 * - cleanup: Function to cleanup resources
 */
export function useChatbot() {
  const {
    state,
    initSubstate,
    initProgress,
    messages,
    error,
    model,
    artifacts,
    searchIndex,
    worker,
    setState,
    setInitProgress,
    setError,
    addMessage,
    updateLastMessage,
    clearMessages,
    setResources,
    cleanup: cleanupStore,
  } = useChatbotStore();

  /**
   * Initialize chatbot (lazy loading)
   *
   * Process:
   * 1. Set state to 'initializing'
   * 2. Load model, artifacts, and initialize search
   * 3. Spawn worker for similarity search
   * 4. Set state to 'ready'
   */
  const initialize = useCallback(async () => {
    setState('initializing');
    setError(null);

    try {
      const resources = await initializeChatbot((substate, progress) => {
        setInitProgress(substate, progress);
      });

      setResources(resources);
      setState('ready');
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Initialization failed');
      console.error('[useChatbot] Initialization error:', error);
      setError(error);
    }
  }, [setState, setError, setInitProgress, setResources]);

  /**
   * Send user message and generate response
   *
   * Process:
   * 1. Add user message to conversation
   * 2. Set state to 'retrieving'
   * 3. Retrieve relevant chunks (hybrid search)
   * 4. Set state to 'generating'
   * 5. Call LLM API with streaming
   * 6. Set state to 'streaming'
   * 7. Update assistant message as chunks arrive
   * 8. Set state back to 'ready'
   */
  const sendMessage = useCallback(
    async (query: string) => {
      if (state !== 'ready') {
        console.warn('[useChatbot] Cannot send message in state:', state);
        return;
      }

      if (!model || !artifacts || !searchIndex || !worker) {
        console.error('[useChatbot] Resources not initialized');
        setError(new Error('Chatbot not initialized'));
        return;
      }

      // Add user message
      addMessage({
        id: `user-${Date.now()}`,
        role: 'user',
        content: query,
        timestamp: Date.now(),
      });

      try {
        // Prepare retrieval context
        const context = {
          model,
          worker,
          searchIndex,
          artifacts,
        };

        // Track assistant message ID and accumulate content for streaming updates
        let assistantMessageId: string | null = null;
        let accumulatedContent = '';

        // Retrieve and generate with streaming
        await retrieveAndGenerate(query, context, {
          onStateChange: (newState) => {
            setState(newState);
          },
          onStreamChunk: (chunk, sources) => {
            // Accumulate content
            accumulatedContent += chunk;

            // Create assistant message on first chunk
            if (!assistantMessageId) {
              assistantMessageId = `assistant-${Date.now()}`;
              addMessage({
                id: assistantMessageId,
                role: 'assistant',
                content: accumulatedContent,
                timestamp: Date.now(),
                sources,
              });
            } else {
              // Update existing assistant message with accumulated content
              updateLastMessage(accumulatedContent);
            }
          },
        });

        // Set back to ready
        setState('ready');
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Message sending failed');
        setError(error);
        console.error('[useChatbot] Send message error:', error);

        // Add error message to conversation
        addMessage({
          id: `error-${Date.now()}`,
          role: 'assistant',
          content: `Sorry, I encountered an error: ${error.message}`,
          timestamp: Date.now(),
        });

        setState('ready');
      }
    },
    [
      state,
      model,
      artifacts,
      searchIndex,
      worker,
      messages,
      setState,
      setError,
      addMessage,
      updateLastMessage,
    ]
  );

  /**
   * Start new conversation
   *
   * Clears messages but keeps resources initialized
   */
  const newChat = useCallback(() => {
    clearMessages();
    setError(null);
  }, [clearMessages, setError]);

  /**
   * Cleanup all resources
   *
   * Terminates worker, releases memory, resets state
   */
  const cleanup = useCallback(() => {
    cleanupStore();
    setError(null);
  }, [cleanupStore, setError]);

  return {
    // State
    state,
    initSubstate,
    initProgress,
    messages,
    error,

    // Actions
    initialize,
    sendMessage,
    newChat,
    cleanup,
  };
}
