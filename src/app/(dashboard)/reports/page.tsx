"use client";

import { Suspense, lazy } from "react";
import { TopBar } from "@/components/top-bar";
import { ExportPanel } from "@/components/export/export-dialog";

const ReportsDashboard = lazy(() =>
  import("@/components/reports/reports-dashboard").then((m) => ({ default: m.ReportsDashboard })),
);

export default function ReportsPage() {
  return (
    <>
      <TopBar title="Reports" />
      <div className="mx-auto w-full max-w-4xl p-6 space-y-6">
        <Suspense fallback={<p className="text-sm text-muted-foreground">Loading reports...</p>}>
          <ReportsDashboard />
        </Suspense>
        <ExportPanel />
      </div>
    </>
  );
}
