/* eslint-disable no-console */
import { localStorageService } from "./localStorage";
import { authService } from "./auth";

import { Deck } from "@/types/deck";

export const syncService = {
  async saveDeckToDb(deck: Deck): Promise<Deck> {
    try {
      const timestamp = Date.now();
      // Ensure all required fields are present
      const deckToSync = {
        id: deck.id,
        title: deck.title,
        cards: deck.cards,
        isPublic: deck.isPublic || false,
        lastModified: timestamp,
        createdAt: deck.createdAt || timestamp,
      };

      console.log("Syncing deck to DB:", {
        id: deckToSync.id,
        title: deckToSync.title,
        cardCount: deckToSync.cards.length,
        createdAt: deckToSync.createdAt,
        lastModified: deckToSync.lastModified,
        isPublic: deckToSync.isPublic,
      });

      const token = await authService.getToken();

      if (!token) {
        throw new Error("No auth token available");
      }

      const apiUrl = `${process.env.NEXT_PUBLIC_API_URL}/sync`;
      const response = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(deckToSync), // Send cleaned deck object
      });

      if (!response.ok) {
        const errorText = await response.text();

        console.error("API Error:", {
          status: response.status,
          statusText: response.statusText,
          error: errorText,
        });
        throw new Error(`API Error: ${response.status} - ${errorText}`);
      }

      const result = await response.json();

      if (!result.cards || !Array.isArray(result.cards)) {
        console.error("Invalid response:", result);
        throw new Error("Server returned invalid deck format");
      }

      return result;
    } catch (error) {
      console.error("Sync error:", {
        name: error instanceof Error ? error.name : "Unknown",
        message: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  },

  async syncLocalDecks(): Promise<void> {
    const localDecks = localStorageService.getDecks();

    console.log("Starting sync of local decks:", {
      count: localDecks.length,
      decks: localDecks.map((d) => ({
        id: d.id,
        title: d.title,
        cards: d.cards.length,
      })),
    });

    const syncPromises = localDecks.map(async (deck) => {
      try {
        await this.saveDeckToDb(deck);
        // After successful sync, remove from local storage
        localStorageService.deleteDeck(deck.id);
        console.log(`Synced and removed local deck: ${deck.id}`);
      } catch (error) {
        console.error(`Failed to sync deck ${deck.id}:`, error);
        throw error;
      }
    });

    await Promise.all(syncPromises);
  },
};
