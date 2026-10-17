"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useMonthlyPlan, type Swot } from "@/hooks/use-monthly-plan";
import { getMonthStart, formatDate } from "@/lib/date-utils";

function SwotGrid({ swot, onChange }: { swot: Swot; onChange: (swot: Swot) => void }) {
  const boxes: { key: keyof Swot; label: string; color: string }[] = [
    {
      key: "strengths",
      label: "Strengths",
      color: "bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-900",
    },
    {
      key: "weaknesses",
      label: "Weaknesses",
      color: "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-900",
    },
    {
      key: "opportunities",
      label: "Opportunities",
      color: "bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-900",
    },
    {
      key: "threats",
      label: "Threats",
      color: "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3">
      {boxes.map((b) => (
        <div key={b.key} className={`rounded-lg border p-3 ${b.color}`}>
          <p className="mb-2 text-xs font-semibold">{b.label}</p>
          <Textarea
            value={swot[b.key]}
            onChange={(e) => onChange({ ...swot, [b.key]: e.target.value })}
            placeholder={`${b.label}...`}
            rows={4}
            className="text-xs bg-background/50"
          />
        </div>
      ))}
    </div>
  );
}

function MonthDayGrid({
  month,
  grid,
}: {
  month: string;
  grid: Record<string, { hours: number; doneCount: number; totalCount: number }>;
}) {
  const monthDate = new Date(month + "T00:00:00");
  const year = monthDate.getFullYear();
  const mo = monthDate.getMonth();
  const daysInMonth = new Date(year, mo + 1, 0).getDate();
  const firstDay = (new Date(year, mo, 1).getDay() + 6) % 7; // Mon = 0

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  function getColor(dayNum: number) {
    const key = `${year}-${String(mo + 1).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`;
    const data = grid[key];
    if (!data || data.totalCount === 0) return "bg-muted";
    const ratio = data.doneCount / data.totalCount;
    if (ratio >= 0.8) return "bg-green-400 dark:bg-green-600";
    if (ratio >= 0.5) return "bg-amber-400 dark:bg-amber-600";
    if (ratio > 0) return "bg-red-400 dark:bg-red-600";
    return "bg-muted";
  }

  function getHours(dayNum: number) {
    const key = `${year}-${String(mo + 1).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`;
    return grid[key]?.hours ?? 0;
  }

  return (
    <div>
      <div className="grid grid-cols-7 gap-1 text-center text-xs">
        {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
          <div key={i} className="p-1 font-medium text-muted-foreground">
            {d}
          </div>
        ))}
        {cells.map((day, i) => (
          <div
            key={i}
            className={`rounded p-1 text-center ${day ? getColor(day) : ""}`}
            title={day ? `${getHours(day)}h logged` : undefined}
          >
            {day && (
              <>
                <div className="text-xs font-medium">{day}</div>
                {getHours(day) > 0 && (
                  <div className="text-[10px] text-foreground/70">{getHours(day)}h</div>
                )}
              </>
            )}
          </div>
        ))}
      </div>
      <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded bg-green-400" /> 80%+
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded bg-amber-400" /> 50%+
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded bg-red-400" /> &lt;50%
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded bg-muted" /> None
        </span>
      </div>
    </div>
  );
}

export function MonthlyPlanner() {
  const [month, setMonth] = useState("");
  const { plan, grid, loading, save } = useMonthlyPlan(month);
  const [newGoal, setNewGoal] = useState("");

  useEffect(() => {
    setMonth(formatDate(getMonthStart(new Date())));
  }, []);

  function goMonth(offset: number) {
    const d = new Date(month + "T00:00:00");
    d.setMonth(d.getMonth() + offset);
    setMonth(formatDate(getMonthStart(d)));
  }

  function goThisMonth() {
    setMonth(formatDate(getMonthStart(new Date())));
  }

  if (!month || loading || !plan) {
    return <p className="text-sm text-muted-foreground">Loading...</p>;
  }

  const monthDate = new Date(month + "T00:00:00");
  const monthLabel = monthDate.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  const isThisMonth = month === formatDate(getMonthStart(new Date()));

  function addGoal(e: React.FormEvent) {
    e.preventDefault();
    if (!plan || !newGoal.trim() || plan.top3.length >= 3) return;
    save({ top3: [...plan.top3, newGoal.trim()] });
    setNewGoal("");
  }

  function removeGoal(idx: number) {
    if (!plan) return;
    save({ top3: plan.top3.filter((_, i) => i !== idx) });
  }

  return (
    <div className="space-y-6">
      {/* Navigation */}
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => goMonth(-1)}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="flex-1 text-center text-sm font-medium">{monthLabel}</span>
        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => goMonth(1)}>
          <ChevronRight className="h-4 w-4" />
        </Button>
        {!isThisMonth && (
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={goThisMonth}>
            This Month
          </Button>
        )}
      </div>

      {/* Top 3 Goals */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Top 3 Goals</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {plan.top3.map((g, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                {i + 1}
              </span>
              <span className="flex-1 text-sm">{g}</span>
              <button
                onClick={() => removeGoal(i)}
                className="text-muted-foreground hover:text-destructive"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
          {plan.top3.length < 3 && (
            <form onSubmit={addGoal} className="flex gap-2">
              <Input
                placeholder="Add goal..."
                value={newGoal}
                onChange={(e) => setNewGoal(e.target.value)}
                className="h-8 text-sm"
              />
              <Button type="submit" size="sm" variant="ghost" className="h-8">
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </form>
          )}
        </CardContent>
      </Card>

      {/* Focus */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">This Month&apos;s Focus</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            placeholder="What's the main theme this month?"
            value={plan.focus ?? ""}
            onChange={(e) => save({ focus: e.target.value || null })}
            rows={3}
            className="text-sm"
          />
        </CardContent>
      </Card>

      {/* SWOT */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">SWOT Analysis</CardTitle>
        </CardHeader>
        <CardContent>
          <SwotGrid swot={plan.swot} onChange={(swot) => save({ swot })} />
        </CardContent>
      </Card>

      {/* Month Grid */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Activity Grid</CardTitle>
        </CardHeader>
        <CardContent>
          <MonthDayGrid month={month} grid={grid} />
        </CardContent>
      </Card>
    </div>
  );
}
