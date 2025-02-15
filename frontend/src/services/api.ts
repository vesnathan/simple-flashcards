/* eslint-disable no-console */
import { Deck } from "../../../types/deck";

import { authService } from "./auth";

import { env } from "@/config/env";

export const deckService = {
  async getDecks(): Promise<Deck[]> {
    const response = await fetch(env.api.baseUrl);

    console.log("Fetching decks from:", env.api.baseUrl);

    if (!response.ok) {
      console.error("API Error:", response.status, response.statusText);
      throw new Error("Failed to fetch decks");
    }

    return response.json();
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

  async getUserDecks(userId: string): Promise<Deck[]> {
    const token = await authService.getToken();
    const response = await fetch(`${env.api.baseUrl}?userId=${userId}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      console.error("API Error:", response.status, response.statusText);
      throw new Error("Failed to fetch user decks");
    }

    return response.json();
  },
};
