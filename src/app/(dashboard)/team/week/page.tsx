"use client";

import { Suspense, lazy } from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { TopBar } from "@/components/top-bar";
import { Button } from "@/components/ui/button";

const TeamSchedule = lazy(() =>
  import("@/components/team/team-schedule").then((m) => ({ default: m.TeamSchedule })),
);

export default function TeamCalendarPage() {
  return (
    <>
      <TopBar title="Team calendar" />
      <div className="space-y-3 p-4 sm:p-6">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1 text-xs"
          nativeButton={false}
          render={<Link href="/team" />}
        >
          <ChevronLeft className="h-3.5 w-3.5" /> Team
        </Button>
        <Suspense fallback={<p className="text-sm text-muted-foreground">Loading calendar...</p>}>
          <TeamSchedule />
        </Suspense>
      </div>
    </>
  );
}
