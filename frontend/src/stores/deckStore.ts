import { create } from "zustand";

import { Deck, CardType } from "@/types/deck";
import { localStorageService } from "@/services/localStorage";

interface DeckState {
  currentlySelectedDeck: Deck | null;
  currentCard: CardType | null;
  localDecks: Deck[];
  setDeck: (deck: Deck) => void;
  setCurrentCard: (card: CardType | null) => void;
  deleteCard: (card: CardType) => void;
  addDeck: (title: string) => void;
  loadLocalDecks: () => void;
  addCard: (question: string, answer: string) => void;
}

export const useDeckStore = create<DeckState>((set) => ({
  currentlySelectedDeck: null,
  currentCard: null,
  localDecks: [],

  loadLocalDecks: () => {
    const decks = localStorageService.getDecks();

    set({ localDecks: decks });
  },

  setDeck: (deck) => {
    set({
      currentlySelectedDeck: deck,
      currentCard: deck.cards.length > 0 ? deck.cards[0] : null,
    });
  },

  setCurrentCard: (card) => set({ currentCard: card }),

  addDeck: (title) => {
    const newDeck: Deck = {
      id: `local_${Date.now()}`,
      title,
      cards: [],
      isLocal: true,
      createdAt: new Date().toISOString(),
    };

    localStorageService.saveDeck(newDeck);
    set((state) => ({
      localDecks: [...state.localDecks, newDeck],
      currentlySelectedDeck: newDeck, // Auto-select the new deck
    }));
  },

  deleteCard: (cardToDelete) =>
    set((state) => {
      if (!state.currentlySelectedDeck) return state;

      const updatedCards = state.currentlySelectedDeck.cards.filter(
        (card) => card.id !== cardToDelete.id,
      );

      const updatedDeck = {
        ...state.currentlySelectedDeck,
        cards: updatedCards,
      };

      // Update local storage if it's a local deck
      if (state.currentlySelectedDeck.isLocal) {
        localStorageService.updateDeck(updatedDeck);
      }

      // Find next card to show
      const currentIndex = state.currentlySelectedDeck.cards.findIndex(
        (card) => card.id === cardToDelete.id,
      );
      const nextCard = updatedCards[currentIndex] || updatedCards[0] || null;

      return {
        currentlySelectedDeck: updatedDeck,
        currentCard: nextCard,
      };
    }),

  addCard: (question, answer) =>
    set((state) => {
      if (!state.currentlySelectedDeck) return state;

      const newCard: CardType = {
        id: state.currentlySelectedDeck.cards.length,
        question,
        answer,
      };

      const updatedDeck = {
        ...state.currentlySelectedDeck,
        cards: [...state.currentlySelectedDeck.cards, newCard],
      };

      if (updatedDeck.isLocal) {
        localStorageService.updateDeck(updatedDeck);
      }

      return {
        currentlySelectedDeck: updatedDeck,
        currentCard: newCard,
      };
    }),
}));
