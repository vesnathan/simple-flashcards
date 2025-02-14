import { create } from "zustand";

import { Deck, CardType } from "@/types";

interface DeckStore {
  currentlySelectedDeck: Deck | null;
  currentCard: CardType | null;
  setCurrentCard: (card: CardType) => void;
  setDeck: (deck: Deck) => void;
  deleteCard: (card: CardType) => void;
}

export const useDeckStore = create<DeckStore>((set) => ({
  currentlySelectedDeck: null,
  setDeck: (deck: Deck) => set({ currentlySelectedDeck: deck }),
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
}));
