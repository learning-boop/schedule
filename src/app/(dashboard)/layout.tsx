"use client";

import { Suspense, lazy } from "react";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";

const AppSidebar = lazy(() =>
  import("@/components/app-sidebar").then((m) => ({ default: m.AppSidebar })),
);

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <Suspense fallback={<div className="w-64 shrink-0" />}>
        <AppSidebar />
      </Suspense>
      <SidebarInset>{children}</SidebarInset>
    </SidebarProvider>
  );
}
