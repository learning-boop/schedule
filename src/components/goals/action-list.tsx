"use client";

import { useState } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Plus, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { Action } from "@/hooks/use-goals";

function SortableAction({
  action,
  onToggle,
  onDelete,
}: {
  action: Action;
  onToggle: (id: string, done: boolean) => void;
  onDelete: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: action.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-2 py-1">
      <button {...attributes} {...listeners} className="cursor-grab text-muted-foreground">
        <GripVertical className="h-3.5 w-3.5" />
      </button>
      <input
        type="checkbox"
        checked={action.done}
        onChange={() => onToggle(action.id, !action.done)}
        className="h-4 w-4 rounded"
      />
      <span className={`flex-1 text-sm ${action.done ? "text-muted-foreground line-through" : ""}`}>
        {action.title}
      </span>
      <button
        onClick={() => onDelete(action.id)}
        className="text-muted-foreground hover:text-destructive"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

export function ActionList({
  goalId,
  actions: initialActions,
  onUpdate,
}: {
  goalId: string;
  actions: Action[];
  onUpdate: () => void;
}) {
  const [actions, setActions] = useState(initialActions);
  const [newTitle, setNewTitle] = useState("");

  // Keep in sync with parent
  if (initialActions !== actions && initialActions.length !== actions.length) {
    setActions(initialActions);
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = actions.findIndex((a) => a.id === active.id);
    const newIndex = actions.findIndex((a) => a.id === over.id);
    const reordered = arrayMove(actions, oldIndex, newIndex);
    setActions(reordered);

    await fetch(`/api/goals/${goalId}/actions/reorder`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: reordered.map((a) => a.id) }),
    });
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!newTitle.trim()) return;

    await fetch(`/api/goals/${goalId}/actions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: newTitle.trim() }),
    });

    setNewTitle("");
    onUpdate();
  }

  async function handleToggle(id: string, done: boolean) {
    setActions((prev) => prev.map((a) => (a.id === id ? { ...a, done } : a)));
    await fetch(`/api/goals/${goalId}/actions`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, done }),
    });
    onUpdate();
  }

  async function handleDelete(id: string) {
    setActions((prev) => prev.filter((a) => a.id !== id));
    await fetch(`/api/goals/${goalId}/actions`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    onUpdate();
  }

  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-muted-foreground">Actions</p>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={actions.map((a) => a.id)} strategy={verticalListSortingStrategy}>
          {actions.map((action) => (
            <SortableAction
              key={action.id}
              action={action}
              onToggle={handleToggle}
              onDelete={handleDelete}
            />
          ))}
        </SortableContext>
      </DndContext>
      <form onSubmit={handleAdd} className="flex gap-2 pt-1">
        <Input
          placeholder="Add action..."
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          className="h-7 text-sm"
        />
        <Button type="submit" size="sm" variant="ghost" className="h-7 px-2">
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </form>
    </div>
  );
}
