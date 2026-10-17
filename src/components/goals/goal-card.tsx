"use client";

import { useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Trash2, ChevronDown, ChevronRight, AlertTriangle } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SubGoalList } from "./sub-goal-list";
import { ActionList } from "./action-list";
import type { Goal } from "@/hooks/use-goals";

function isOverdue(goal: Goal) {
  if (!goal.deadline || goal.status === "done") return false;
  return new Date(goal.deadline) < new Date();
}

export function GoalCard({ goal, onUpdate }: { goal: Goal; onUpdate: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: goal.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const doneActions = goal.actions.filter((a) => a.done).length;
  const totalActions = goal.actions.length;
  const progress = totalActions > 0 ? Math.round((doneActions / totalActions) * 100) : 0;
  const overdue = isOverdue(goal);

  async function handleDelete() {
    await fetch(`/api/goals/${goal.id}`, { method: "DELETE" });
    onUpdate();
  }

  async function handleToggleStatus() {
    const newStatus = goal.status === "done" ? "active" : "done";
    await fetch(`/api/goals/${goal.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    onUpdate();
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`rounded-lg border bg-card p-4 ${overdue ? "border-destructive/50" : ""}`}
    >
      <div className="flex items-start gap-3">
        <button {...attributes} {...listeners} className="mt-1 cursor-grab text-muted-foreground">
          <GripVertical className="h-4 w-4" />
        </button>

        <div
          className="mt-1.5 h-3 w-3 shrink-0 rounded-full"
          style={{ backgroundColor: goal.colour }}
        />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <button onClick={() => setExpanded(!expanded)} className="flex items-center gap-1">
              {expanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </button>
            <input
              type="checkbox"
              checked={goal.status === "done"}
              onChange={handleToggleStatus}
              className="h-4 w-4 rounded"
            />
            <h3
              className={`font-medium ${goal.status === "done" ? "text-muted-foreground line-through" : ""}`}
            >
              {goal.title}
            </h3>
            {overdue && (
              <Badge variant="destructive" className="ml-1 gap-1 text-xs">
                <AlertTriangle className="h-3 w-3" />
                Overdue
              </Badge>
            )}
            <Badge variant="secondary" className="ml-auto text-xs">
              #{goal.rank + 1}
            </Badge>
          </div>

          <div className="mt-2 flex items-center gap-3">
            {goal.deadline && (
              <span className={`text-xs ${overdue ? "text-destructive" : "text-muted-foreground"}`}>
                Due {new Date(goal.deadline).toLocaleDateString()}
              </span>
            )}
            {totalActions > 0 && (
              <div className="flex items-center gap-2 flex-1 max-w-48">
                <Progress value={progress} className="h-2" />
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  {doneActions}/{totalActions}
                </span>
              </div>
            )}
          </div>

          {expanded && (
            <div className="mt-4 space-y-4 border-t pt-4">
              <SubGoalList goalId={goal.id} subGoals={goal.sub_goals} onUpdate={onUpdate} />
              <ActionList goalId={goal.id} actions={goal.actions} onUpdate={onUpdate} />
            </div>
          )}
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={handleDelete}
          className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
