"use client";

import { useState } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  DragOverlay,
  type DragStartEvent,
} from "@dnd-kit/core";
import { useDroppable } from "@dnd-kit/core";
import { Input } from "@/components/ui/input";
import { X } from "lucide-react";
import type { Matrix as MatrixType } from "@/hooks/use-daily-page";

type QuadrantKey = keyof MatrixType;

const QUADRANTS: { key: QuadrantKey; label: string; color: string }[] = [
  {
    key: "urgent_important",
    label: "Urgent & Important",
    color: "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-900",
  },
  {
    key: "not_urgent_important",
    label: "Not Urgent & Important",
    color: "bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-900",
  },
  {
    key: "urgent_not",
    label: "Urgent & Not Important",
    color: "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900",
  },
  {
    key: "not_urgent_not",
    label: "Not Urgent & Not Important",
    color: "bg-gray-50 dark:bg-gray-950/30 border-gray-200 dark:border-gray-800",
  },
];

function Quadrant({
  qKey,
  label,
  color,
  items,
  onAdd,
  onRemove,
}: {
  qKey: string;
  label: string;
  color: string;
  items: string[];
  onAdd: (text: string) => void;
  onRemove: (index: number) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: qKey });
  const [newText, setNewText] = useState("");

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!newText.trim()) return;
    onAdd(newText.trim());
    setNewText("");
  }

  return (
    <div
      ref={setNodeRef}
      className={`rounded-lg border p-3 ${color} ${isOver ? "ring-2 ring-primary" : ""} min-h-[120px] flex flex-col`}
    >
      <p className="mb-2 text-xs font-semibold">{label}</p>
      <div className="flex-1 space-y-1">
        {items.map((item, idx) => (
          <div
            key={`${qKey}-${idx}`}
            id={`${qKey}:${idx}`}
            draggable
            onDragStart={(e) => {
              e.dataTransfer.setData(
                "application/matrix-item",
                JSON.stringify({ fromQuadrant: qKey, index: idx, text: item }),
              );
            }}
            className="flex items-center gap-1 rounded bg-background/80 px-2 py-1 text-xs cursor-grab"
          >
            <span className="flex-1">{item}</span>
            <button
              onClick={() => onRemove(idx)}
              className="text-muted-foreground hover:text-destructive"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ))}
      </div>
      <form onSubmit={handleAdd} className="mt-2">
        <Input
          placeholder="Add task..."
          value={newText}
          onChange={(e) => setNewText(e.target.value)}
          className="h-7 text-xs"
        />
      </form>
    </div>
  );
}

export function MatrixView({
  matrix,
  onChange,
}: {
  matrix: MatrixType;
  onChange: (matrix: MatrixType) => void;
}) {
  const [activeItem, setActiveItem] = useState<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  function handleAdd(quadrant: QuadrantKey, text: string) {
    onChange({ ...matrix, [quadrant]: [...matrix[quadrant], text] });
  }

  function handleRemove(quadrant: QuadrantKey, index: number) {
    onChange({
      ...matrix,
      [quadrant]: matrix[quadrant].filter((_, i) => i !== index),
    });
  }

  function handleDragStart(event: DragStartEvent) {
    setActiveItem(String(event.active.id));
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveItem(null);
    const { active, over } = event;
    if (!over) return;

    const activeId = String(active.id);
    const overId = String(over.id);

    // Parse the active item: "quadrant:index"
    const [fromQ, fromIdx] = activeId.split(":");
    if (!fromQ || fromIdx === undefined) return;

    // The over target is the quadrant key
    const toQ = overId as QuadrantKey;
    if (fromQ === toQ) return;
    if (!matrix[toQ]) return;

    const idx = parseInt(fromIdx);
    const item = matrix[fromQ as QuadrantKey][idx];
    if (!item) return;

    const newMatrix = { ...matrix };
    newMatrix[fromQ as QuadrantKey] = matrix[fromQ as QuadrantKey].filter((_, i) => i !== idx);
    newMatrix[toQ] = [...matrix[toQ], item];
    onChange(newMatrix);
  }

  // Use native HTML drag and drop for the quadrants since dnd-kit droppable is already set up
  function handleNativeDrop(quadrant: QuadrantKey, e: React.DragEvent) {
    e.preventDefault();
    const data = e.dataTransfer.getData("application/matrix-item");
    if (!data) return;

    const { fromQuadrant, index, text } = JSON.parse(data);
    if (fromQuadrant === quadrant) return;

    const newMatrix = { ...matrix };
    newMatrix[fromQuadrant as QuadrantKey] = matrix[fromQuadrant as QuadrantKey].filter(
      (_, i) => i !== index,
    );
    newMatrix[quadrant] = [...matrix[quadrant], text];
    onChange(newMatrix);
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold">Urgent / Important Matrix</h3>
      <div className="grid grid-cols-2 gap-2">
        {QUADRANTS.map((q) => (
          <div
            key={q.key}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => handleNativeDrop(q.key, e)}
          >
            <Quadrant
              qKey={q.key}
              label={q.label}
              color={q.color}
              items={matrix[q.key]}
              onAdd={(text) => handleAdd(q.key, text)}
              onRemove={(idx) => handleRemove(q.key, idx)}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
