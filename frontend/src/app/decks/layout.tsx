"use client";

import { MainLayoutSidebar } from "@/components/Layouts/MainLayoutSidebar";

export default function DecksLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-neutral-50">
      <MainLayoutSidebar />
      {children}
    </div>
  );
}
