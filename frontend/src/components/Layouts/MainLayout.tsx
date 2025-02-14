"use client";

import React, { PropsWithChildren } from "react";
import { cn } from "@heroui/theme";

import { MainLayoutSidebar } from "./MainLayoutSidebar";

export interface MainLayoutProps extends PropsWithChildren {}

export const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
  return (
    <>
      <MainLayoutSidebar
        decks={[
          {
            title: "Deck 1",
            cards: [
              {
                id: 0,
                question: "What is the capital of France?",
                answer: "Paris",
              },
              {
                id: 1,
                question: "What is the capital of Spain?",
                answer: "Madrid",
              },
              {
                id: 2,
                question: "What is the capital of Italy?",
                answer: "Rome",
              },
            ],
          },
          {
            title: "Deck 2",
            cards: [
              {
                id: 0,
                question: "What is the capital of Germany?",
                answer: "Berlin",
              },
              {
                id: 1,
                question: "What is the capital of the UK?",
                answer: "London",
              },
              {
                id: 2,
                question: "What is the capital of the USA?",
                answer: "Washington D.C.",
              },
            ],
          },
        ]}
      />

      <div
        className={cn("bg-neutral-100", "w-full min-h-dvh", "flex flex-col")}
        data-testid="main-container"
      >
        {children}
      </div>
    </>
  );
};
