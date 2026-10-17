"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronLeft, CheckCircle, Clock, Target } from "lucide-react";
import { TopBar } from "@/components/top-bar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type DashRow = {
  user: { id: string; name: string; role: string };
  hoursThisWeek: number;
  goals: { title: string; colour: string; progress: number }[];
  doneToday: { title: string; start: string; end: string }[];
};

export default function TeamDashboardPage() {
  const [rows, setRows] = useState<DashRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/team/dashboard")
      .then((r) => (r.ok ? r.json() : []))
      .then(setRows)
      .finally(() => setLoading(false));
  }, []);

  const totalHours = rows.reduce((s, r) => s + r.hoursThisWeek, 0);

  return (
    <>
      <TopBar title="Manager Dashboard" />
      <div className="mx-auto w-full max-w-4xl p-6 space-y-6">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1 text-xs"
          render={<Link href="/team" />}
        >
          <ChevronLeft className="h-3.5 w-3.5" /> Back to team
        </Button>

        {loading && <p className="text-sm text-muted-foreground">Loading...</p>}

        {!loading && (
          <>
            {/* Summary cards */}
            <div className="grid grid-cols-3 gap-3">
              <Card>
                <CardContent className="py-3 text-center">
                  <p className="text-2xl font-bold">{rows.length}</p>
                  <p className="text-xs text-muted-foreground">Team members</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="py-3 text-center">
                  <p className="text-2xl font-bold">{Math.round(totalHours * 10) / 10}h</p>
                  <p className="text-xs text-muted-foreground">Total hours this week</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="py-3 text-center">
                  <p className="text-2xl font-bold">
                    {rows.reduce((s, r) => s + r.doneToday.length, 0)}
                  </p>
                  <p className="text-xs text-muted-foreground">Blocks done today</p>
                </CardContent>
              </Card>
            </div>

            {/* Per-person */}
            {rows.map((r) => (
              <Card key={r.user.id}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Link href={`/team/${r.user.id}`} className="hover:underline">
                      {r.user.name}
                    </Link>
                    <span className="text-[10px] rounded-full border px-1.5 py-0.5 text-muted-foreground font-normal">
                      {r.user.role}
                    </span>
                    <span className="ml-auto flex items-center gap-1 text-xs font-normal text-muted-foreground">
                      <Clock className="h-3 w-3" /> {r.hoursThisWeek}h this week
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {/* Goals */}
                  {r.goals.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="text-xs font-medium flex items-center gap-1">
                        <Target className="h-3 w-3" /> Goals
                      </p>
                      {r.goals.map((g, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <div className="h-2 w-2 rounded-full" style={{ background: g.colour }} />
                          <span className="text-xs flex-1">{g.title}</span>
                          <span className="text-[10px] text-muted-foreground">{g.progress}%</span>
                          <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden">
                            <div
                              className="h-full rounded-full"
                              style={{ width: `${g.progress}%`, background: g.colour }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Done today feed */}
                  {r.doneToday.length > 0 && (
                    <div className="space-y-1">
                      <p className="text-xs font-medium flex items-center gap-1">
                        <CheckCircle className="h-3 w-3" /> Done today
                      </p>
                      {r.doneToday.map((d, i) => (
                        <p key={i} className="text-xs text-muted-foreground pl-4">
                          {d.title}
                        </p>
                      ))}
                    </div>
                  )}

                  {r.goals.length === 0 && r.doneToday.length === 0 && (
                    <p className="text-xs text-muted-foreground">No activity yet</p>
                  )}
                </CardContent>
              </Card>
            ))}

            {rows.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-8">
                No team members to show.
              </p>
            )}
          </>
        )}
      </div>
    </>
  );
}
