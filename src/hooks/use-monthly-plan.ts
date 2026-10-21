"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getBrowserTimeZone } from "@/lib/date-utils";

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
  /** Workbook "Date and Day" grid: { "<day of month>": "plan" } */
  day_plans: Record<string, string>;
};

/** Hours logged per day (from completed time blocks), keyed YYYY-MM-DD */
export type MonthActivity = Record<
  string,
  { hours: number; doneCount: number; totalCount: number }
>;

type Editable = Partial<Pick<MonthlyPlan, "top3" | "focus" | "swot" | "day_plans">>;

const DEFAULT_SWOT: Swot = { strengths: "", weaknesses: "", opportunities: "", threats: "" };

export function useMonthlyPlan(month: string) {
  const [plan, setPlan] = useState<MonthlyPlan | null>(null);
  const [activity, setActivity] = useState<MonthActivity>({});
  const [loading, setLoading] = useState(true);
  const saveTimer = useRef<ReturnType<typeof setTimeout>>(null);
  // Changes waiting to be saved — merged so quick successive edits aren't lost
  const pending = useRef<Editable>({});

  const fetchPlan = useCallback(async () => {
    if (!month) return;
    setLoading(true);
    const [planRes, gridRes] = await Promise.all([
      fetch(`/api/monthly-plans?month=${month}`),
      fetch(
        `/api/monthly-plans/grid?month=${month}&tz=${encodeURIComponent(getBrowserTimeZone())}`,
      ),
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
        day_plans:
          data.day_plans && typeof data.day_plans === "object" && !Array.isArray(data.day_plans)
            ? data.day_plans
            : {},
      });
    }
    if (gridRes.ok) {
      setActivity(await gridRes.json());
    }
    setLoading(false);
  }, [month]);

  useEffect(() => {
    fetchPlan();
  }, [fetchPlan]);

  // Leaving this month (or the page): save anything still waiting
  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      const body = pending.current;
      if (month && Object.keys(body).length > 0) {
        pending.current = {};
        fetch("/api/monthly-plans", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ month, ...body }),
          keepalive: true,
        });
      }
    };
  }, [month]);

  const save = useCallback(
    (updates: Editable) => {
      setPlan((prev) => (prev ? { ...prev, ...updates } : prev));
      pending.current = { ...pending.current, ...updates };

      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(async () => {
        const body = pending.current;
        pending.current = {};
        await fetch("/api/monthly-plans", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ month, ...body }),
        });
      }, 500);
    },
    [month],
  );

  return { plan, activity, loading, save };
}
