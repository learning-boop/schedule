"use client";

import { Suspense, lazy } from "react";

const ColleagueSchedule = lazy(() =>
  import("@/components/team/colleague-schedule").then((m) => ({ default: m.ColleagueSchedule })),
);

export default function ColleagueSchedulePage() {
  return (
    <Suspense fallback={<p className="p-6 text-sm text-muted-foreground">Loading...</p>}>
      <ColleagueSchedule />
    </Suspense>
  );
}
