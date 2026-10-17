"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { SubGoal } from "@/hooks/use-goals";

export function SubGoalList({
  goalId,
  subGoals,
  onUpdate,
}: {
  goalId: string;
  subGoals: SubGoal[];
  onUpdate: () => void;
}) {
  const [newTitle, setNewTitle] = useState("");
  const [newDeadline, setNewDeadline] = useState("");

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!newTitle.trim()) return;

    await fetch(`/api/goals/${goalId}/sub-goals`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: newTitle.trim(), deadline: newDeadline || null }),
    });

    setNewTitle("");
    setNewDeadline("");
    onUpdate();
  }

  async function handleToggle(sg: SubGoal) {
    await fetch(`/api/goals/${goalId}/sub-goals`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: sg.id, done: !sg.done }),
    });
    onUpdate();
  }

  async function handleDelete(id: string) {
    await fetch(`/api/goals/${goalId}/sub-goals`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    onUpdate();
  }

  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-muted-foreground">Sub-goals</p>
      {subGoals.map((sg) => (
        <div key={sg.id} className="flex items-center gap-2 py-1">
          <input
            type="checkbox"
            checked={sg.done}
            onChange={() => handleToggle(sg)}
            className="h-4 w-4 rounded"
          />
          <span className={`flex-1 text-sm ${sg.done ? "text-muted-foreground line-through" : ""}`}>
            {sg.title}
          </span>
          {sg.deadline && (
            <span className="text-xs text-muted-foreground">
              {new Date(sg.deadline).toLocaleDateString()}
            </span>
          )}
          <button
            onClick={() => handleDelete(sg.id)}
            className="text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
      <form onSubmit={handleAdd} className="flex gap-2 pt-1">
        <Input
          placeholder="Add sub-goal..."
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          className="h-7 flex-1 text-sm"
        />
        <Input
          type="date"
          value={newDeadline}
          onChange={(e) => setNewDeadline(e.target.value)}
          className="h-7 w-32 text-sm"
        />
        <Button type="submit" size="sm" variant="ghost" className="h-7 px-2">
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </form>
    </div>
  );
}
