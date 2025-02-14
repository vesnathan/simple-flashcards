export interface CardType {
  id: number;
  question: string;
  answer: string;
}

export interface Deck {
  id: string;
  title: string;
  cards: CardType[];
  isPublic?: boolean;
  isLocal?: boolean;
  userId?: string;
  createdAt?: string;
}

export type Decks = Deck[];
