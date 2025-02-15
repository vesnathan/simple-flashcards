/* eslint-disable no-console */
"use client";

import { useEffect, useState } from "react";

import { MainLayoutSidebar } from "@/components/Layouts/MainLayoutSidebar";
import { deckService } from "@/services/api";
import { Deck } from "@/types/deck";

export default function DecksLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [decks, setDecks] = useState<Deck[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadDecks() {
      try {
        const data = await deckService.getDecks();

        setDecks(data);
      } catch (error) {
        console.error("Failed to load decks:", error);
      } finally {
        setLoading(false);
      }
    }
    loadDecks();
  }, []);

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-neutral-50">
      <MainLayoutSidebar decks={decks} />
      {children}
    </div>
  );
}
