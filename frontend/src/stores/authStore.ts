/* eslint-disable no-console */
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
      set({ user: null, error: null });
      await authService.signIn(email, password);
      const currentUser = await authService.getCurrentUser();

      set({ user: currentUser, error: null });

      try {
        // Use store functions directly instead of getState
        await useDeckStore.setState((state) => {
          return { ...state }; // Trigger update to ensure latest state
        });

        // Access store state and functions directly
        await useDeckStore.getState().syncLocalDecks();
        await useDeckStore.getState().loadUserDecks(currentUser.userId);

        // Only show success message if decks exist
        const decks = useDeckStore.getState().decks;

        if (decks.length > 0) {
          set((state) => ({
            ...state,
            toastMessage: {
              message: "Successfully loaded your decks",
              type: "success",
            },
          }));
        }
      } catch (error) {
        console.error("Failed to load decks:", error);
        set((state) => ({
          ...state,
          toastMessage: {
            message: "Failed to load some decks",
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
      // Use store function directly
      useDeckStore.getState().clearUserDecks();
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
