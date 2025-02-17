"use client";

import { useEffect } from "react";

import { MainLayoutSidebar } from "@/components/Layouts/MainLayoutSidebar";
import { useDeckStore } from "@/stores/deckStore";
import { useAuthStore } from "@/stores/authStore";

export default function DecksLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { loadUserDecks, loadPublicDecks } = useDeckStore();
  const { user } = useAuthStore();

  useEffect(() => {
    // Always load public decks
    loadPublicDecks();

    // Only load user decks if authenticated
    if (user) {
      loadUserDecks();
    }
  }, [loadPublicDecks, loadUserDecks, user]);

  return (
    <div className="min-h-screen bg-neutral-50">
      <MainLayoutSidebar />
      {children}
    </div>
  );
}
