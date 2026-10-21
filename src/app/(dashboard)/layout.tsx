"use client";

import { Suspense, lazy } from "react";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";

// FullCalendar v7 does not inject its own CSS: the layout skeleton and a theme
// must be imported, otherwise calendars render as plain rows of text.
import "@fullcalendar/react/skeleton.css";
import "@fullcalendar/react/themes/monarch/theme.css";
import "@fullcalendar/react/themes/monarch/palettes/blue.css";

const AppSidebar = lazy(() =>
  import("@/components/app-sidebar").then((m) => ({ default: m.AppSidebar })),
);

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <Suspense fallback={<div className="w-64 shrink-0" />}>
        <AppSidebar />
      </Suspense>
      {/* min-w-0: wide calendars scroll inside the page instead of stretching it */}
      <SidebarInset className="min-w-0">{children}</SidebarInset>
    </SidebarProvider>
  );
}
