"use client";

import { useState } from "react";
import { GripVertical, Plus, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { Top3Item } from "@/hooks/use-daily-page";
import type { Goal } from "@/hooks/use-goals";

export function Top3({
  items,
  goals,
  onChange,
}: {
  items: Top3Item[];
  goals: Goal[];
  onChange: (items: Top3Item[]) => void;
}) {
  const [newText, setNewText] = useState("");
  const [showGoals, setShowGoals] = useState(false);

  function addItem(text: string, goalId?: string, actionId?: string) {
    if (items.length >= 3) return;
    const item: Top3Item = {
      id: crypto.randomUUID(),
      text,
      done: false,
      goalId,
      actionId,
    };
    onChange([...items, item]);
  }

  function toggleDone(id: string) {
    onChange(items.map((i) => (i.id === id ? { ...i, done: !i.done } : i)));
  }

  function removeItem(id: string) {
    onChange(items.filter((i) => i.id !== id));
  }

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!newText.trim() || items.length >= 3) return;
    addItem(newText.trim());
    setNewText("");
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold">Top 3 Priorities</h3>

      {items.length === 0 && (
        <p className="text-xs text-muted-foreground">Pick up to 3 priorities for today.</p>
      )}

      <div className="space-y-2">
        {items.map((item, idx) => (
          <div key={item.id} className="flex items-center gap-2 rounded-md border p-2">
            <GripVertical className="h-3.5 w-3.5 text-muted-foreground cursor-grab" />
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
              {idx + 1}
            </span>
            <input
              type="checkbox"
              checked={item.done}
              onChange={() => toggleDone(item.id)}
              className="h-4 w-4 rounded"
            />
            <span
              className={`flex-1 text-sm ${item.done ? "text-muted-foreground line-through" : ""}`}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData(
                  "text/plain",
                  JSON.stringify({
                    type: "top3",
                    title: item.text,
                    goalId: item.goalId,
                  }),
                );
              }}
            >
              {item.text}
            </span>
            <button
              onClick={() => removeItem(item.id)}
              className="text-muted-foreground hover:text-destructive"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>

      {items.length < 3 && (
        <div className="space-y-2">
          <form onSubmit={handleAdd} className="flex gap-2">
            <Input
              placeholder="Type a priority..."
              value={newText}
              onChange={(e) => setNewText(e.target.value)}
              className="h-8 text-sm"
            />
            <Button type="submit" size="sm" variant="ghost" className="h-8 px-2">
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </form>

          <div>
            <button
              type="button"
              onClick={() => setShowGoals(!showGoals)}
              className="text-xs text-primary underline"
            >
              {showGoals ? "Hide goals" : "Pick from goals"}
            </button>
            {showGoals && (
              <div className="mt-2 max-h-40 space-y-1 overflow-y-auto rounded border p-2">
                {goals.map((g) => (
                  <div key={g.id}>
                    <button
                      type="button"
                      onClick={() => addItem(g.title, g.id)}
                      className="flex w-full items-center gap-2 rounded px-2 py-1 text-left text-sm hover:bg-accent"
                    >
                      <div
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: g.colour }}
                      />
                      {g.title}
                    </button>
                    {g.actions
                      .filter((a) => !a.done)
                      .slice(0, 3)
                      .map((a) => (
                        <button
                          key={a.id}
                          type="button"
                          onClick={() => addItem(a.title, g.id, a.id)}
                          className="flex w-full items-center gap-2 rounded px-4 py-0.5 text-left text-xs text-muted-foreground hover:bg-accent"
                        >
                          &bull; {a.title}
                        </button>
                      ))}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
