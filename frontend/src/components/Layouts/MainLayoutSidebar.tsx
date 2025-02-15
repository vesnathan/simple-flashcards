"use client";

import { cn } from "@heroui/theme";
import { Button } from "@heroui/button";
import { useState } from "react";

import { Deck } from "@/types/deck"; // Fix import path
import { useDeckStore } from "@/stores/deckStore"; // Fix import path
import { useAuthStore } from "@/stores/authStore";
import { AuthModal } from "@/components/auth/AuthModal";

interface MainLayoutSidebarProps {
  decks: Deck[];
}

export function MainLayoutSidebar({ decks }: MainLayoutSidebarProps) {
  const { setDeck, currentlySelectedDeck, localDecks } = useDeckStore();
  const [activeCategory, setActiveCategory] = useState<"public" | "private">(
    "private",
  );
  const [showAuthModal, setShowAuthModal] = useState(false);
  const { user, signOut } = useAuthStore();

  const privateDecks =
    activeCategory === "private"
      ? [...decks.filter((deck) => !deck.isPublic), ...localDecks]
      : decks.filter((deck) => deck.isPublic);

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
        {privateDecks.map((deck) => (
          <Button
            key={deck.id || deck.title}
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
            <span className="flex items-center">
              {deck.title}
              {deck.isLocal && (
                <span className="ml-2 text-xs text-neutral-500">(Local)</span>
              )}
              {deck.syncStatus === "syncing" && (
                <svg
                  className="animate-spin h-4 w-4 ml-2"
                  fill="none"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    fill="currentColor"
                  />
                </svg>
              )}
            </span>
          </Button>
        ))}
      </div>

      <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-neutral-200 bg-white space-y-2">
        <Button
          className="w-full bg-primary-600 hover:bg-primary-700 text-white"
          onPress={() => {}}
        >
          Add Deck
        </Button>
        {user ? (
          <Button
            className="w-full bg-neutral-200 hover:bg-neutral-300 text-neutral-700"
            onPress={signOut}
          >
            Sign Out
          </Button>
        ) : (
          <Button
            className="w-full bg-neutral-200 hover:bg-neutral-300 text-neutral-700"
            onPress={() => setShowAuthModal(true)}
          >
            Sign In to Sync
          </Button>
        )}
      </div>

      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
      />
    </div>
  );
}
