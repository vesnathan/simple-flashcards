"use client";

import { MainLayout } from "@/components/Layouts/MainLayout";
import { DeckView } from "@/components/decks/DeckView";

export default function HomePage() {
  return (
    <MainLayout>
      <DeckView />
    </MainLayout>
  );
}
