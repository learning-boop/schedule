"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { TopBar } from "@/components/top-bar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate, getWeekStart, DAY_NAMES } from "@/lib/date-utils";

type Block = {
  id: string;
  title: string;
  start: string;
  end: string;
  done: boolean;
  category: string | null;
  goal: { title: string; colour: string } | null;
};

type UserWeek = {
  user: { id: string; name: string; role: string };
  blocks: Block[];
};

export default function TeamWeekPage() {
  const [weekStart, setWeekStart] = useState("");
  const [data, setData] = useState<UserWeek[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setWeekStart(formatDate(getWeekStart(new Date())));
  }, []);

  useEffect(() => {
    if (!weekStart) return;
    setLoading(true);
    fetch(`/api/team/week?weekStart=${weekStart}`)
      .then((r) => (r.ok ? r.json() : []))
      .then(setData)
      .finally(() => setLoading(false));
  }, [weekStart]);

  function goWeek(offset: number) {
    const d = new Date(weekStart + "T00:00:00");
    d.setDate(d.getDate() + offset * 7);
    setWeekStart(formatDate(d));
  }

  if (!weekStart) return null;

  const weekEnd = new Date(weekStart + "T00:00:00");
  weekEnd.setDate(weekEnd.getDate() + 6);
  const weekLabel = `${new Date(weekStart + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" })} – ${weekEnd.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`;

  // Build day columns
  const dayDates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart + "T00:00:00");
    d.setDate(d.getDate() + i);
    return formatDate(d);
  });

  return (
    <>
      <TopBar title="Team Week" />
      <div className="p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1 text-xs"
            render={<Link href="/team" />}
          >
            <ChevronLeft className="h-3.5 w-3.5" /> Team
          </Button>
          <div className="flex-1" />
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => goWeek(-1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium">{weekLabel}</span>
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => goWeek(1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {loading && <p className="text-sm text-muted-foreground">Loading...</p>}

        {!loading && (
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse min-w-[700px]">
              <thead>
                <tr>
                  <th className="sticky left-0 bg-background z-10 p-2 text-left font-medium border-b w-28">
                    Person
                  </th>
                  {DAY_NAMES.map((day, i) => (
                    <th key={i} className="p-2 text-center font-medium border-b">
                      {day}
                      <br />
                      <span className="text-[10px] text-muted-foreground font-normal">
                        {new Date(dayDates[i] + "T00:00:00").getDate()}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.map((uw) => (
                  <tr key={uw.user.id} className="border-b">
                    <td className="sticky left-0 bg-background z-10 p-2">
                      <Link href={`/team/${uw.user.id}`} className="hover:underline font-medium">
                        {uw.user.name}
                      </Link>
                    </td>
                    {dayDates.map((dd, i) => {
                      const dayBlocks = uw.blocks.filter((b) => b.start.split("T")[0] === dd);
                      return (
                        <td key={i} className="p-1 align-top border-l">
                          {dayBlocks.map((b) => (
                            <div
                              key={b.id}
                              className={`mb-0.5 rounded px-1 py-0.5 text-[10px] leading-tight ${b.done ? "opacity-60 line-through" : ""}`}
                              style={{
                                background: b.goal?.colour ? b.goal.colour + "20" : "#f1f5f9",
                                borderLeft: `2px solid ${b.goal?.colour ?? "#94a3b8"}`,
                              }}
                            >
                              {b.title}
                            </div>
                          ))}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!loading && data.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8">No team members found.</p>
        )}
      </div>
    </>
  );
}
