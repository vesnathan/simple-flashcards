"use client";

import React, { PropsWithChildren, useState, useEffect } from "react";
import { cn } from "@heroui/theme";

import { Toast } from "../Toast";

import { MainLayoutSidebar } from "./MainLayoutSidebar";

import { useAuthStore } from "@/stores/authStore";

export interface MainLayoutProps extends PropsWithChildren {
  // No need for decks prop since we use store
}

export const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error" | "info";
  } | null>(null);

  useEffect(() => {
    const unsubscribe = useAuthStore.subscribe((state) => {
      if (state.toastMessage) {
        setToast(state.toastMessage);
      }
    });

    return () => unsubscribe();
  }, []);

  return (
    <>
      <MainLayoutSidebar />
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
