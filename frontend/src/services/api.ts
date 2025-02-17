/* eslint-disable no-console */
import { Deck } from "../../../types/deck";

import { authService } from "./auth";

import { env } from "@/config/env";

const getBaseUrl = () => {
  const apiUrl = env.api.baseUrl;
  // Remove '/decks' and ensure we have the stage in the path
  const baseUrl = apiUrl.split("/decks")[0];

  console.log("API Base URL:", baseUrl); // Debug log

  return baseUrl;
};

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

  async getPublicDecks(): Promise<Deck[]> {
    const baseUrl = getBaseUrl();
    const response = await fetch(`${baseUrl}/public`);

    console.log("Fetching public decks from:", `${baseUrl}/public`);
    if (!response.ok) throw new Error("Failed to fetch public decks");

    return response.json();
  },

  async getUserDecks(): Promise<Deck[]> {
    const token = await authService.getToken();

    console.log("Getting user decks with token:", !!token);

    if (!token) {
      console.log("No auth token available");

      return [];
    }

    const baseUrl = getBaseUrl();
    const url = `${baseUrl}/user-decks`;

    console.log("Fetching user decks from:", url);

    try {
      const response = await fetch(url, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      console.log("User decks response:", {
        url,
        status: response.status,
        ok: response.ok,
        headers: Object.fromEntries(response.headers.entries()),
        statusText: response.statusText,
      });

      if (!response.ok) {
        const errorText = await response.text();

        console.error("API Error:", errorText);

        return [];
      }

      const data = await response.json();

      console.log("User decks data:", data);

      return data;
    } catch (error) {
      console.error("Failed to fetch user decks:", error);

      return [];
    }
  },

  async syncLocalDecks(decks: Deck[]): Promise<void> {
    const token = await authService.getToken();

    if (!token) throw new Error("No auth token available");

    const response = await fetch(`${env.api.baseUrl}/sync`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ decks }),
    });

    if (!response.ok) throw new Error("Failed to sync local decks");
  },
};
