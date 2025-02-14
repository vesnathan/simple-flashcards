"use client";

import { cn } from "@heroui/theme";
import { Button } from "@heroui/button";
import { useState } from "react";

import { Deck } from "../../../../types";
import { useDeckStore } from "../../stores/deckStore";

interface MainLayoutSidebarProps {
  decks: Deck[];
}

const publicDecks: Deck[] = [
  {
    title: "Common English Phrases",
    cards: [
      { id: 0, question: "How are you?", answer: "I'm fine, thank you." },
      { id: 1, question: "Nice to meet you", answer: "Nice to meet you too" },
    ],
  },
  {
    title: "Basic Math",
    cards: [
      { id: 0, question: "2 + 2", answer: "4" },
      { id: 1, question: "5 x 5", answer: "25" },
    ],
  },
];

const myDecks: Deck[] = [
  {
    title: "Deck 1",
    cards: [
      { id: 0, question: "What is the capital of France?", answer: "Paris" },
      { id: 1, question: "What is the capital of Spain?", answer: "Madrid" },
    ],
  },
  {
    title: "Deck 2",
    cards: [
      { id: 0, question: "What is the capital of Germany?", answer: "Berlin" },
      { id: 1, question: "What is the capital of the UK?", answer: "London" },
    ],
  },
];

export function MainLayoutSidebar({ decks }: MainLayoutSidebarProps) {
  const { setDeck, currentlySelectedDeck } = useDeckStore();
  const [activeCategory, setActiveCategory] = useState<"public" | "private">(
    "private",
  );

  const handleDeckSelect = (deck: Deck) => {
    setDeck(deck);
  };

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
        {(activeCategory === "public" ? publicDecks : myDecks).map((deck) => {
          return (
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
          );
        })}
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
