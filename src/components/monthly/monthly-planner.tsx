"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useMonthlyPlan, type MonthActivity, type Swot } from "@/hooks/use-monthly-plan";
import { getMonthStart, formatDate } from "@/lib/date-utils";
import { buildMonthGrid, dayKey, monthMeta, WEEKDAY_NAMES } from "@/lib/month-grid";
import { cn } from "@/lib/utils";

const SWOT_BOXES: { key: keyof Swot; label: string }[] = [
  { key: "strengths", label: "Strength" },
  { key: "weaknesses", label: "Weakness" },
  { key: "opportunities", label: "Opportunities" },
  { key: "threats", label: "Threats" },
];

function SwotGrid({ swot, onChange }: { swot: Swot; onChange: (swot: Swot) => void }) {
  return (
    <div className="grid grid-cols-1 overflow-hidden rounded-lg border sm:grid-cols-2">
      {SWOT_BOXES.map((b, i) => (
        <div
          key={b.key}
          className={cn(
            "flex flex-col",
            i % 2 === 1 && "sm:border-l",
            i >= 2 && "border-t",
            i === 1 && "border-t sm:border-t-0",
          )}
        >
          <p className="border-b bg-muted/40 py-1.5 text-center text-sm font-semibold">{b.label}</p>
          <Textarea
            value={swot[b.key]}
            onChange={(e) => onChange({ ...swot, [b.key]: e.target.value })}
            placeholder={`${b.label}…`}
            rows={5}
            className="min-h-[7.5rem] resize-none rounded-none border-0 text-sm shadow-none focus-visible:ring-0"
          />
        </div>
      ))}
    </div>
  );
}

/** Workbook "Date and Day" grid: Week 1–5 columns × Monday–Sunday rows */
function DateAndDayGrid({
  month,
  dayPlans,
  activity,
  today,
  onChange,
}: {
  month: string;
  dayPlans: Record<string, string>;
  activity: MonthActivity;
  today: string;
  onChange: (day: number, text: string) => void;
}) {
  const { weeksNeeded } = monthMeta(month);
  const columns: 5 | 6 = weeksNeeded > 5 ? 6 : 5;
  const grid = useMemo(() => buildMonthGrid(month, columns), [month, columns]);

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] table-fixed border-collapse text-sm">
        <colgroup>
          <col className="w-28" />
          {Array.from({ length: columns }, (_, i) => (
            <col key={i} />
          ))}
        </colgroup>
        <thead>
          <tr>
            <th className="border bg-muted/40 px-2 py-2 text-left text-xs font-semibold">
              Date and Day
            </th>
            {Array.from({ length: columns }, (_, i) => (
              <th key={i} className="border bg-muted/40 px-2 py-2 text-left text-xs font-semibold">
                Week {i + 1}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {WEEKDAY_NAMES.map((name, row) => (
            <tr key={name}>
              <th className="border px-2 py-2 text-left align-top text-xs font-semibold">{name}</th>
              {grid[row].map((cell, col) => {
                if (!cell) {
                  return (
                    <td
                      key={col}
                      className="border bg-[repeating-linear-gradient(135deg,transparent,transparent_6px,rgba(0,0,0,0.03)_6px,rgba(0,0,0,0.03)_12px)]"
                    />
                  );
                }
                const key = dayKey(month, cell.day);
                const act = activity[key];
                const isToday = key === today;
                const ratio = act && act.totalCount > 0 ? act.doneCount / act.totalCount : 0;
                return (
                  <td
                    key={col}
                    className={cn(
                      "group relative border p-0 align-top",
                      isToday && "outline outline-2 -outline-offset-2 outline-[#1a73e8]",
                    )}
                  >
                    <div className="flex items-center justify-between px-1.5 pt-1">
                      <span
                        className={cn(
                          "inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[11px] font-semibold",
                          isToday ? "bg-[#1a73e8] text-white" : "text-muted-foreground",
                        )}
                      >
                        {cell.day}
                      </span>
                      {act && act.hours > 0 && (
                        <span
                          className={cn(
                            "rounded px-1 text-[10px] font-medium tabular-nums",
                            ratio >= 0.8
                              ? "bg-green-100 text-green-800"
                              : ratio >= 0.5
                                ? "bg-amber-100 text-amber-800"
                                : "bg-red-100 text-red-800",
                          )}
                          title={`${act.doneCount} of ${act.totalCount} blocks done`}
                        >
                          {act.hours}h
                        </span>
                      )}
                    </div>
                    <textarea
                      aria-label={`Plan for ${name} ${cell.day}`}
                      value={dayPlans[String(cell.day)] ?? ""}
                      onChange={(e) => onChange(cell.day, e.target.value)}
                      placeholder="Plan…"
                      rows={2}
                      maxLength={300}
                      className="block min-h-[3.25rem] w-full resize-none bg-transparent px-1.5 pb-1 text-xs leading-snug outline-none placeholder:text-muted-foreground/0 focus:placeholder:text-muted-foreground/60 group-hover:placeholder:text-muted-foreground/40"
                    />
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 text-xs text-muted-foreground">
        Write the plan for each day. The badge shows hours logged from completed calendar blocks
        (green ≥ 80% of blocks done, amber ≥ 50%, red below).
      </p>
    </div>
  );
}

export function MonthlyPlanner() {
  const [month, setMonth] = useState("");
  const [today, setToday] = useState("");
  const { plan, activity, loading, save } = useMonthlyPlan(month);
  const [newGoal, setNewGoal] = useState("");

  useEffect(() => {
    setMonth(formatDate(getMonthStart(new Date())));
    setToday(formatDate(new Date()));
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

  function setDayPlan(day: number, text: string) {
    if (!plan) return;
    const next = { ...plan.day_plans };
    if (text) next[String(day)] = text;
    else delete next[String(day)];
    save({ day_plans: next });
  }

  return (
    <div className="space-y-6">
      {/* Navigation */}
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => goMonth(-1)}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="flex-1 text-center text-sm font-medium">Month: {monthLabel}</span>
        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => goMonth(1)}>
          <ChevronRight className="h-4 w-4" />
        </Button>
        {!isThisMonth && (
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={goThisMonth}>
            This Month
          </Button>
        )}
      </div>

      {/* This month Goal — Top 3 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">This month Goal · Top 3 goals for this month</CardTitle>
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
                aria-label={`Remove goal ${i + 1}`}
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

      {/* Date and Day grid (workbook page 5) */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Date and Day</CardTitle>
        </CardHeader>
        <CardContent>
          <DateAndDayGrid
            month={month}
            dayPlans={plan.day_plans}
            activity={activity}
            today={today}
            onChange={setDayPlan}
          />
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

      {/* SWOT (workbook page) */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">SWOT</CardTitle>
        </CardHeader>
        <CardContent>
          <SwotGrid swot={plan.swot} onChange={(swot) => save({ swot })} />
        </CardContent>
      </Card>
    </div>
  );
}
