"use client";

import { useCallback, useEffect, useState } from "react";

export type HoursRow = {
  period: string;
  total: number;
  byGoal: { id: string; title: string; colour: string; hours: number }[];
  byCategory: { name: string; hours: number }[];
};

export type PlannedVsActualRow = {
  week: string;
  planned: number;
  actual: number;
};

export type GoalProgressData = {
  goals: {
    id: string;
    title: string;
    colour: string;
    rank: number;
    progress: number;
    subGoals: { total: number; done: number };
    actions: { total: number; done: number };
  }[];
  streak: number;
  goal1Title: string | null;
};

export function useReports(start: string, end: string) {
  const [hours, setHours] = useState<HoursRow[]>([]);
  const [plannedVsActual, setPlannedVsActual] = useState<PlannedVsActualRow[]>([]);
  const [goalProgress, setGoalProgress] = useState<GoalProgressData | null>(null);
  const [groupBy, setGroupBy] = useState<"day" | "week" | "month">("day");
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    if (!start || !end) return;
    setLoading(true);

    const [hRes, pRes, gRes] = await Promise.all([
      fetch(`/api/reports/hours?start=${start}&end=${end}&groupBy=${groupBy}`),
      fetch(`/api/reports/planned-vs-actual?start=${start}&end=${end}`),
      fetch(`/api/reports/goal-progress?start=${start}&end=${end}`),
    ]);

    if (hRes.ok) setHours(await hRes.json());
    if (pRes.ok) setPlannedVsActual(await pRes.json());
    if (gRes.ok) setGoalProgress(await gRes.json());

    setLoading(false);
  }, [start, end, groupBy]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  return { hours, plannedVsActual, goalProgress, groupBy, setGroupBy, loading };
}
