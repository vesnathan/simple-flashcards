/* eslint-disable no-console */
"use client";

import { useEffect, useState } from "react";

import { Deck } from "../../../types/deck";

import { MainLayout } from "@/components/Layouts/MainLayout";
import { DeckView } from "@/components/decks/DeckView";
import { deckService } from "@/services/api";

export default function HomePage() {
  const [decks, setDecks] = useState<Deck[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadDecks = async () => {
      try {
        const loadedDecks = await deckService.getDecks();

        setDecks(loadedDecks);
      } catch (error) {
        console.error("Failed to load decks:", error);
      } finally {
        setLoading(false);
      }
    };

    loadDecks();
  }, []);

  if (loading) return <div>Loading...</div>;

  return (
    <MainLayout decks={decks}>
      <DeckView />
    </MainLayout>
  );
}
