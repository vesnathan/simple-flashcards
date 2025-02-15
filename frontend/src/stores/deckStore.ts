/* eslint-disable no-console */
import { create } from "zustand";

import { syncService } from "@/services/sync";
import { localStorageService } from "@/services/localStorage";
import { Deck, CardType } from "@/types";

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
  addCard: (card: CardType) =>
    set((state) => {
      if (state.currentlySelectedDeck) {
        return {
          currentlySelectedDeck: {
            ...state.currentlySelectedDeck,
            cards: [...state.currentlySelectedDeck.cards, card],
          },
        };
      }

      return state;
    }),
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

    for (const deck of localDecks) {
      try {
        set((state) => ({
          decks: state.decks.map((d) =>
            d.id === deck.id ? { ...d, syncStatus: "syncing" } : d,
          ),
        }));

        await syncService.saveDeckToDb(deck);
        localStorageService.deleteDeck(deck.id);

        set((state) => ({
          decks: state.decks.map((d) =>
            d.id === deck.id
              ? { ...d, syncStatus: "synced", isLocal: false }
              : d,
          ),
        }));
      } catch (error) {
        console.error(`Failed to sync deck ${deck.id}:`, error);
        set((state) => ({
          decks: state.decks.map((d) =>
            d.id === deck.id ? { ...d, syncStatus: "local" } : d,
          ),
        }));
      }
    }
  },
  decks: [],
  localDecks: [],

  loadLocalDecks: () => {
    const decks = localStorageService.getDecks();

    set({ localDecks: decks });
  },
}));
