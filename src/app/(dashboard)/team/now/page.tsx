"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronLeft, Activity, CheckCircle, Clock } from "lucide-react";
import { TopBar } from "@/components/top-bar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getBrowserTimeZone } from "@/lib/date-utils";

type NowCard = {
  user: { id: string; name: string; role: string };
  currentBlock: {
    title: string;
    start: string;
    end: string;
    goal: { title: string; colour: string } | null;
    done: boolean;
  } | null;
  doneToday: { title: string; start: string; end: string }[];
  hoursToday: number;
};

export default function RightNowPage() {
  const [cards, setCards] = useState<NowCard[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/team/now?tz=${encodeURIComponent(getBrowserTimeZone())}`)
      .then((r) => (r.ok ? r.json() : []))
      .then(setCards)
      .finally(() => setLoading(false));

    // Auto-refresh every 60s
    const interval = setInterval(() => {
      fetch(`/api/team/now?tz=${encodeURIComponent(getBrowserTimeZone())}`)
        .then((r) => (r.ok ? r.json() : []))
        .then(setCards);
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  return (
    <>
      <TopBar title="Right Now" />
      <div className="mx-auto w-full max-w-4xl p-6 space-y-4">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1 text-xs"
          render={<Link href="/team" />}
        >
          <ChevronLeft className="h-3.5 w-3.5" /> Back to team
        </Button>

        {loading && <p className="text-sm text-muted-foreground">Loading...</p>}

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((c) => (
            <Link key={c.user.id} href={`/team/${c.user.id}`}>
              <Card className="hover:border-primary/50 transition-colors h-full">
                <CardContent className="p-4 space-y-3">
                  {/* User header */}
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                      {c.user.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{c.user.name}</p>
                      <p className="text-[10px] text-muted-foreground">{c.user.role}</p>
                    </div>
                  </div>

                  {/* Current block */}
                  {c.currentBlock ? (
                    <div
                      className="rounded-md border p-2"
                      style={{
                        borderLeftWidth: 3,
                        borderLeftColor: c.currentBlock.goal?.colour ?? "#6366f1",
                      }}
                    >
                      <div className="flex items-center gap-1.5">
                        <Activity className="h-3.5 w-3.5 text-green-500 animate-pulse" />
                        <span className="text-xs font-medium">Working on</span>
                      </div>
                      <p className="text-sm font-medium mt-0.5">{c.currentBlock.title}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {new Date(c.currentBlock.start).toLocaleTimeString(undefined, {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}{" "}
                        –{" "}
                        {new Date(c.currentBlock.end).toLocaleTimeString(undefined, {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                  ) : (
                    <div className="rounded-md border border-dashed p-2 text-center">
                      <p className="text-xs text-muted-foreground">No active block</p>
                    </div>
                  )}

                  {/* Stats row */}
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <CheckCircle className="h-3 w-3" />
                      {c.doneToday.length} done
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {c.hoursToday}h today
                    </span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>

        {!loading && cards.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8">No team members found.</p>
        )}
      </div>
    </>
  );
}
