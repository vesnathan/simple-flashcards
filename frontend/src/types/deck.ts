export interface CardType {
  id: number;
  question: string;
  answer: string;
}

export interface Deck {
  title: string;
  cards: CardType[];
}

export type Decks = Deck[];