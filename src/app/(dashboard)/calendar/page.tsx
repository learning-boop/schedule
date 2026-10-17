"use client";

import { Suspense, lazy } from "react";
import { TopBar } from "@/components/top-bar";
import { DailyPanel } from "@/components/daily/daily-panel";
import { useIsMobile } from "@/hooks/use-mobile";

const ScheduleCalendar = lazy(() =>
  import("@/components/calendar/schedule-calendar").then((m) => ({ default: m.ScheduleCalendar })),
);

export default function CalendarPage() {
  const isMobile = useIsMobile();

  return (
    <>
      <TopBar title="Calendar" />
      {isMobile ? (
        <div className="flex flex-col">
          <div className="p-4">
            <Suspense fallback={<p className="text-muted-foreground">Loading calendar...</p>}>
              <ScheduleCalendar initialView="timeGridDay" />
            </Suspense>
          </div>
          <div className="border-t">
            <DailyPanel />
          </div>
        </div>
      ) : (
        <div className="flex">
          <div className="flex-1 p-4">
            <Suspense fallback={<p className="text-muted-foreground">Loading calendar...</p>}>
              <ScheduleCalendar initialView="timeGridDay" />
            </Suspense>
          </div>
          <div
            className="w-80 shrink-0 border-l overflow-y-auto"
            style={{ maxHeight: "calc(100vh - 3.5rem)" }}
          >
            <DailyPanel />
          </div>
        </div>
      )}
    </>
  );
}
