import { create } from "zustand";

import { authService } from "@/services/auth";

interface AuthState {
  user: any | null;
  loading: boolean;
  error: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  checkAuth: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  loading: true,
  error: null,

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
      const user = await authService.signIn(email, password);

      set({ user, error: null });
    } catch (error: any) {
      set({ error: error.message });
    }
  },

  signOut: async () => {
    await authService.signOut();
    set({ user: null });
  },
}));
