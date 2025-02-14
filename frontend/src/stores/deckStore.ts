import { create } from "zustand";

import { Deck, CardType } from "@/types/deck";

interface DeckState {
  currentlySelectedDeck: Deck | null;
  currentCard: CardType | null;
  setDeck: (deck: Deck) => void;
  setCurrentCard: (card: CardType | null) => void;
  deleteCard: (card: CardType) => void;
}

export const useDeckStore = create<DeckState>((set) => ({
  currentlySelectedDeck: null,
  currentCard: null,
  setDeck: (deck) => {
    set({
      currentlySelectedDeck: deck,
      currentCard: deck.cards.length > 0 ? deck.cards[0] : null,
    });
  },
  setCurrentCard: (card) => set({ currentCard: card }),
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

      return {
        currentlySelectedDeck: updatedDeck,
        currentCard: updatedCards.length > 0 ? updatedCards[0] : null,
      };
    }),
}));
