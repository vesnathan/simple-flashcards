/* eslint-disable no-console */
"use client";

import { useEffect } from "react";

import { MainLayout } from "@/components/Layouts/MainLayout";
import { DeckView } from "@/components/decks/DeckView";
import { useDeckStore } from "@/stores/deckStore";

export default function HomePage() {
  const { loadLocalDecks, loadPublicDecks } = useDeckStore();

  useEffect(() => {
    const loadAllDecks = async () => {
      try {
        // Load both local and remote decks
        await Promise.all([loadPublicDecks(), loadLocalDecks()]);
      } catch (error) {
        console.error("Failed to load decks:", error);
      }
    };

    loadAllDecks();
  }, [loadPublicDecks, loadLocalDecks]);

  return (
    <MainLayout>
      <DeckView />
    </MainLayout>
  );
}
