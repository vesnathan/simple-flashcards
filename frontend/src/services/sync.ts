/* eslint-disable no-console */
import { localStorageService } from "./localStorage";
import { authService } from "./auth";

import { Deck } from "@/types/deck";

export const syncService = {
  async saveDeckToDb(deck: Deck): Promise<Deck> {
    try {
      const token = await authService.getToken();

      if (!token) {
        throw new Error("No auth token available");
      }

      const response = await fetch(process.env.NEXT_PUBLIC_API_URL || "", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(deck),
      });

      if (!response.ok) {
        const error = await response.text();

        throw new Error(`API Error: ${error}`);
      }

      const result = await response.json();

      console.log("Deck synced successfully:", result);

      return result;
    } catch (error) {
      console.error("Sync error:", error);
      throw error;
    }
  },

  async syncLocalDecks(): Promise<void> {
    const localDecks = localStorageService.getDecks();

    console.log("Starting sync of local decks:", localDecks.length);

    const syncPromises = localDecks.map(async (deck) => {
      try {
        await this.saveDeckToDb(deck);
        localStorageService.deleteDeck(deck.id);
        console.log("Successfully synced and removed deck:", deck.id);
      } catch (error) {
        console.error(`Failed to sync deck ${deck.id}:`, error);
        throw error;
      }
    });

    await Promise.all(syncPromises);
  },
};
