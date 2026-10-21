"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useWeeklyPlan, type WeekGoal, type WeekSlot } from "@/hooks/use-weekly-plan";
import { getWeekStart, formatDate, parseLocalDate, DAY_NAMES } from "@/lib/date-utils";

function CreatePlanForm({
  carryOver,
  onCreate,
}: {
  carryOver: WeekGoal[];
  onCreate: (goals: WeekGoal[], quote: string) => void;
}) {
  const [goals, setGoals] = useState<WeekGoal[]>(carryOver.length > 0 ? carryOver : []);
  const [newGoal, setNewGoal] = useState("");
  const [quote, setQuote] = useState("");

  function addGoal(e: React.FormEvent) {
    e.preventDefault();
    if (!newGoal.trim()) return;
    setGoals([...goals, { text: newGoal.trim(), done: false }]);
    setNewGoal("");
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Create Weekly Plan</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {carryOver.length > 0 && (
          <p className="text-xs text-amber-600">
            {carryOver.length} unfinished goal(s) carried over from last week.
          </p>
        )}

        <div className="space-y-2">
          <p className="text-sm font-medium">Week Goals</p>
          {goals.map((g, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="flex-1 text-sm">{g.text}</span>
              <button
                onClick={() => setGoals(goals.filter((_, idx) => idx !== i))}
                className="text-muted-foreground hover:text-destructive"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
          <form onSubmit={addGoal} className="flex gap-2">
            <Input
              placeholder="Add a goal..."
              value={newGoal}
              onChange={(e) => setNewGoal(e.target.value)}
              className="h-8 text-sm"
            />
            <Button type="submit" size="sm" variant="ghost" className="h-8">
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </form>
        </div>

        <div>
          <p className="text-sm font-medium mb-1">Quote of the week</p>
          <Input
            placeholder="An inspiring quote..."
            value={quote}
            onChange={(e) => setQuote(e.target.value)}
            className="text-sm"
          />
        </div>

        <Button
          onClick={() => onCreate(goals, quote)}
          disabled={goals.length === 0}
          className="w-full"
        >
          Create Plan
        </Button>
      </CardContent>
    </Card>
  );
}

function SlotGrid({
  slots,
  weekStart,
  onSlotsChange,
}: {
  slots: WeekSlot[];
  weekStart: string;
  onSlotsChange: (slots: WeekSlot[]) => void;
}) {
  const [editingSlot, setEditingSlot] = useState<{ day: number; index: number } | null>(null);
  const [editText, setEditText] = useState("");

  function getSlot(day: number, index: number) {
    return slots.find((s) => s.day === day && s.index === index);
  }

  function setSlot(day: number, index: number, text: string) {
    const filtered = slots.filter((s) => !(s.day === day && s.index === index));
    if (text.trim()) {
      filtered.push({ day, index, text: text.trim() });
    }
    onSlotsChange(filtered);
    setEditingSlot(null);
  }

  function handleDragStart(e: React.DragEvent, slot: WeekSlot) {
    const weekDate = parseLocalDate(weekStart);
    weekDate.setDate(weekDate.getDate() + slot.day);
    e.dataTransfer.setData(
      "text/plain",
      JSON.stringify({ type: "weekSlot", title: slot.text, date: formatDate(weekDate) }),
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr>
            <th className="w-8 p-1 text-xs text-muted-foreground">#</th>
            {DAY_NAMES.map((d, i) => (
              <th key={i} className="p-1 text-xs font-medium">
                {d}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: 5 }, (_, slotIdx) => (
            <tr key={slotIdx}>
              <td className="p-1 text-xs text-muted-foreground text-center">{slotIdx + 1}</td>
              {Array.from({ length: 7 }, (_, dayIdx) => {
                const slot = getSlot(dayIdx, slotIdx);
                const isEditing = editingSlot?.day === dayIdx && editingSlot?.index === slotIdx;

                return (
                  <td key={dayIdx} className="p-0.5">
                    {isEditing ? (
                      <Input
                        autoFocus
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        onBlur={() => setSlot(dayIdx, slotIdx, editText)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") setSlot(dayIdx, slotIdx, editText);
                          if (e.key === "Escape") setEditingSlot(null);
                        }}
                        className="h-7 text-xs"
                      />
                    ) : (
                      <button
                        className="w-full min-h-[1.75rem] rounded border border-dashed px-1 py-0.5 text-left text-xs hover:bg-accent"
                        onClick={() => {
                          setEditingSlot({ day: dayIdx, index: slotIdx });
                          setEditText(slot?.text || "");
                        }}
                        draggable={!!slot}
                        onDragStart={(e) => slot && handleDragStart(e, slot)}
                      >
                        {slot?.text || ""}
                      </button>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function WeeklyPlanner() {
  const [weekStart, setWeekStart] = useState("");
  const { plan, carryOver, review, loading, save, createPlan } = useWeeklyPlan(weekStart);

  useEffect(() => {
    setWeekStart(formatDate(getWeekStart(new Date())));
  }, []);

  function goWeek(offset: number) {
    const d = parseLocalDate(weekStart);
    d.setDate(d.getDate() + offset * 7);
    setWeekStart(formatDate(d));
  }

  function goThisWeek() {
    setWeekStart(formatDate(getWeekStart(new Date())));
  }

  if (!weekStart || loading) {
    return <p className="text-sm text-muted-foreground">Loading...</p>;
  }

  const weekEnd = parseLocalDate(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);
  const weekLabel = `${new Date(weekStart + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" })} – ${weekEnd.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`;

  const isThisWeek = weekStart === formatDate(getWeekStart(new Date()));

  return (
    <div className="space-y-6">
      {/* Navigation */}
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => goWeek(-1)}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="flex-1 text-center text-sm font-medium">{weekLabel}</span>
        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => goWeek(1)}>
          <ChevronRight className="h-4 w-4" />
        </Button>
        {!isThisWeek && (
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={goThisWeek}>
            This Week
          </Button>
        )}
      </div>

      {/* No plan yet */}
      {!plan && <CreatePlanForm carryOver={carryOver} onCreate={createPlan} />}

      {/* Plan exists */}
      {plan && (
        <>
          {/* Quote */}
          {plan.quote && (
            <blockquote className="border-l-2 pl-3 text-sm italic text-muted-foreground">
              {plan.quote}
            </blockquote>
          )}

          {/* Goals */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Week Goals</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {(plan.goals as { text: string; done: boolean }[]).map((g, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={g.done}
                    onChange={() => {
                      const updated = [...(plan.goals as { text: string; done: boolean }[])];
                      updated[i] = { ...updated[i], done: !updated[i].done };
                      save({ goals: updated });
                    }}
                    className="h-4 w-4 rounded"
                  />
                  <span className={`text-sm ${g.done ? "text-muted-foreground line-through" : ""}`}>
                    {g.text}
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Slot Grid */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Day Slots (drag to calendar)</CardTitle>
            </CardHeader>
            <CardContent>
              <SlotGrid
                slots={(plan.slots as WeekSlot[]) || []}
                weekStart={weekStart}
                onSlotsChange={(slots) => save({ slots })}
              />
            </CardContent>
          </Card>

          {/* Review */}
          {review && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Week Review</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <p className="text-2xl font-bold">{review.hoursWorked}h</p>
                    <p className="text-xs text-muted-foreground">Hours worked</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold">
                      {review.doneBlocks}/{review.totalBlocks}
                    </p>
                    <p className="text-xs text-muted-foreground">Blocks done</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold">
                      {review.doneGoals}/{review.plannedGoals}
                    </p>
                    <p className="text-xs text-muted-foreground">Goals done</p>
                  </div>
                </div>
                {review.plannedGoals > 0 && (
                  <Progress
                    value={Math.round((review.doneGoals / review.plannedGoals) * 100)}
                    className="h-2"
                  />
                )}
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
