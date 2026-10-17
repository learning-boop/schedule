"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type Swot = {
  strengths: string;
  weaknesses: string;
  opportunities: string;
  threats: string;
};

export type MonthlyPlan = {
  id: string;
  user_id: string;
  month: string;
  top3: string[];
  focus: string | null;
  swot: Swot;
};

export type MonthGrid = Record<string, { hours: number; doneCount: number; totalCount: number }>;

const DEFAULT_SWOT: Swot = { strengths: "", weaknesses: "", opportunities: "", threats: "" };

export function useMonthlyPlan(month: string) {
  const [plan, setPlan] = useState<MonthlyPlan | null>(null);
  const [grid, setGrid] = useState<MonthGrid>({});
  const [loading, setLoading] = useState(true);
  const saveTimer = useRef<ReturnType<typeof setTimeout>>(null);

  const fetchPlan = useCallback(async () => {
    if (!month) return;
    setLoading(true);
    const [planRes, gridRes] = await Promise.all([
      fetch(`/api/monthly-plans?month=${month}`),
      fetch(`/api/monthly-plans/grid?month=${month}`),
    ]);

    if (planRes.ok) {
      const data = await planRes.json();
      setPlan({
        ...data,
        top3: Array.isArray(data.top3) ? data.top3 : [],
        swot:
          data.swot && typeof data.swot === "object"
            ? { ...DEFAULT_SWOT, ...data.swot }
            : DEFAULT_SWOT,
      });
    }
    if (gridRes.ok) {
      setGrid(await gridRes.json());
    }
    setLoading(false);
  }, [month]);

  useEffect(() => {
    fetchPlan();
  }, [fetchPlan]);

  const save = useCallback(
    (updates: Partial<Pick<MonthlyPlan, "top3" | "focus" | "swot">>) => {
      setPlan((prev) => (prev ? { ...prev, ...updates } : prev));

      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(async () => {
        await fetch("/api/monthly-plans", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ month, ...updates }),
        });
      }, 500);
    },
    [month],
  );

  return { plan, grid, loading, save };
}
