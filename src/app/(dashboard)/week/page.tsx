"use client";

import { Suspense, lazy } from "react";
import { TopBar } from "@/components/top-bar";
import { WeeklyPlanner } from "@/components/weekly/weekly-planner";
import { useIsMobile } from "@/hooks/use-mobile";

const ScheduleCalendar = lazy(() =>
  import("@/components/calendar/schedule-calendar").then((m) => ({ default: m.ScheduleCalendar })),
);

export default function WeekPage() {
  const isMobile = useIsMobile();

  return (
    <>
      <TopBar title="Week" />
      {isMobile ? (
        <div className="flex flex-col">
          <div className="p-4">
            <Suspense fallback={<p className="text-muted-foreground">Loading calendar...</p>}>
              <ScheduleCalendar initialView="timeGridWeek" />
            </Suspense>
          </div>
          <div className="border-t p-4">
            <WeeklyPlanner />
          </div>
        </div>
      ) : (
        <div className="flex">
          <div className="flex-1 p-4">
            <Suspense fallback={<p className="text-muted-foreground">Loading calendar...</p>}>
              <ScheduleCalendar initialView="timeGridWeek" />
            </Suspense>
          </div>
          <div
            className="w-96 shrink-0 border-l overflow-y-auto p-4"
            style={{ maxHeight: "calc(100vh - 3.5rem)" }}
          >
            <WeeklyPlanner />
          </div>
        </div>
      )}
    </>
  );
}
