"use client";

import React, { PropsWithChildren } from "react";
import { cn } from "@heroui/theme";

import { Deck } from "../../../../types/deck";

import { MainLayoutSidebar } from "./MainLayoutSidebar";

export interface MainLayoutProps extends PropsWithChildren {
  decks: Deck[];
}

export const MainLayout: React.FC<MainLayoutProps> = ({ children, decks }) => {
  return (
    <>
      <MainLayoutSidebar decks={decks} />
      <div
        className={cn("bg-neutral-100", "w-full min-h-dvh", "flex flex-col")}
        data-testid="main-container"
      >
        {children}
      </div>
    </>
  );
};
