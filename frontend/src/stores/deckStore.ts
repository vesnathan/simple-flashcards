/* eslint-disable no-console */
import { create } from "zustand";

import { Deck, CardType } from "../../../types/deck";

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
  decks: Deck[];
  loadLocalDecks: () => void;
  localDecks: Deck[];
  addCard: (question: string, answer: string) => void;
}

export const useDeckStore = create<DeckStore>((set) => ({
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
        decks: state.decks.map((d) =>
          d.id === updatedDeck.id ? updatedDeck : d,
        ),
      };
    });
  },
  deleteCard: (card: CardType) =>
    set((state) => {
      if (state.currentlySelectedDeck) {
        return {
          currentlySelectedDeck: {
            ...state.currentlySelectedDeck,
            cards: state.currentlySelectedDeck.cards.filter(
              (c) => c.id !== card.id,
            ),
          },
        };
      }

      return state;
    }),
  syncDeck: async (deck: Deck) => {
    set((state) => ({
      decks: state.decks.map((d) =>
        d.id === deck.id ? { ...d, syncStatus: "syncing" } : d,
      ),
    }));

    try {
      await syncService.saveDeckToDb(deck);
      set((state) => ({
        decks: state.decks.map((d) =>
          d.id === deck.id ? { ...d, syncStatus: "synced", isLocal: false } : d,
        ),
      }));
    } catch (error) {
      set((state) => ({
        decks: state.decks.map((d) =>
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

      // Remove synced decks from local state
      set((state) => ({
        localDecks: state.localDecks.filter((d) => d.syncStatus !== "syncing"),
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
  decks: [],
  localDecks: [],

  loadLocalDecks: () => {
    const decks = localStorageService.getDecks();

    set({ localDecks: decks });
  },
}));
