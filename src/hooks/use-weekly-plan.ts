"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type WeekGoal = { text: string; done: boolean };
export type WeekSlot = { day: number; index: number; text: string };

export type WeeklyPlan = {
  id: string;
  user_id: string;
  week_start: string;
  goals: WeekGoal[];
  quote: string | null;
  slots: WeekSlot[];
};

export type WeekReview = {
  totalBlocks: number;
  doneBlocks: number;
  hoursWorked: number;
  plannedGoals: number;
  doneGoals: number;
};

export function useWeeklyPlan(weekStart: string) {
  const [plan, setPlan] = useState<WeeklyPlan | null>(null);
  const [carryOver, setCarryOver] = useState<WeekGoal[]>([]);
  const [review, setReview] = useState<WeekReview | null>(null);
  const [loading, setLoading] = useState(true);
  const saveTimer = useRef<ReturnType<typeof setTimeout>>(null);

  const fetchPlan = useCallback(async () => {
    if (!weekStart) return;
    setLoading(true);
    const [planRes, reviewRes] = await Promise.all([
      fetch(`/api/weekly-plans?weekStart=${weekStart}`),
      fetch(`/api/weekly-plans/review?weekStart=${weekStart}`),
    ]);

    if (planRes.ok) {
      const data = await planRes.json();
      setPlan(data.plan);
      setCarryOver(data.carryOver || []);
    }
    if (reviewRes.ok) {
      setReview(await reviewRes.json());
    }
    setLoading(false);
  }, [weekStart]);

  useEffect(() => {
    fetchPlan();
  }, [fetchPlan]);

  const save = useCallback(
    (updates: Partial<Pick<WeeklyPlan, "goals" | "quote" | "slots">>) => {
      setPlan((prev) => (prev ? { ...prev, ...updates } : prev));

      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(async () => {
        await fetch("/api/weekly-plans", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ weekStart, ...updates }),
        });
      }, 500);
    },
    [weekStart],
  );

  const createPlan = useCallback(
    async (goals: WeekGoal[], quote: string) => {
      const res = await fetch("/api/weekly-plans", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weekStart, goals, quote, slots: [] }),
      });
      if (res.ok) {
        const data = await res.json();
        setPlan(data);
        setCarryOver([]);
      }
    },
    [weekStart],
  );

  return { plan, carryOver, review, loading, save, createPlan, refetch: fetchPlan };
}
