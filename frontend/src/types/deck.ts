export interface CardType {
  id: number;
  question: string;
  answer: string;
}

export interface Deck {
  title: string;
  cards: CardType[];
  isPublic?: boolean;
  userId?: string;
  createdAt?: string;
}

export type Decks = Deck[];
