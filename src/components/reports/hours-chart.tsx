"use client";

import { useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Line,
  ComposedChart,
} from "recharts";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { HoursRow } from "@/hooks/use-reports";
import { downloadCSV } from "./csv-export";

function shortLabel(period: string, groupBy: string) {
  const d = new Date(period + "T00:00:00");
  if (groupBy === "day") return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  if (groupBy === "week")
    return `W ${d.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;
  return d.toLocaleDateString(undefined, { month: "short", year: "2-digit" });
}

export function HoursByGoalChart({ data, groupBy }: { data: HoursRow[]; groupBy: string }) {
  const { chartData, goalKeys } = useMemo(() => {
    const goalMap = new Map<string, { title: string; colour: string }>();
    for (const row of data) {
      for (const g of row.byGoal) {
        if (!goalMap.has(g.id)) goalMap.set(g.id, { title: g.title, colour: g.colour });
      }
    }
    const keys = Array.from(goalMap.entries());
    const cd = data.map((row) => {
      const entry: Record<string, string | number> = {
        period: shortLabel(row.period, groupBy),
        total: row.total,
      };
      for (const [id] of keys) {
        const found = row.byGoal.find((g) => g.id === id);
        entry[id] = found?.hours ?? 0;
      }
      return entry;
    });
    return { chartData: cd, goalKeys: keys };
  }, [data, groupBy]);

  function exportCSV() {
    const headers = ["Period", "Total", ...goalKeys.map(([, g]) => g.title)];
    const rows = data.map((row) => [
      row.period,
      String(row.total),
      ...goalKeys.map(([id]) => String(row.byGoal.find((g) => g.id === id)?.hours ?? 0)),
    ]);
    downloadCSV("hours-by-goal.csv", headers, rows);
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between pb-3">
        <CardTitle className="text-sm">Hours by Goal</CardTitle>
        <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={exportCSV}>
          <Download className="mr-1 h-3.5 w-3.5" /> CSV
        </Button>
      </CardHeader>
      <CardContent>
        {chartData.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">No data for this range.</p>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={chartData}>
              <XAxis dataKey="period" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {goalKeys.map(([id, g]) => (
                <Bar key={id} dataKey={id} name={g.title} stackId="a" fill={g.colour} />
              ))}
              <Line
                type="monotone"
                dataKey="total"
                name="Trend"
                stroke="#666"
                strokeWidth={2}
                dot={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}

export function HoursByCategoryChart({ data, groupBy }: { data: HoursRow[]; groupBy: string }) {
  const { chartData, categoryKeys, colours } = useMemo(() => {
    const catSet = new Set<string>();
    for (const row of data) {
      for (const c of row.byCategory) catSet.add(c.name);
    }
    const keys = Array.from(catSet);
    const palette = ["#6366f1", "#f59e0b", "#10b981", "#ef4444", "#8b5cf6", "#06b6d4", "#ec4899"];
    const cols = Object.fromEntries(keys.map((k, i) => [k, palette[i % palette.length]]));
    const cd = data.map((row) => {
      const entry: Record<string, string | number> = {
        period: shortLabel(row.period, groupBy),
        total: row.total,
      };
      for (const k of keys) {
        const found = row.byCategory.find((c) => c.name === k);
        entry[k] = found?.hours ?? 0;
      }
      return entry;
    });
    return { chartData: cd, categoryKeys: keys, colours: cols };
  }, [data, groupBy]);

  function exportCSV() {
    const headers = ["Period", "Total", ...categoryKeys];
    const rows = data.map((row) => [
      row.period,
      String(row.total),
      ...categoryKeys.map((k) => String(row.byCategory.find((c) => c.name === k)?.hours ?? 0)),
    ]);
    downloadCSV("hours-by-category.csv", headers, rows);
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between pb-3">
        <CardTitle className="text-sm">Hours by Category</CardTitle>
        <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={exportCSV}>
          <Download className="mr-1 h-3.5 w-3.5" /> CSV
        </Button>
      </CardHeader>
      <CardContent>
        {chartData.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">No data for this range.</p>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={chartData}>
              <XAxis dataKey="period" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {categoryKeys.map((k) => (
                <Bar key={k} dataKey={k} name={k} stackId="a" fill={colours[k]} />
              ))}
              <Line
                type="monotone"
                dataKey="total"
                name="Trend"
                stroke="#666"
                strokeWidth={2}
                dot={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
