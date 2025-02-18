/* eslint-disable no-console */
import { create } from "zustand";
import { signOut, getCurrentUser } from "aws-amplify/auth";
import { Cache } from "aws-amplify/utils"; // Fix: Change cache to Cache

import { useDeckStore } from "./deckStore";

import { authService } from "@/services/auth";

interface AuthState {
  user: any | null;
  loading: boolean;
  error: string | null;
  isLoggedIn: boolean; // Add this
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
  isLoggedIn: false, // Add this
  pendingConfirmation: null,
  toastMessage: null,

  checkAuth: async () => {
    try {
      const user = await getCurrentUser();

      set({ user, loading: false, isLoggedIn: true });
    } catch {
      // Clear tokens if not authenticated
      await Cache.clear(); // Fix: Use Cache instead of cache
      localStorage.removeItem("lastAuthUser");
      localStorage.removeItem("accessToken");
      localStorage.removeItem("idToken");
      localStorage.removeItem("refreshToken");

      set({ user: null, loading: false, isLoggedIn: false });
    }
  },

  signIn: async (email, password) => {
    try {
      set({ user: null, error: null });
      await authService.signIn(email, password);
      const currentUser = await authService.getCurrentUser();

      // Extract user ID from Cognito user
      const userId = currentUser.userId || currentUser.username;
      const user = { ...currentUser, userId };

      set({ user, error: null, isLoggedIn: true });

      // Load decks immediately after successful sign in
      const deckStore = useDeckStore.getState();

      await Promise.all([
        deckStore.loadUserDecks(),
        deckStore.syncLocalDecks(),
      ]);

      set((state) => ({
        ...state,
        toastMessage: {
          message: "Successfully loaded your decks",
          type: "success",
        },
      }));
    } catch (error: any) {
      console.error("Sign in error:", error);
      set({ error: error.message, user: null, isLoggedIn: false });
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
      await signOut();
      // Clear Amplify cache
      await Cache.clear(); // Fix: Use Cache instead of cache

      // Clear any local storage items related to auth
      localStorage.removeItem("lastAuthUser");
      localStorage.removeItem("accessToken");
      localStorage.removeItem("idToken");
      localStorage.removeItem("refreshToken");

      // Clear user decks when signing out
      useDeckStore.getState().clearUserDecks();
      set({ user: null, error: null, isLoggedIn: false });
    } catch (error: any) {
      console.error("Sign out error:", error);
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
