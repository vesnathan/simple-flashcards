/* eslint-disable no-console */
import { create } from "zustand";

import { Deck, CardType } from "../../../types/deck";

import { generateId } from "@/utils/id";
import { authService } from "@/services/auth";
import { deckService } from "@/services/api";
import { syncService } from "@/services/sync";
import { localStorageService } from "@/services/localStorage";

interface DeckStore {
  currentlySelectedDeck: Deck | null;
  currentCard: CardType | null;
  setCurrentCard: (card: CardType) => void;
  setDeck: (deck: Deck) => void;
  deleteCard: (card: CardType) => void;
  syncDeck: (deck: Deck) => Promise<void>;
  syncLocalDecks: () => Promise<void>;
  publicDecks: Deck[];
  privateDecks: Deck[];
  localDecks: Deck[];
  loadLocalDecks: () => void;
  addCard: (question: string, answer: string) => void;
  addDeck: (title: string) => Promise<void>;
  loadUserDecks: () => Promise<void>;
  clearUserDecks: () => void;
  loadPublicDecks: () => Promise<void>; // Add this line
}

export const useDeckStore = create<DeckStore>((set, get) => ({
  currentlySelectedDeck: null,
  setDeck: (deck: Deck) =>
    set({
      currentlySelectedDeck: deck,
      currentCard: deck.cards.length > 0 ? deck.cards[0] : null, // Set first card when selecting deck
    }),
  currentCard: null,
  setCurrentCard: (card: CardType) => set({ currentCard: card }),
  addCard: (question: string, answer: string) => {
    set((state) => {
      if (!state.currentlySelectedDeck) return state;

      const newCard: CardType = {
        id: state.currentlySelectedDeck.cards.length, // Simple ID generation
        question,
        answer,
      };

      const updatedDeck = {
        ...state.currentlySelectedDeck,
        cards: [...state.currentlySelectedDeck.cards, newCard],
      };

      // If it's a local deck, update localDecks
      if (state.currentlySelectedDeck.isLocal) {
        return {
          ...state,
          currentlySelectedDeck: updatedDeck,
          localDecks: state.localDecks.map((d) =>
            d.id === updatedDeck.id ? updatedDeck : d,
          ),
        };
      }

      return {
        ...state,
        currentlySelectedDeck: updatedDeck,
        privateDecks: state.privateDecks.map((d) =>
          d.id === updatedDeck.id ? updatedDeck : d,
        ),
      };
    });
  },
  deleteCard: (card: CardType) =>
    set((state) => {
      if (!state.currentlySelectedDeck) return state;

      const updatedDeck = {
        ...state.currentlySelectedDeck,
        cards: state.currentlySelectedDeck.cards.filter(
          (c) => c.id !== card.id,
        ),
      };

      // Update in local storage if it's a local deck
      if (state.currentlySelectedDeck.isLocal) {
        localStorageService.updateDeck(updatedDeck);

        return {
          ...state,
          currentlySelectedDeck: updatedDeck,
          localDecks: state.localDecks.map((d) =>
            d.id === updatedDeck.id ? updatedDeck : d,
          ),
        };
      }

      // Otherwise update in the regular decks array
      return {
        ...state,
        currentlySelectedDeck: updatedDeck,
        privateDecks: state.privateDecks.map((d) =>
          d.id === updatedDeck.id ? updatedDeck : d,
        ),
      };
    }),

  syncDeck: async (deck: Deck) => {
    set((state) => ({
      privateDecks: state.privateDecks.map((d) =>
        d.id === deck.id ? { ...d, syncStatus: "syncing" } : d,
      ),
    }));

    try {
      await syncService.saveDeckToDb(deck);
      set((state) => ({
        privateDecks: state.privateDecks.map((d) =>
          d.id === deck.id ? { ...d, syncStatus: "synced", isLocal: false } : d,
        ),
      }));
    } catch (error) {
      set((state) => ({
        privateDecks: state.privateDecks.map((d) =>
          d.id === deck.id ? { ...d, syncStatus: "local" } : d,
        ),
      }));
      throw error;
    }
  },
  syncLocalDecks: async () => {
    const localDecks = localStorageService.getDecks();

    if (localDecks.length === 0) {
      console.log("No local decks to sync");

      return;
    }

    console.log("Syncing local decks:", localDecks);

    try {
      // Mark all local decks as syncing
      set((state) => ({
        localDecks: state.localDecks.map((d) => ({
          ...d,
          syncStatus: "syncing",
        })),
      }));

      await syncService.syncLocalDecks();

      // Load updated decks from server after sync
      const userDecks = await deckService.getUserDecks();

      set((state) => ({
        localDecks: [],
        privateDecks: userDecks,
        currentlySelectedDeck:
          userDecks.find((d) => d.id === state.currentlySelectedDeck?.id) ||
          state.currentlySelectedDeck,
      }));
    } catch (error) {
      console.error("Sync failed:", error);
      // Reset sync status on failure
      set((state) => ({
        localDecks: state.localDecks.map((d) =>
          d.syncStatus === "syncing" ? { ...d, syncStatus: "local" } : d,
        ),
      }));
      throw error;
    }
  },
  publicDecks: [],
  privateDecks: [],
  localDecks: [],

  loadLocalDecks: () => {
    const decks = localStorageService.getDecks();

    set({ localDecks: decks });
  },

  addDeck: async (title: string) => {
    try {
      const token = await authService.getToken();

      if (token) {
        const newDeck = await deckService.createDeck(title);

        set((state) => ({
          privateDecks: [...state.privateDecks, newDeck],
          currentlySelectedDeck: newDeck,
        }));

        return;
      }

      // Fall back to local storage if not authenticated
      const newDeck: Deck = {
        id: generateId(),
        title,
        cards: [],
        isLocal: true,
        lastModified: Date.now(),
        syncStatus: "local",
      };

      localStorageService.addDeck(newDeck);
      set(() => ({
        localDecks: localStorageService.getDecks(),
        currentlySelectedDeck: newDeck,
      }));
    } catch (error) {
      console.error("Failed to create deck:", error);
      throw error;
    }
  },

  loadPublicDecks: async () => {
    try {
      console.log("Loading public decks...");
      const publicDecks = await deckService.getDecks();

      console.log("Received public decks:", {
        count: publicDecks.length,
        decks: publicDecks.map((d) => ({ id: d.id, title: d.title })),
      });

      set((state) => ({
        ...state,
        publicDecks: publicDecks.map((deck) => ({ ...deck, isPublic: true })),
      }));
    } catch (error) {
      console.error("Failed to load public decks:", error);
    }
  },

  loadUserDecks: async () => {
    try {
      // Now only load private user decks
      const userDecks = await deckService.getUserDecks().catch((err) => {
        console.error("Failed to fetch user decks:", err);

        return [];
      });

      console.log("Setting private decks:", {
        count: userDecks.length,
        decks: userDecks.map((d) => ({ id: d.id, title: d.title })),
      });

      set((state) => ({
        ...state,
        privateDecks: userDecks.filter((deck) => !deck.isPublic),
      }));
    } catch (error) {
      console.error("Failed to load private decks:", error);
    }
  },

  clearUserDecks: () => {
    set((state) => ({
      ...state,
      privateDecks: [],
      currentlySelectedDeck: null,
      currentCard: null,
    }));
  },
}));
