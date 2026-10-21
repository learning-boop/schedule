"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import FullCalendar, {
  type CalendarRef,
  type DateSelectInfo,
  type DatesSetInfo,
  type EventClickInfo,
  type EventDropInfo,
  type EventInput,
  type EventResizeDoneInfo,
} from "@fullcalendar/react";
import { Plus } from "lucide-react";
import { BlockDialog, type BlockFormData } from "./block-dialog";
import { DEFAULT_EVENT_COLOUR, gcalBaseOptions } from "./gcal";
import { Button } from "@/components/ui/button";
import { useGoals, type Goal } from "@/hooks/use-goals";
import { useIsMobile } from "@/hooks/use-mobile";

type TimeBlock = {
  id: string;
  title: string;
  start: string;
  end: string;
  done: boolean;
  work_note: string | null;
  goal_id: string | null;
  category: string | null;
  goal: { title: string; colour: string } | null;
};

type ViewName = "timeGridDay" | "timeGridWeek" | "dayGridMonth";

function toLocalDatetime(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function ScheduleCalendar({ initialView }: { initialView: ViewName }) {
  const calendarRef = useRef<CalendarRef>(null);
  const rangeRef = useRef<{ start: string; end: string } | null>(null);
  const { goals } = useGoals();
  const isMobile = useIsMobile();
  const [blocks, setBlocks] = useState<TimeBlock[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogInitial, setDialogInitial] = useState<Partial<BlockFormData>>({});
  const [filterGoal, setFilterGoal] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [categories, setCategories] = useState<string[]>([]);

  const fetchBlocks = useCallback(async () => {
    const range = rangeRef.current;
    if (!range) return;
    const params = new URLSearchParams({ start: range.start, end: range.end });
    if (filterGoal) params.set("goalId", filterGoal);
    if (filterCategory) params.set("category", filterCategory);

    const res = await fetch(`/api/time-blocks?${params}`);
    if (res.ok) {
      const data: TimeBlock[] = await res.json();
      setBlocks(data);
      if (!filterCategory) {
        setCategories((prev) => {
          const next = new Set(prev);
          for (const b of data) if (b.category) next.add(b.category);
          return [...next].sort();
        });
      }
    }
  }, [filterGoal, filterCategory]);

  // Refetch when filters change (the visible range is set by datesSet)
  useEffect(() => {
    fetchBlocks();
  }, [fetchBlocks]);

  function handleDatesSet(arg: DatesSetInfo) {
    rangeRef.current = { start: arg.start.toISOString(), end: arg.end.toISOString() };
    fetchBlocks();
  }

  function openNew(start: Date, end: Date) {
    setDialogInitial({ start: toLocalDatetime(start), end: toLocalDatetime(end) });
    setDialogOpen(true);
  }

  function handleSelect(info: DateSelectInfo) {
    openNew(info.start, info.end);
    calendarRef.current?.getApi().unselect();
  }

  function handleNewClick() {
    const api = calendarRef.current?.getApi();
    const base = api ? api.getDate() : new Date();
    const now = new Date();
    const start = new Date(base);
    // Today → next full hour; other days → 9:00
    if (start.toDateString() === now.toDateString()) {
      start.setHours(now.getHours() + 1, 0, 0, 0);
    } else {
      start.setHours(9, 0, 0, 0);
    }
    openNew(start, new Date(start.getTime() + 60 * 60 * 1000));
  }

  function handleEventClick(info: EventClickInfo) {
    const block = blocks.find((b) => b.id === info.event.id);
    if (!block) return;

    setDialogInitial({
      id: block.id,
      title: block.title,
      goal_id: block.goal_id || "",
      category: block.category || "",
      start: toLocalDatetime(new Date(block.start)),
      end: toLocalDatetime(new Date(block.end)),
      done: block.done,
      work_note: block.work_note || "",
    });
    setDialogOpen(true);
  }

  async function persistMove(info: EventDropInfo | EventResizeDoneInfo) {
    const res = await fetch(`/api/time-blocks/${info.event.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        start: info.event.start?.toISOString(),
        end: info.event.end?.toISOString(),
      }),
    });
    if (!res.ok) {
      info.revert();
      return;
    }
    fetchBlocks();
  }

  async function handleSave(data: BlockFormData) {
    if (data.id) {
      await fetch(`/api/time-blocks/${data.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: data.title,
          goal_id: data.goal_id || null,
          category: data.category || null,
          start: new Date(data.start).toISOString(),
          end: new Date(data.end).toISOString(),
          done: data.done,
          work_note: data.work_note || null,
        }),
      });
    } else {
      await fetch("/api/time-blocks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: data.title,
          goal_id: data.goal_id || null,
          category: data.category || null,
          start: new Date(data.start).toISOString(),
          end: new Date(data.end).toISOString(),
          recurrence: data.recurrence || null,
        }),
      });
    }

    setDialogOpen(false);
    fetchBlocks();
  }

  async function handleDelete() {
    if (!dialogInitial.id) return;
    await fetch(`/api/time-blocks/${dialogInitial.id}`, { method: "DELETE" });
    setDialogOpen(false);
    fetchBlocks();
  }

  const events: EventInput[] = useMemo(
    () =>
      blocks.map((b) => ({
        id: b.id,
        title: b.title,
        start: b.start,
        end: b.end,
        color: b.goal?.colour || DEFAULT_EVENT_COLOUR,
        className: b.done ? "gcal-done" : undefined,
        extendedProps: {
          done: b.done,
          category: b.category,
          subtitle: b.goal?.title ?? b.category ?? "",
        },
      })),
    [blocks],
  );

  const baseOptions = useMemo(() => gcalBaseOptions(), []);

  const effectiveView: ViewName =
    isMobile && initialView === "timeGridWeek" ? "timeGridDay" : initialView;

  return (
    <div className="flex flex-col gap-3">
      {/* Create + filters */}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          className="h-9 gap-1.5 rounded-full px-4 shadow-sm"
          onClick={handleNewClick}
        >
          <Plus className="h-4 w-4" /> New block
        </Button>
        <div className="flex-1" />
        <select
          aria-label="Filter by goal"
          className="h-8 max-w-[12rem] rounded-md border border-input bg-background px-2 text-sm"
          value={filterGoal}
          onChange={(e) => setFilterGoal(e.target.value)}
        >
          <option value="">All goals</option>
          {goals.map((g: Goal) => (
            <option key={g.id} value={g.id}>
              {g.title}
            </option>
          ))}
        </select>
        <select
          aria-label="Filter by category"
          className="h-8 rounded-md border border-input bg-background px-2 text-sm"
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
        >
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      {/* Calendar */}
      <div className="gcal overflow-hidden h-[calc(100svh-9rem)] min-h-[480px] rounded-xl border bg-background">
        <FullCalendar
          key={effectiveView}
          ref={calendarRef}
          {...baseOptions}
          initialView={effectiveView}
          headerToolbar={{
            left: "today prev,next title",
            right: isMobile ? "timeGridDay,dayGridMonth" : "timeGridDay,timeGridWeek,dayGridMonth",
          }}
          height="100%"
          selectable
          selectMirror
          editable
          eventResizableFromStart
          events={events}
          select={handleSelect}
          eventClick={handleEventClick}
          eventDrop={persistMove}
          eventResize={persistMove}
          datesSet={handleDatesSet}
        />
      </div>

      <BlockDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        goals={goals}
        initial={dialogInitial}
        onSave={handleSave}
        onDelete={dialogInitial.id ? handleDelete : undefined}
      />
    </div>
  );
}
