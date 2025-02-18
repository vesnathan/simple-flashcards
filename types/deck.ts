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
  userId?: string;
  createdAt?: number; // Add this field
  lastModified: number;
}

export type Decks = Deck[];
