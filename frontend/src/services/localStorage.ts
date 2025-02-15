import { Deck } from "../../../types/deck";

const DECKS_KEY = "flashcards_decks";

export const localStorageService = {
  getDecks(): Deck[] {
    if (typeof window === "undefined") return [];
    const decks = localStorage.getItem(DECKS_KEY);

    return decks ? JSON.parse(decks) : [];
  },

  saveDeck(deck: Deck) {
    const decks = this.getDecks();
    const updatedDecks = [...decks, deck];

    localStorage.setItem(DECKS_KEY, JSON.stringify(updatedDecks));
  },

  updateDeck(updatedDeck: Deck) {
    const decks = this.getDecks();
    const newDecks = decks.map((deck) =>
      deck.id === updatedDeck.id ? updatedDeck : deck,
    );

    localStorage.setItem(DECKS_KEY, JSON.stringify(newDecks));
  },

  deleteDeck(deckId: string) {
    const decks = this.getDecks();
    const newDecks = decks.filter((deck) => deck.id !== deckId);

    localStorage.setItem(DECKS_KEY, JSON.stringify(newDecks));
  },

  addDeck(deck: Deck): void {
    const decks = this.getDecks();

    decks.push(deck);
    localStorage.setItem(DECKS_KEY, JSON.stringify(decks));
  },
};
