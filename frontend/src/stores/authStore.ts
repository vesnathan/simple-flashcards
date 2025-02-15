import { create } from "zustand";

import { useDeckStore } from "./deckStore";

import { authService } from "@/services/auth";

interface AuthState {
  user: any | null;
  loading: boolean;
  error: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  checkAuth: () => Promise<void>;
  pendingConfirmation: string | null;
  setPendingConfirmation: (email: string | null) => void;
  showToast: (message: string, type: "success" | "error" | "info") => void;
  toastMessage: { message: string; type: "success" | "error" | "info" } | null;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  loading: true,
  error: null,
  pendingConfirmation: null,
  toastMessage: null,

  checkAuth: async () => {
    try {
      const user = await authService.getCurrentUser();

      set({ user, loading: false });
    } catch {
      set({ user: null, loading: false });
    }
  },

  signIn: async (email, password) => {
    try {
      // Clear existing state first
      set({ user: null, error: null });
      const signInResult = await authService.signIn(email, password);

      set({ user: signInResult, error: null });

      // Try to sync local decks
      try {
        const deckStore = useDeckStore.getState();

        await deckStore.syncLocalDecks();
        set((state) => ({
          ...state,
          toastMessage: {
            message: "Successfully synced local decks",
            type: "success",
          },
        }));
      } catch {
        set((state) => ({
          ...state,
          toastMessage: {
            message:
              "Failed to sync some local decks. They will remain in local storage.",
            type: "error",
          },
        }));
      }
    } catch (error: any) {
      set({ error: error.message, user: null });
      throw error;
    }
  },

  signUp: async (email, password) => {
    try {
      await authService.signUp(email, password);
      set({ error: null, pendingConfirmation: email });
    } catch (error: any) {
      set({ error: error.message });
      throw error;
    }
  },

  signOut: async () => {
    try {
      await authService.signOut();
      set({ user: null, error: null });
    } catch (error: any) {
      set({ error: error.message });
      throw error;
    }
  },

  setPendingConfirmation: (email) => set({ pendingConfirmation: email }),

  showToast: (message: string, type: "success" | "error" | "info") => {
    set({ toastMessage: { message, type } });
    // Clear toast after 3 seconds
    setTimeout(() => {
      set({ toastMessage: null });
    }, 3000);
  },
}));
