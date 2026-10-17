"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import type { Goal } from "@/hooks/use-goals";

export type BlockFormData = {
  id?: string;
  title: string;
  goal_id: string;
  category: string;
  start: string;
  end: string;
  done: boolean;
  work_note: string;
  recurrence: string;
};

const CATEGORIES = ["Deep Work", "Meeting", "Admin", "Learning", "Exercise", "Break", "Other"];

export function BlockDialog({
  open,
  onOpenChange,
  goals,
  initial,
  onSave,
  onDelete,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  goals: Goal[];
  initial: Partial<BlockFormData>;
  onSave: (data: BlockFormData) => void;
  onDelete?: () => void;
}) {
  const [form, setForm] = useState<BlockFormData>({
    title: "",
    goal_id: "",
    category: "",
    start: "",
    end: "",
    done: false,
    work_note: "",
    recurrence: "",
    ...initial,
  });

  useEffect(() => {
    setForm({
      title: "",
      goal_id: "",
      category: "",
      start: "",
      end: "",
      done: false,
      work_note: "",
      recurrence: "",
      ...initial,
    });
  }, [initial]);

  const isEdit = !!initial.id;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSave(form);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Block" : "New Block"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="What are you working on?"
              required
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="start">Start</Label>
              <Input
                id="start"
                type="datetime-local"
                value={form.start}
                onChange={(e) => setForm({ ...form, start: e.target.value })}
                required
              />
            </div>
            <div>
              <Label htmlFor="end">End</Label>
              <Input
                id="end"
                type="datetime-local"
                value={form.end}
                onChange={(e) => setForm({ ...form, end: e.target.value })}
                required
              />
            </div>
          </div>

          <div>
            <Label htmlFor="goal">Goal</Label>
            <select
              id="goal"
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
              value={form.goal_id}
              onChange={(e) => setForm({ ...form, goal_id: e.target.value })}
            >
              <option value="">No goal</option>
              {goals.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.title}
                </option>
              ))}
            </select>
          </div>

          <div>
            <Label htmlFor="category">Category</Label>
            <select
              id="category"
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
            >
              <option value="">None</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {!isEdit && (
            <div>
              <Label htmlFor="recurrence">Recurrence</Label>
              <select
                id="recurrence"
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                value={form.recurrence}
                onChange={(e) => setForm({ ...form, recurrence: e.target.value })}
              >
                <option value="">One-time</option>
                <option value="daily">Daily (4 weeks)</option>
                <option value="weekly">Weekly (8 weeks)</option>
              </select>
            </div>
          )}

          {isEdit && (
            <>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="done"
                  checked={form.done}
                  onCheckedChange={(checked) => setForm({ ...form, done: checked === true })}
                />
                <Label htmlFor="done">Mark as done</Label>
              </div>
              {form.done && (
                <div>
                  <Label htmlFor="work_note">What was worked on?</Label>
                  <Textarea
                    id="work_note"
                    value={form.work_note}
                    onChange={(e) => setForm({ ...form, work_note: e.target.value })}
                    placeholder="Notes about what you accomplished..."
                    rows={3}
                  />
                </div>
              )}
            </>
          )}

          <div className="flex gap-2">
            <Button type="submit" className="flex-1">
              {isEdit ? "Save" : "Create"}
            </Button>
            {isEdit && onDelete && (
              <Button type="button" variant="destructive" onClick={onDelete}>
                Delete
              </Button>
            )}
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
