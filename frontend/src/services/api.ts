/* eslint-disable no-console */
import { Deck } from "../../../types/deck";

import { authService } from "./auth";

import { env } from "@/config/env";

export const deckService = {
  async getDecks(): Promise<Deck[]> {
    console.log("Fetching public decks from:", env.api.baseUrl);

    try {
      const response = await fetch(env.api.baseUrl);

      console.log("Raw response:", response);

      if (!response.ok) {
        const errorText = await response.text();

        console.error("API Error:", {
          status: response.status,
          statusText: response.statusText,
          body: errorText,
        });
        throw new Error(`Failed to fetch decks: ${errorText}`);
      }

      const data = await response.json();

      console.log("Raw deck data:", data);

      // Ensure each deck has the required fields
      const publicDecks = (data || []).map((deck: Deck) => ({
        ...deck,
        isPublic: true,
        syncStatus: deck.syncStatus || "synced",
        lastModified: deck.lastModified || Date.now(),
        cards: deck.cards || []
      }));

      console.log("Processed public decks:", {
        count: publicDecks.length,
        decks: publicDecks.map((d) => ({ 
          id: d.id, 
          title: d.title,
          isPublic: d.isPublic,
          cards: d.cards.length
        }))
      });

      return publicDecks;
    } catch (error) {
      console.error("Detailed fetch error:", error);
      throw error;
    }
  },

  async getDeck(id: string): Promise<Deck> {
    console.log("Fetching deck:", id);
    const response = await fetch(`${env.api.baseUrl}/${id}`);

    if (!response.ok) {
      console.error(
        "Failed to fetch deck:",
        response.status,
        response.statusText,
      );
      throw new Error("Failed to fetch deck");
    }
    const data = await response.json();

    console.log("Received deck:", data);

    return data;
  },

  async createDeck(title: string): Promise<Deck> {
    const token = await authService.getToken();

    if (!token) throw new Error("No auth token available");

    const response = await fetch(`${env.api.baseUrl}/create`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ title }),
    });

    if (!response.ok) {
      const error = await response.text();

      console.error("Create deck error:", {
        status: response.status,
        statusText: response.statusText,
        error,
      });
      throw new Error(`Failed to create deck: ${error}`);
    }

    return response.json();
  },

  async getUserDecks(): Promise<Deck[]> {
    const token = await authService.getToken();

    if (!token) {
      console.log("No auth token available, skipping user decks fetch");

      return [];
    }

    console.log("Fetching user decks...");
    const response = await fetch(`${env.api.baseUrl}/user-decks`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    console.log("User decks response:", {
      status: response.status,
      ok: response.ok,
      statusText: response.statusText,
    });

    if (!response.ok) {
      console.error(
        "Failed to fetch user decks:",
        response.status,
        response.statusText,
      );
      throw new Error("Failed to fetch user decks");
    }

    const decks = await response.json();

    console.log("Received user decks:", {
      count: decks.length,
      decks: decks.map((d: Deck) => ({ id: d.id, title: d.title })),
    });

    return decks;
  },

  async syncDeck(deck: Deck): Promise<Deck> {
    const token = await authService.getToken();
    if (!token) throw new Error("No auth token available");

    console.log("Syncing deck:", { id: deck.id, title: deck.title });
    const response = await fetch(`${env.api.baseUrl}/sync`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(deck),
    });

    if (!response.ok) {
      const error = await response.text();

      console.error("Sync deck error:", {
        status: response.status,
        statusText: response.statusText,
        error,
      });
      throw new Error(`Failed to sync deck: ${error}`);
    }

    return response.json();
  },
};
