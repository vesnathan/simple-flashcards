"use client";

import React, { PropsWithChildren, useState, useEffect } from "react";
import { cn } from "@heroui/theme";

import { Deck } from "../../../../types/deck";
import { Toast } from "../Toast";

import { MainLayoutSidebar } from "./MainLayoutSidebar";

import { useAuthStore } from "@/stores/authStore";

export interface MainLayoutProps extends PropsWithChildren {
  decks: Deck[];
}

export const MainLayout: React.FC<MainLayoutProps> = ({ children, decks }) => {
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error" | "info";
  } | null>(null);

  useEffect(() => {
    const unsubscribe = useAuthStore.subscribe(
      (state: any) => state.showToast,
      (showToast) => {
        if (showToast) {
          setToast({ message: showToast.message, type: showToast.type });
        }
      },
    );

    return () => unsubscribe();
  }, []);

  return (
    <>
      <MainLayoutSidebar decks={decks} />
      <div
        className={cn("bg-neutral-100", "w-full min-h-dvh", "flex flex-col")}
        data-testid="main-container"
      >
        {children}
      </div>
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </>
  );
};
