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
  setDeck: (deck: Deck | null) => void; // Update this line to allow null
  deleteCard: (card: CardType) => void;
  syncDeck: (deck: Deck) => Promise<void>;
  syncLocalDecks: () => Promise<void>;
  decks: Deck[];
  loadLocalDecks: () => void;
  localDecks: Deck[];
  addCard: (question: string, answer: string) => void;
  addLocalDeck: (deck: Deck) => void;
  loadUserDecks: () => Promise<void>; // Remove userId parameter
  clearUserDecks: () => void;
}

export const useDeckStore = create<DeckStore>((set) => ({
  currentlySelectedDeck: null,
  setDeck: (
    deck: Deck | null, // Update parameter type
  ) =>
    set({
      currentlySelectedDeck: deck,
      currentCard:
        deck && deck.cards && deck.cards.length > 0 ? deck.cards[0] : null, // Handle null case
    }),
  currentCard: null,
  setCurrentCard: (card: CardType) => set({ currentCard: card }),
  addCard: (question: string, answer: string) => {
    set((state) => {
      if (!state.currentlySelectedDeck) return state;

      const currentCards = state.currentlySelectedDeck.cards || [];
      const newCard: CardType = {
        id: currentCards.length,
        question,
        answer,
      };

      const updatedDeck = {
        ...state.currentlySelectedDeck,
        cards: [...currentCards, newCard],
      };

      const shouldSetCurrentCard =
        !state.currentCard || currentCards.length === 0;

      // Save to localStorage if it's a local deck
      if (state.currentlySelectedDeck.isLocal) {
        localStorageService.updateDeck(updatedDeck);

        return {
          ...state,
          currentlySelectedDeck: updatedDeck,
          currentCard: shouldSetCurrentCard ? newCard : state.currentCard,
          localDecks: state.localDecks.map((d) =>
            d.id === updatedDeck.id ? updatedDeck : d,
          ),
        };
      }

      // If it's a non-local deck, update decks
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
      if (!state.currentlySelectedDeck) return state;

      const updatedDeck = {
        ...state.currentlySelectedDeck,
        cards: state.currentlySelectedDeck.cards.filter(
          (c) => c.id !== card.id,
        ),
      };

      // Save to localStorage if it's a local deck
      if (state.currentlySelectedDeck.isLocal) {
        localStorageService.updateDeck(updatedDeck);
      }

      return {
        currentlySelectedDeck: updatedDeck,
      };
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
  loadUserDecks: async () => {
    try {
      const [publicDecks, userDecks] = await Promise.all([
        deckService.getPublicDecks(),
        deckService.getUserDecks().catch(() => []), // Handle failure gracefully
      ]);

      console.log("Loaded decks:", {
        public: publicDecks.length,
        user: userDecks.length,
      });

      // Combine and deduplicate by ID
      const allDecks = [...publicDecks, ...userDecks];
      const uniqueDecks = allDecks.reduce(
        (acc, deck) => {
          acc[deck.id] = deck;

          return acc;
        },
        {} as Record<string, Deck>,
      );

      set((state) => ({
        ...state,
        decks: Object.values(uniqueDecks),
      }));
    } catch (error) {
      console.error("Failed to load decks:", error);
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
