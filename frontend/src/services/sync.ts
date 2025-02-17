/* eslint-disable no-console */
import { localStorageService } from "./localStorage";
import { authService } from "./auth";

import { Deck } from "@/types/deck";

export const syncService = {
  async saveDeckToDb(deck: Deck): Promise<Deck> {
    try {
      // Validate deck data before sending
      if (!deck.cards || !Array.isArray(deck.cards)) {
        console.error("Invalid deck data:", deck);
        throw new Error("Invalid deck data: cards array is missing or invalid");
      }

      // Create a clean deck object
      const deckToSync = {
        id: deck.id,
        title: deck.title,
        cards: deck.cards.map((card) => ({
          id: card.id,
          question: card.question,
          answer: card.answer,
        })),
        isPublic: deck.isPublic || false,
        lastModified: Date.now(),
      };

      console.log("Sending deck to sync:", {
        id: deckToSync.id,
        title: deckToSync.title,
        cards: deckToSync.cards,
        cardCount: deckToSync.cards.length,
      });

      const token = await authService.getToken();

      if (!token) {
        throw new Error("No auth token available");
      }

      const apiUrl = `${process.env.NEXT_PUBLIC_API_URL}/sync`; // Update URL to use sync endpoint

      console.log("Syncing deck:", {
        id: deck.id,
        title: deck.title,
        cardCount: deck.cards.length,
      });

      const response = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(deck),
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

    console.log("Starting sync of local decks:", localDecks.length);

    const syncPromises = localDecks.map(async (deck) => {
      try {
        const syncedDeck = await this.saveDeckToDb(deck);

        localStorageService.deleteDeck(deck.id);
        console.log("Successfully synced and removed deck:", deck.id);

        return syncedDeck;
      } catch (error) {
        console.error(`Failed to sync deck ${deck.id}:`, error);
        throw error;
      }
    });

    await Promise.all(syncPromises);
  },
};
