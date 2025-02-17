"use client";

import { useDeckStore } from "@/stores/deckStore";

export default function DecksPage() {
  const { currentlySelectedDeck } = useDeckStore();

  return (
    <div className="container mx-auto p-4">
      {currentlySelectedDeck ? (
        <div className="border rounded-lg p-4 shadow">
          <h2 className="text-xl font-semibold">
            {currentlySelectedDeck.title}
          </h2>
          <p className="text-gray-600">
            {currentlySelectedDeck.cards.length} cards
          </p>
          <p className="text-sm text-gray-500">
            {currentlySelectedDeck.createdAt
              ? `Created: ${new Date(currentlySelectedDeck.createdAt).toLocaleDateString()}`
              : "Recently created"}
          </p>
        </div>
      ) : (
        <div className="text-center text-gray-500">
          Select a deck from the sidebar to view details
        </div>
      )}
    </div>
  );
}
