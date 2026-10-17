"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { ChevronLeft, ChevronRight, Clock, CheckCircle } from "lucide-react";
import Link from "next/link";
import { TopBar } from "@/components/top-bar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate } from "@/lib/date-utils";

type Block = {
  id: string;
  title: string;
  start: string;
  end: string;
  done: boolean;
  category: string | null;
  goal: { title: string; colour: string } | null;
};

type ScheduleData = {
  user: { id: string; name: string; role: string };
  blocks: Block[];
  top3: { text: string; done: boolean }[];
  doneToday: { title: string; start: string; end: string }[];
  hoursThisWeek: number;
  goals?: {
    id: string;
    title: string;
    colour: string;
    rank: number;
    sub_goals: { title: string; done: boolean }[];
    actions: { title: string; done: boolean }[];
  }[];
  notes?: string | null;
};

export function ColleagueSchedule() {
  const { userId } = useParams<{ userId: string }>();
  const [date, setDate] = useState("");
  const [data, setData] = useState<ScheduleData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setDate(formatDate(new Date()));
  }, []);

  useEffect(() => {
    if (!date || !userId) return;
    setLoading(true);
    fetch(`/api/team/${userId}/schedule?date=${date}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [date, userId]);

  function goDay(offset: number) {
    const d = new Date(date + "T00:00:00");
    d.setDate(d.getDate() + offset);
    setDate(formatDate(d));
  }

  if (!date) return null;

  const dayLabel = new Date(date + "T00:00:00").toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <>
      <TopBar title={data?.user.name ?? "Colleague"} />
      <div className="mx-auto w-full max-w-3xl p-6 space-y-6">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1 text-xs"
          render={<Link href="/team" />}
        >
          <ChevronLeft className="h-3.5 w-3.5" /> Back to team
        </Button>

        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => goDay(-1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="flex-1 text-center text-sm font-medium">{dayLabel}</span>
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => goDay(1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={() => setDate(formatDate(new Date()))}
          >
            Today
          </Button>
        </div>

        {loading && <p className="text-sm text-muted-foreground">Loading...</p>}

        {!loading && !data && (
          <p className="text-sm text-muted-foreground text-center py-8">
            Not a colleague or no access.
          </p>
        )}

        {data && (
          <>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5 text-sm">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <strong>{data.hoursThisWeek}h</strong>
                <span className="text-muted-foreground">this week</span>
              </div>
              <span className="text-[10px] rounded-full border px-1.5 py-0.5 text-muted-foreground">
                {data.user.role}
              </span>
            </div>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Top 3 Priorities</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1.5">
                {(data.top3 || []).length === 0 && (
                  <p className="text-xs text-muted-foreground">None set</p>
                )}
                {(data.top3 || []).map((item, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                      {i + 1}
                    </span>
                    <span
                      className={`text-sm ${item.done ? "line-through text-muted-foreground" : ""}`}
                    >
                      {item.text}
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Schedule</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1">
                {data.blocks.length === 0 && (
                  <p className="text-xs text-muted-foreground">No blocks scheduled</p>
                )}
                {data.blocks.map((b) => {
                  const start = new Date(b.start);
                  const end = new Date(b.end);
                  const timeStr = `${start.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })} – ${end.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}`;
                  return (
                    <div
                      key={b.id}
                      className={`flex items-center gap-2 rounded-md border p-2 text-sm ${b.done ? "bg-muted/50" : ""}`}
                      style={{ borderLeftWidth: 3, borderLeftColor: b.goal?.colour ?? "#94a3b8" }}
                    >
                      {b.done && <CheckCircle className="h-3.5 w-3.5 text-green-500 shrink-0" />}
                      <div className="flex-1 min-w-0">
                        <p
                          className={`font-medium truncate ${b.done ? "line-through text-muted-foreground" : ""}`}
                        >
                          {b.title}
                        </p>
                        <p className="text-xs text-muted-foreground">{timeStr}</p>
                      </div>
                      {b.goal && (
                        <span className="text-[10px] rounded border px-1 py-0.5 text-muted-foreground">
                          {b.goal.title}
                        </span>
                      )}
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Done Today</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1">
                {data.doneToday.length === 0 && (
                  <p className="text-xs text-muted-foreground">Nothing completed yet</p>
                )}
                {data.doneToday.map((d, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm">
                    <CheckCircle className="h-3.5 w-3.5 text-green-500 shrink-0" />
                    <span>{d.title}</span>
                  </div>
                ))}
              </CardContent>
            </Card>

            {data.goals && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Goals</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {data.goals.map((g) => {
                    const total = g.sub_goals.length + g.actions.length;
                    const done =
                      g.sub_goals.filter((s) => s.done).length +
                      g.actions.filter((a) => a.done).length;
                    const pct = total > 0 ? Math.round((done / total) * 100) : 0;
                    return (
                      <div key={g.id} className="space-y-1">
                        <div className="flex items-center gap-2">
                          <div
                            className="h-2.5 w-2.5 rounded-full"
                            style={{ background: g.colour }}
                          />
                          <span className="text-sm font-medium">{g.title}</span>
                          <span className="ml-auto text-xs text-muted-foreground">{pct}%</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{ width: `${pct}%`, background: g.colour }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            )}

            {data.notes && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Notes</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm whitespace-pre-wrap">{data.notes}</p>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </>
  );
}
