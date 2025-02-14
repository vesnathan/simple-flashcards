export interface Card {
  id: number;
  question: string;
  answer: string;
}

export interface Deck {
  id: string;
  userId: string;
  title: string;
  isPublic: string;
  createdAt: string;
  cards: Card[];
}