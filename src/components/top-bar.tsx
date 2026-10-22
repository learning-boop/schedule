"use client";

import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { NotificationBell } from "@/components/notifications/notification-bell";

export function TopBar({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-2 !h-4" />
      <h1 className="min-w-0 truncate text-sm font-medium">{title}</h1>
      <div className="ml-auto flex items-center gap-1">
        {children}
        <NotificationBell />
      </div>
    </header>
  );
}
