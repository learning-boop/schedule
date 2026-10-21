"use client";

import { TopBar } from "@/components/top-bar";
import { MonthlyPlanner } from "@/components/monthly/monthly-planner";

export default function MonthPage() {
  return (
    <>
      <TopBar title="Month" />
      <div className="mx-auto w-full max-w-5xl p-4 sm:p-6">
        <MonthlyPlanner />
      </div>
    </>
  );
}
