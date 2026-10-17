"use client";

import { useCallback, useEffect, useState } from "react";

export type SubGoal = {
  id: string;
  goal_id: string;
  title: string;
  deadline: string | null;
  done: boolean;
};

export type Action = {
  id: string;
  goal_id: string;
  title: string;
  done: boolean;
  order: number;
};

export type Goal = {
  id: string;
  user_id: string;
  title: string;
  rank: number;
  deadline: string | null;
  colour: string;
  status: string;
  sub_goals: SubGoal[];
  actions: Action[];
};

export function useGoals() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchGoals = useCallback(async () => {
    const res = await fetch("/api/goals");
    if (res.ok) {
      const data = await res.json();
      setGoals(data);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchGoals();
  }, [fetchGoals]);

  return { goals, loading, refetch: fetchGoals, setGoals };
}
