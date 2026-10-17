"use client";

import { TopBar } from "@/components/top-bar";
import { MonthlyPlanner } from "@/components/monthly/monthly-planner";

export default function MonthPage() {
  return (
    <>
      <TopBar title="Month" />
      <div className="mx-auto w-full max-w-3xl p-6">
        <MonthlyPlanner />
      </div>
    </>
  );
}
