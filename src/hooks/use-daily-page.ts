"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type Top3Item = {
  id: string;
  text: string;
  done: boolean;
  goalId?: string;
  actionId?: string;
};

export type Matrix = {
  urgent_important: string[];
  urgent_not: string[];
  not_urgent_important: string[];
  not_urgent_not: string[];
};

export type DailyPage = {
  id: string;
  user_id: string;
  date: string;
  top3: Top3Item[];
  matrix: Matrix;
  water: number;
  fitness: string | null;
  notes: string | null;
};

const DEFAULT_MATRIX: Matrix = {
  urgent_important: [],
  urgent_not: [],
  not_urgent_important: [],
  not_urgent_not: [],
};

export function useDailyPage(date: string) {
  const [page, setPage] = useState<DailyPage | null>(null);
  const [loading, setLoading] = useState(true);
  const saveTimer = useRef<ReturnType<typeof setTimeout>>(null);

  const fetchPage = useCallback(async () => {
    if (!date) return;
    setLoading(true);
    const res = await fetch(`/api/daily-pages?date=${date}`);
    if (res.ok) {
      const data = await res.json();
      setPage({
        ...data,
        top3: Array.isArray(data.top3) ? data.top3 : [],
        matrix:
          data.matrix && typeof data.matrix === "object"
            ? { ...DEFAULT_MATRIX, ...data.matrix }
            : DEFAULT_MATRIX,
      });
    }
    setLoading(false);
  }, [date]);

  useEffect(() => {
    fetchPage();
  }, [fetchPage]);

  const save = useCallback(
    (updates: Partial<DailyPage>) => {
      setPage((prev) => (prev ? { ...prev, ...updates } : prev));

      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(async () => {
        await fetch("/api/daily-pages", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ date, ...updates }),
        });
      }, 500);
    },
    [date],
  );

  return { page, loading, save, refetch: fetchPage };
}
