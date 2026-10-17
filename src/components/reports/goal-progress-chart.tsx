"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { Download, Flame } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { GoalProgressData } from "@/hooks/use-reports";
import { downloadCSV } from "./csv-export";

export function GoalProgressChart({ data }: { data: GoalProgressData }) {
  const chartData = data.goals.map((g) => ({
    name: g.title.length > 20 ? g.title.slice(0, 18) + "..." : g.title,
    progress: g.progress,
    colour: g.colour,
    fullTitle: g.title,
  }));

  function exportCSV() {
    const headers = [
      "Goal",
      "Progress %",
      "Sub-goals Done",
      "Sub-goals Total",
      "Actions Done",
      "Actions Total",
    ];
    const rows = data.goals.map((g) => [
      g.title,
      String(g.progress),
      String(g.subGoals.done),
      String(g.subGoals.total),
      String(g.actions.done),
      String(g.actions.total),
    ]);
    downloadCSV("goal-progress.csv", headers, rows);
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex-row items-center justify-between pb-3">
          <CardTitle className="text-sm">Goal Progress</CardTitle>
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={exportCSV}>
            <Download className="mr-1 h-3.5 w-3.5" /> CSV
          </Button>
        </CardHeader>
        <CardContent>
          {chartData.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">No active goals.</p>
          ) : (
            <ResponsiveContainer width="100%" height={Math.max(200, chartData.length * 50)}>
              <BarChart data={chartData} layout="vertical">
                <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 11 }} />
                <Tooltip
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  formatter={(value: any) => [`${value}%`, "Progress"]}
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  labelFormatter={(label: any) => {
                    const found = chartData.find((d) => d.name === String(label));
                    return found?.fullTitle ?? String(label);
                  }}
                />
                <Bar dataKey="progress" radius={[0, 4, 4, 0]}>
                  {chartData.map((entry, i) => (
                    <Cell key={i} fill={entry.colour} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Streak Card */}
      <Card>
        <CardContent className="flex items-center gap-4 py-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-orange-100 dark:bg-orange-950/50">
            <Flame className="h-6 w-6 text-orange-500" />
          </div>
          <div>
            <p className="text-2xl font-bold">
              {data.streak} day{data.streak !== 1 ? "s" : ""}
            </p>
            <p className="text-xs text-muted-foreground">
              {data.goal1Title
                ? `Streak: consecutive days with "${data.goal1Title}" action`
                : "Set Goal #1 to track your streak"}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
