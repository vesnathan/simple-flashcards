"use client";

import { cn } from "@heroui/theme";
import { Button } from "@heroui/button";
import { useState } from "react";

import { Deck } from "@/types/deck";
import { useDeckStore } from "@/stores/deckStore";

interface MainLayoutSidebarProps {
  decks: Deck[];
}

export function MainLayoutSidebar({ decks }: MainLayoutSidebarProps) {
  const { setDeck, currentlySelectedDeck } = useDeckStore();
  const [activeCategory, setActiveCategory] = useState<"public" | "private">(
    "private",
  );

  const handleDeckSelect = (deck: Deck) => {
    setDeck(deck);
  };

  const filteredDecks = decks.filter((deck) =>
    activeCategory === "public" ? deck.isPublic : !deck.isPublic,
  );

  return (
    <div
      className={cn(
        "fixed top-0 bottom-0 bg-white",
        "flex flex-col",
        "border-neutral-200 border-r",
        "w-[240px]",
        "shadow-sm",
      )}
    >
      <div className="p-4 border-b border-neutral-200">
        <h1 className="text-xl font-semibold text-neutral-800">
          Super Simple Flashcards
        </h1>
      </div>

      <div className="flex border-b border-neutral-200">
        <Button
          className={cn(
            "flex-1 rounded-none py-2",
            activeCategory === "private"
              ? "bg-neutral-100 text-primary-600 font-medium border-b-2 border-primary-600"
              : "bg-transparent text-neutral-600",
          )}
          onPress={() => setActiveCategory("private")}
        >
          My Decks
        </Button>
        <Button
          className={cn(
            "flex-1 rounded-none py-2",
            activeCategory === "public"
              ? "bg-neutral-100 text-primary-600 font-medium border-b-2 border-primary-600"
              : "bg-transparent text-neutral-600",
          )}
          onPress={() => setActiveCategory("public")}
        >
          Public
        </Button>
      </div>

      <div className={cn("flex flex-col w-full", "overflow-y-auto", "py-2")}>
        {filteredDecks.map((deck) => (
          <Button
            key={deck.title}
            className={cn(
              "w-full rounded-none px-4 py-3 text-left justify-start",
              "transition-colors duration-200",
              "hover:bg-neutral-100",
              currentlySelectedDeck?.title === deck.title
                ? "bg-primary-50 text-primary-600 font-medium border-l-4 border-primary-600"
                : "bg-transparent text-neutral-600",
            )}
            onPress={() => handleDeckSelect(deck)}
          >
            {deck.title}
          </Button>
        ))}
      </div>

      <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-neutral-200 bg-white">
        <Button
          className="w-full bg-primary-600 hover:bg-primary-700 text-white"
          onPress={() => {}}
        >
          Add Deck
        </Button>
      </div>
    </div>
  );
}
