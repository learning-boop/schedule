"use client";

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
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { GoalCard } from "./goal-card";
import { useGoals } from "@/hooks/use-goals";
import { GoalForm } from "./goal-form";

export function GoalList() {
  const { goals, loading, refetch, setGoals } = useGoals();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = goals.findIndex((g) => g.id === active.id);
    const newIndex = goals.findIndex((g) => g.id === over.id);
    const reordered = arrayMove(goals, oldIndex, newIndex);
    setGoals(reordered);

    await fetch("/api/goals/reorder", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: reordered.map((g) => g.id) }),
    });
  }

  if (loading) {
    return <p className="text-muted-foreground">Loading goals...</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">
            {goals.length}/10 goals &middot; Drag to reorder
          </p>
        </div>
        {goals.length < 10 && <GoalForm onCreated={refetch} />}
      </div>

      {goals.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center">
          <p className="text-muted-foreground">No goals yet. Add your first goal above.</p>
        </div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={goals.map((g) => g.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-3">
              {goals.map((goal) => (
                <GoalCard key={goal.id} goal={goal} onUpdate={refetch} />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
}
