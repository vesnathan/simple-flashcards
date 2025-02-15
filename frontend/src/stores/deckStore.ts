/* eslint-disable no-console */
import { create } from "zustand";

import { Deck, CardType } from "../../../types/deck";

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
  decks: Deck[];
  loadLocalDecks: () => void;
  localDecks: Deck[];
  addCard: (question: string, answer: string) => void;
  addLocalDeck: (deck: Deck) => void;
  loadUserDecks: (userId: string) => Promise<void>;
  clearUserDecks: () => void;
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

      // Set first card if this was the first card added
      const shouldSetCurrentCard =
        !state.currentCard || state.currentlySelectedDeck.cards.length === 0;

      // If it's a local deck, update localDecks
      if (state.currentlySelectedDeck.isLocal) {
        return {
          ...state,
          currentlySelectedDeck: updatedDeck,
          currentCard: shouldSetCurrentCard ? newCard : state.currentCard,
          localDecks: state.localDecks.map((d) =>
            d.id === updatedDeck.id ? updatedDeck : d,
          ),
        };
      }

      return {
        ...state,
        currentlySelectedDeck: updatedDeck,
        currentCard: shouldSetCurrentCard ? newCard : state.currentCard,
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
        d.id === deck.id ? { ...d, syncStatus: "syncing" as const } : d,
      ),
    }));

    try {
      const syncedDeck = await syncService.saveDeckToDb(deck);

      set((state) => ({
        decks: [
          ...state.decks.filter((d) => d.id !== deck.id),
          { ...syncedDeck, syncStatus: "synced" as const },
        ],
        localDecks: state.localDecks.filter((d) => d.id !== deck.id),
      }));
    } catch (error) {
      set((state) => ({
        decks: state.decks.map((d) =>
          d.id === deck.id ? { ...d, syncStatus: "local" as const } : d,
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
          syncStatus: "syncing" as const,
        })),
      }));

      // Sync decks and add to decks array
      for (const deck of localDecks) {
        try {
          const syncedDeck = await syncService.saveDeckToDb(deck);

          set((state) => ({
            decks: [...state.decks, { ...syncedDeck, syncStatus: "synced" }],
          }));
          localStorageService.deleteDeck(deck.id);
        } catch (error) {
          console.error(`Failed to sync deck ${deck.id}:`, error);
          throw error;
        }
      }

      // Clear synced decks from state
      set((state) => ({
        localDecks: state.localDecks.filter((d) => d.syncStatus !== "syncing"),
      }));
    } catch (error) {
      console.error("Sync failed:", error);
      // Reset sync status on failure
      set((state) => ({
        localDecks: state.localDecks.map((d) =>
          d.syncStatus === "syncing"
            ? { ...d, syncStatus: "local" as const }
            : d,
        ),
      }));
      throw error;
    }
  },
  decks: [],
  localDecks: localStorageService.getDecks(),

  loadLocalDecks: () => {
    const decks = localStorageService.getDecks();

    set({ localDecks: decks });
  },
  addLocalDeck: (deck) => {
    localStorageService.addDeck(deck);
    set({
      localDecks: localStorageService.getDecks(),
      currentlySelectedDeck: deck,
    });
  },
  loadUserDecks: async (userId: string) => {
    try {
      const decks = await deckService.getUserDecks(userId);

      set((state) => ({
        ...state,
        decks: decks,
      }));
    } catch (error) {
      console.error("Failed to load user decks:", error);
      throw error;
    }
  },
  clearUserDecks: () => {
    set((state) => ({
      ...state,
      decks: state.decks.filter(
        (deck) => deck.isPublic || deck.userId === "system",
      ),
      currentlySelectedDeck: null,
      currentCard: null,
    }));
  },
}));
