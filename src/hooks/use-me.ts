"use client";

import { useEffect, useState } from "react";

export type Me = {
  id: string;
  name: string;
  email: string;
  role: "employee" | "manager" | "founder";
  team_id: string | null;
  org: {
    id: string;
    name: string;
    work_days: number[];
    work_start: number;
    work_end: number;
  } | null;
};

let cached: Promise<Me | null> | null = null;

function load(): Promise<Me | null> {
  cached ??= fetch("/api/me")
    .then((r) => (r.ok ? (r.json() as Promise<Me>) : null))
    .catch(() => null)
    .then((me) => {
      if (!me) cached = null; // try again next time
      return me;
    });
  return cached;
}

/** Forget the cached profile (after joining or creating a company) */
export function refreshMe() {
  cached = null;
}

/** The signed-in person and their company; undefined while loading, null if unavailable */
export function useMe(): Me | null | undefined {
  const [me, setMe] = useState<Me | null | undefined>(undefined);
  useEffect(() => {
    let alive = true;
    load().then((m) => {
      if (alive) setMe(m);
    });
    return () => {
      alive = false;
    };
  }, []);
  return me;
}
