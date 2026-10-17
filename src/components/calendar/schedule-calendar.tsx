"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/react/daygrid";
import timeGridPlugin from "@fullcalendar/react/timegrid";
import interactionPlugin from "@fullcalendar/react/interaction";
import { BlockDialog, type BlockFormData } from "./block-dialog";
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

function toLocalDatetime(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function ScheduleCalendar({
  initialView,
}: {
  initialView: "timeGridDay" | "timeGridWeek" | "dayGridMonth";
}) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const calendarRef = useRef<any>(null);
  const { goals } = useGoals();
  const isMobile = useIsMobile();
  const [blocks, setBlocks] = useState<TimeBlock[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogInitial, setDialogInitial] = useState<Partial<BlockFormData>>({});
  const [filterGoal, setFilterGoal] = useState("");
  const [filterCategory, setFilterCategory] = useState("");

  const fetchBlocks = useCallback(
    async (startStr?: string, endStr?: string) => {
      const params = new URLSearchParams();
      if (startStr) params.set("start", startStr);
      if (endStr) params.set("end", endStr);
      if (filterGoal) params.set("goalId", filterGoal);
      if (filterCategory) params.set("category", filterCategory);

      const res = await fetch(`/api/time-blocks?${params}`);
      if (res.ok) {
        const data = await res.json();
        setBlocks(data);
      }
    },
    [filterGoal, filterCategory],
  );

  useEffect(() => {
    fetchBlocks();
  }, [fetchBlocks]);

  function handleDatesSet(arg: { startStr: string; endStr: string }) {
    fetchBlocks(arg.startStr, arg.endStr);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function handleSelect(info: any) {
    setDialogInitial({
      start: toLocalDatetime(info.start),
      end: toLocalDatetime(info.end),
    });
    setDialogOpen(true);
    calendarRef.current?.getApi?.()?.unselect();
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function handleEventClick(info: any) {
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async function handleEventDrop(info: any) {
    await fetch(`/api/time-blocks/${info.event.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        start: info.event.start?.toISOString(),
        end: info.event.end?.toISOString(),
      }),
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async function handleEventResize(info: any) {
    await fetch(`/api/time-blocks/${info.event.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        start: info.event.start?.toISOString(),
        end: info.event.end?.toISOString(),
      }),
    });
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

  const events = blocks.map((b) => ({
    id: b.id,
    title: b.title,
    start: b.start,
    end: b.end,
    backgroundColor: b.done ? "#9ca3af" : b.goal?.colour || "#6366f1",
    borderColor: b.done ? "#9ca3af" : b.goal?.colour || "#6366f1",
    textColor: "#fff",
    extendedProps: { done: b.done, category: b.category },
    classNames: b.done ? ["opacity-60"] : [],
  }));

  // Determine categories from blocks for filter
  const categories = [...new Set(blocks.map((b) => b.category).filter(Boolean))] as string[];

  const effectiveView = isMobile
    ? initialView === "timeGridWeek"
      ? "timeGridDay"
      : initialView
    : initialView;

  return (
    <div className="flex flex-col gap-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <select
          className="h-8 rounded-md border border-input bg-background px-2 text-sm"
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
      <div className="fc-wrapper">
        <FullCalendar
          ref={calendarRef}
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          initialView={effectiveView}
          headerToolbar={{
            left: "prev,next today",
            center: "title",
            right: isMobile ? "timeGridDay,dayGridMonth" : "timeGridDay,timeGridWeek,dayGridMonth",
          }}
          slotMinTime="06:00:00"
          slotMaxTime="22:00:00"
          allDaySlot={false}
          selectable
          editable
          eventResizableFromStart
          selectMirror
          nowIndicator
          height="auto"
          events={events}
          select={handleSelect}
          eventClick={handleEventClick}
          eventDrop={handleEventDrop}
          eventResize={handleEventResize}
          datesSet={handleDatesSet}
          slotDuration="00:30:00"
          snapDuration="00:15:00"
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
