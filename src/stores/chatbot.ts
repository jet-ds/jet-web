/**
 * Chatbot State Management
 *
 * Based on: /docs/rag-chatbot-implementation-plan.md v1.7
 * Spec: State Management section
 *
 * Zustand store for managing chatbot lifecycle, resources, and messages.
 * Implements activation boundary - no resources loaded until user action.
 */

import { create } from 'zustand';
import type {
  ChatbotState,
  InitializationSubstate,
  Message,
  ArtifactManifest,
  ChatbotError,
} from '../types/chatbot';

/**
 * ChatbotStore manages all chatbot state and resources
 */
interface ChatbotStore {
  // ==================== State ====================
  /** Current lifecycle state */
  state: ChatbotState;

  /** Current initialization substep (only relevant during 'initializing') */
  initSubstate: InitializationSubstate | null;

  /** Initialization progress (0-100) */
  initProgress: number;

  /** Conversation messages */
  messages: Message[];

  /** Current error (if any) */
  error: ChatbotError | null;

  // ==================== Resources ====================
  /** Transformers.js embedding model (lazy-loaded) */
  model: any | null;

  /** Artifacts from Vercel Blob */
  artifacts: {
    embeddings: ArrayBuffer;
    manifest: ArtifactManifest;
    chunks: string[];
  } | null;

  /** MiniSearch BM25 index */
  searchIndex: any | null;

  /** Web Worker for similarity search */
  worker: Worker | null;

  // ==================== Actions ====================
  /** Update chatbot state */
  setState: (state: ChatbotState) => void;

  /** Update initialization progress */
  setInitProgress: (substate: InitializationSubstate, progress: number) => void;

  /** Set error state */
  setError: (error: ChatbotError | null) => void;

  /** Add a message to the conversation */
  addMessage: (message: Message) => void;

  /** Update the last message content (for streaming) */
  updateLastMessage: (content: string) => void;

  /** Clear all messages (start new conversation) */
  clearMessages: () => void;

  /** Set all resources after initialization */
  setResources: (resources: {
    model: any;
    artifacts: {
      embeddings: ArrayBuffer;
      manifest: ArtifactManifest;
      chunks: string[];
    };
    searchIndex: any;
    worker: Worker;
  }) => void;

  /** Cleanup all resources and reset to uninitialized */
  cleanup: () => void;
}

/**
 * Chatbot state store
 *
 * Implementation follows activation boundary principle:
 * - Default state is 'uninitialized' with no resources loaded
 * - Resources only load when user clicks "Start Chat"
 * - Resources are cleaned up when modal closes
 */
export const useChatbotStore = create<ChatbotStore>((set, get) => ({
  // ==================== Initial State ====================
  state: 'uninitialized',
  initSubstate: null,
  initProgress: 0,
  messages: [],
  error: null,

  // ==================== Initial Resources (all null) ====================
  model: null,
  artifacts: null,
  searchIndex: null,
  worker: null,

  // ==================== Actions ====================
  setState: (state) => set({ state }),

  setInitProgress: (substate, progress) =>
    set({
      initSubstate: substate,
      initProgress: progress,
    }),

  setError: (error) =>
    set(
      error
        ? {
            state: 'error',
            error,
          }
        : {
            error: null,
            // Don't change state when clearing error
          }
    ),

  addMessage: (message) =>
    set((state) => ({
      messages: [...state.messages, message],
    })),

  updateLastMessage: (content) =>
    set((state) => {
      const messages = [...state.messages];
      const lastMessage = messages[messages.length - 1];
      if (lastMessage) {
        lastMessage.content = content;
      }
      return { messages };
    }),

  clearMessages: () => set({ messages: [] }),

  setResources: (resources) => set(resources),

  cleanup: () => {
    const { worker } = get();

    // Terminate worker if running
    if (worker) {
      worker.terminate();
    }

    // Reset to uninitialized state
    set({
      state: 'uninitialized',
      initSubstate: null,
      initProgress: 0,
      messages: [],
      error: null,
      model: null,
      artifacts: null,
      searchIndex: null,
      worker: null,
    });
  },
}));
