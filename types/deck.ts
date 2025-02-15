export interface CardType {
  id: number;
  question: string;
  answer: string;
}

export interface Deck {
  id: string; // Make id required again
  title: string;
  cards: CardType[];
  isPublic?: boolean;
  isLocal?: boolean;
  userId?: string;
  createdAt?: string;
  syncStatus?: "syncing" | "synced" | "local";
  lastModified: number;
}

export type Decks = Deck[];
