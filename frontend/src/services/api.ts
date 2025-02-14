import { Deck } from '../types/deck';

const API_URL = process.env.NEXT_PUBLIC_API_URL;

export const deckService = {
  async getDecks(): Promise<Deck[]> {
    console.log('Fetching decks from:', `${API_URL}/decks`);
    const response = await fetch(`${API_URL}/decks`);
    if (!response.ok) {
      console.error('Failed to fetch decks:', response.status, response.statusText);
      throw new Error('Failed to fetch decks');
    }
    const data = await response.json();
    console.log('Received decks:', data);
    return data;
  },

  async getDeck(id: string): Promise<Deck> {
    console.log('Fetching deck:', id);
    const response = await fetch(`${API_URL}/decks/${id}`);
    if (!response.ok) {
      console.error('Failed to fetch deck:', response.status, response.statusText);
      throw new Error('Failed to fetch deck');
    }
    const data = await response.json();
    console.log('Received deck:', data);
    return data;
  }
};
