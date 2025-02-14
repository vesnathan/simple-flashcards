/* eslint-disable no-console */
"use client";

import { useEffect, useState } from "react";

import { MainLayout } from "@/components/Layouts/MainLayout";
import { DeckView } from "@/components/decks/DeckView";
import { deckService } from "@/services/api";
import { Deck } from "@/types/deck";
import { useDeckStore } from "@/stores/deckStore";

export default function HomePage() {
  const [decks, setDecks] = useState<Deck[]>([]);
  const [loading, setLoading] = useState(true);
  const { loadLocalDecks } = useDeckStore();

  useEffect(() => {
    const loadAllDecks = async () => {
      try {
        // Load remote decks
        const remoteDecks = await deckService.getDecks();

        setDecks(remoteDecks);

        // Load local decks
        loadLocalDecks();
      } catch (error) {
        console.error("Failed to load decks:", error);
      } finally {
        setLoading(false);
      }
    };

    loadAllDecks();
  }, [loadLocalDecks]);

  if (loading) return <div>Loading...</div>;

  return (
    <MainLayout decks={decks}>
      <DeckView />
    </MainLayout>
  );
}
