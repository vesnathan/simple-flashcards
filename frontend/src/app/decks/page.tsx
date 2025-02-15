"use client";

import { useEffect, useState } from "react";

import { deckService } from "../../services/api";
import { Deck } from "../../../../types/deck";

export default function DecksPage() {
  const [decks, setDecks] = useState<Deck[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadDecks() {
      try {
        const data = await deckService.getDecks();

        setDecks(data);
      } catch {
        setError("Failed to load decks");
      } finally {
        setLoading(false);
      }
    }
    loadDecks();
  }, []);

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Flashcard Decks</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {decks.map((deck) => (
          <div key={deck.id} className="border rounded-lg p-4 shadow">
            <h2 className="text-xl font-semibold">{deck.title}</h2>
            <p className="text-gray-600">{deck.cards.length} cards</p>
            <p className="text-sm text-gray-500">
              {deck.createdAt
                ? `Created: ${new Date(deck.createdAt).toLocaleDateString()}`
                : "Recently created"}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
