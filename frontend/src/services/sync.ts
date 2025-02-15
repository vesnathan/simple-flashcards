/* eslint-disable no-console */
import { localStorageService } from "./localStorage";
import { authService } from "./auth";

import { Deck } from "@/types/deck";

export const syncService = {
  async saveDeckToDb(deck: Deck): Promise<Deck> {
    const token = await authService.getToken();
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(deck),
    });

    if (!response.ok) {
      throw new Error("Failed to sync deck");
    }

    return response.json();
  },

  async syncLocalDecks(): Promise<void> {
    const localDecks = localStorageService.getDecks();

    for (const deck of localDecks) {
      try {
        await this.saveDeckToDb(deck);
        localStorageService.deleteDeck(deck.id);
      } catch (error) {
        console.error(`Failed to sync deck ${deck.id}:`, error);
        // Leave failed decks in localStorage
      }
    }
  },
};
