/* eslint-disable no-console */
import { create } from "zustand";

import { Deck, CardType } from "../../../types/deck";

import { useAuthStore } from "./authStore";

import { generateId } from "@/utils/id";
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
        lastModified: Date.now(),
      };

      // Set as current card if it's the first one
      const shouldSetCurrentCard = updatedDeck.cards.length === 1;

      // If deck is in localDecks array, update local storage
      if (state.localDecks.find((d) => d.id === updatedDeck.id)) {
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

      // Otherwise update in privateDecks array
      return {
        ...state,
        currentlySelectedDeck: updatedDeck,
        currentCard: shouldSetCurrentCard ? newCard : state.currentCard,
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
        lastModified: Date.now(),
      };

      // If deck is in localDecks array, update local storage
      if (state.localDecks.find((d) => d.id === updatedDeck.id)) {
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
    try {
      await syncService.saveDeckToDb(deck);
      set((state) => ({
        privateDecks: [...state.privateDecks, deck],
        localDecks: state.localDecks.filter((d) => d.id !== deck.id),
      }));
    } catch (error) {
      console.error("Failed to sync deck:", error);
      throw error;
    }
  },

  syncLocalDecks: async () => {
    const localDecks = localStorageService.getDecks();

    if (localDecks.length === 0) {
      console.log("No local decks to sync");

      return;
    }

    try {
      // Create each local deck in the DB
      for (const deck of localDecks) {
        await deckService.createDeck(deck.title, deck.cards);
        // Remove from local storage after successful sync
        localStorageService.deleteDeck(deck.id);
      }

      // After syncing all decks, refresh the lists
      const userDecks = await deckService.getUserDecks();

      set((state) => ({
        localDecks: [], // Clear local decks
        privateDecks: userDecks,
        currentlySelectedDeck: state.currentlySelectedDeck?.id
          ? userDecks.find(
              (d) => d.title === state.currentlySelectedDeck?.title,
            ) || null
          : null,
      }));
    } catch (error) {
      console.error("Failed to sync local decks:", error);
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
      const isLoggedIn = useAuthStore.getState().isLoggedIn;
      const timestamp = Date.now();

      if (!isLoggedIn) {
        // When not authenticated, create complete deck object for local storage
        const newDeck: Deck = {
          id: generateId(),
          title,
          cards: [],
          lastModified: timestamp,
          createdAt: timestamp,
          isPublic: false,
        };

        localStorageService.addDeck(newDeck);
        set((state) => ({
          localDecks: [...state.localDecks, newDeck],
          currentlySelectedDeck: newDeck,
        }));

        return;
      }

      // When authenticated, create deck in DB
      const newDeck = await deckService.createDeck(title);

      set((state) => ({
        privateDecks: [...state.privateDecks, newDeck],
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
