"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { PlannedVsActualRow } from "@/hooks/use-reports";
import { downloadCSV } from "./csv-export";

export function PlannedVsActualChart({ data }: { data: PlannedVsActualRow[] }) {
  const chartData = data.map((r) => ({
    week: new Date(r.week + "T00:00:00").toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    }),
    planned: r.planned,
    actual: r.actual,
  }));

  function exportCSV() {
    const headers = ["Week", "Planned", "Actual"];
    const rows = data.map((r) => [r.week, String(r.planned), String(r.actual)]);
    downloadCSV("planned-vs-actual.csv", headers, rows);
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between pb-3">
        <CardTitle className="text-sm">Planned vs Actual Hours (Weekly)</CardTitle>
        <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={exportCSV}>
          <Download className="mr-1 h-3.5 w-3.5" /> CSV
        </Button>
      </CardHeader>
      <CardContent>
        {chartData.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">No data for this range.</p>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData}>
              <XAxis dataKey="week" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="planned" name="Planned" fill="#94a3b8" />
              <Bar dataKey="actual" name="Actual" fill="#6366f1" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
