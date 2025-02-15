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

      // Explicitly construct the deck object to send to DB
      const dbDeck = {
        id: deck.id,
        title: deck.title,
        cards: deck.cards,
        userId: deck.userId,
        isPublic: deck.isPublic,
        lastModified: deck.lastModified,
        createdAt: deck.createdAt,
      };

      const apiUrl = process.env.NEXT_PUBLIC_API_URL;

      console.log("Syncing deck to DB:", {
        ...dbDeck,
        cardCount: deck.cards.length,
      });

      const response = await fetch(apiUrl || "", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ deck: dbDeck }),
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

      return result.deck;
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
