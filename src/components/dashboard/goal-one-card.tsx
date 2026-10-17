"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Target, Plus, AlertTriangle } from "lucide-react";
import { useGoals } from "@/hooks/use-goals";

export function GoalOneCard() {
  const { goals, loading } = useGoals();
  const [blockTitle, setBlockTitle] = useState("");
  const [creating, setCreating] = useState(false);

  const goal1 = goals[0];

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-sm text-muted-foreground">Loading...</p>
        </CardContent>
      </Card>
    );
  }

  if (!goal1) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Target className="h-4 w-4" />
            Goal #1
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No goals yet. Go to Goals to create your first one.
          </p>
        </CardContent>
      </Card>
    );
  }

  const doneActions = goal1.actions.filter((a) => a.done).length;
  const totalActions = goal1.actions.length;
  const progress = totalActions > 0 ? Math.round((doneActions / totalActions) * 100) : 0;
  const overdue =
    goal1.deadline && goal1.status !== "done" && new Date(goal1.deadline) < new Date();

  async function handleQuickAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!blockTitle.trim()) return;
    setCreating(true);

    const now = new Date();
    const start = new Date(now);
    start.setMinutes(0, 0, 0);
    const end = new Date(start);
    end.setHours(start.getHours() + 1);

    await fetch("/api/time-blocks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: blockTitle.trim(),
        goal_id: goal1.id,
        start: start.toISOString(),
        end: end.toISOString(),
      }),
    });

    setBlockTitle("");
    setCreating(false);
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <div className="h-3 w-3 rounded-full" style={{ backgroundColor: goal1.colour }} />
          Do one thing today toward Goal #1
          {overdue && <AlertTriangle className="h-4 w-4 text-destructive" />}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="font-medium">{goal1.title}</p>
        {totalActions > 0 && (
          <div className="flex items-center gap-3">
            <Progress value={progress} className="h-2 flex-1" />
            <span className="text-xs text-muted-foreground">
              {doneActions}/{totalActions}
            </span>
          </div>
        )}
        {goal1.deadline && (
          <p className={`text-xs ${overdue ? "text-destructive" : "text-muted-foreground"}`}>
            Due {new Date(goal1.deadline).toLocaleDateString()}
          </p>
        )}
        <form onSubmit={handleQuickAdd} className="flex gap-2 pt-1">
          <Input
            placeholder="Quick-add a calendar block..."
            value={blockTitle}
            onChange={(e) => setBlockTitle(e.target.value)}
            className="h-8 text-sm"
          />
          <Button type="submit" size="sm" className="h-8" disabled={creating}>
            <Plus className="mr-1 h-3.5 w-3.5" />
            Add
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
