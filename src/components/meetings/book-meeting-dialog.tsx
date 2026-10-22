"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Link2, Loader2, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { initials, personColour } from "@/components/calendar/gcal";
import { busyByUser, clashes, suggestTimes, type BusyBlock } from "@/lib/availability";
import { fmtMinutes, fmtTime, fromInputs, toDateInput, toTimeInput } from "@/lib/format";
import { getBrowserTimeZone } from "@/lib/date-utils";
import { emitMeetingChanged } from "@/lib/app-events";

export type BookInitial = {
  /** Set when changing an existing meeting */
  meetingId?: string;
  title?: string;
  start?: Date;
  end?: Date;
  guestIds?: string[];
  agenda?: string | null;
  location?: string | null;
};

type Member = { id: string; name: string; role: string; team_id: string | null };
type Team = { id: string; name: string };
type CalendarData = {
  me: { id: string };
  org: { work_days: number[]; work_start: number; work_end: number };
  teams: Team[];
  members: Member[];
  blocks: (BusyBlock & { title: string })[];
};

const DURATIONS = [15, 30, 45, 60, 90];
const DAY_MS = 24 * 60 * 60 * 1000;

function nextHalfHour(from = new Date()) {
  const d = new Date(from);
  d.setSeconds(0, 0);
  d.setMinutes(d.getMinutes() < 30 ? 30 : 60);
  return d;
}

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function initialTimes(initial?: BookInitial) {
  const start = initial?.start ?? nextHalfHour();
  const end = initial?.end ?? new Date(start.getTime() + 30 * 60_000);
  return {
    date: toDateInput(start),
    time: toTimeInput(start),
    duration: Math.max(5, Math.round((end.getTime() - start.getTime()) / 60_000)),
    openedAt: Date.now(),
  };
}

export function BookMeetingDialog({
  open,
  onOpenChange,
  initial,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial?: BookInitial;
  onSaved?: () => void;
}) {
  const editing = !!initial?.meetingId;
  const titleRef = useRef<HTMLInputElement>(null);
  // A fresh form every time the dialog opens, starting from `initial`
  const [session, setSession] = useState(0);
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setSession((n) => n + 1);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-h-[calc(100svh-2rem)] overflow-y-auto sm:max-w-3xl"
        initialFocus={titleRef}
      >
        <DialogTitle className="text-lg font-semibold">
          {editing ? "Change meeting" : "Book a meeting"}
        </DialogTitle>
        <DialogDescription className="sr-only">
          Pick a time, add colleagues and send them an invite.
        </DialogDescription>
        <BookMeetingForm
          key={session}
          initial={initial}
          titleRef={titleRef}
          onSaved={onSaved}
          onClose={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

function BookMeetingForm({
  initial,
  titleRef,
  onSaved,
  onClose,
}: {
  initial?: BookInitial;
  titleRef: React.RefObject<HTMLInputElement | null>;
  onSaved?: () => void;
  onClose: () => void;
}) {
  const editing = !!initial?.meetingId;
  const [init] = useState(() => initialTimes(initial));
  const [title, setTitle] = useState(initial?.title ?? "");
  const [date, setDate] = useState(init.date);
  const [time, setTime] = useState(init.time);
  const [duration, setDuration] = useState(init.duration);
  const [guestIds, setGuestIds] = useState<string[]>(initial?.guestIds ?? []);
  const [location, setLocation] = useState(initial?.location ?? "");
  const [agenda, setAgenda] = useState(initial?.agenda ?? "");
  const [query, setQuery] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<CalendarData | null>(null);
  const [loadedFrom, setLoadedFrom] = useState<number | null>(null);

  const start = useMemo(() => fromInputs(date, time), [date, time]);
  const end = useMemo(
    () => (start ? new Date(start.getTime() + duration * 60_000) : null),
    [start, duration],
  );

  // Everyone's calendar for the chosen day and the week after (for suggestions)
  useEffect(() => {
    if (!start) return;
    const from = startOfDay(start).getTime();
    if (loadedFrom !== null && from >= loadedFrom && from < loadedFrom + 6 * DAY_MS && data) return;
    let alive = true;
    const params = new URLSearchParams({
      start: new Date(from).toISOString(),
      end: new Date(from + 8 * DAY_MS).toISOString(),
    });
    fetch(`/api/team/calendar?${params}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: CalendarData | null) => {
        if (!alive || !d) return;
        setData(d);
        setLoadedFrom(from);
      });
    return () => {
      alive = false;
    };
  }, [start, loadedFrom, data]);

  const meId = data?.me.id ?? "";
  const memberById = useMemo(() => new Map((data?.members ?? []).map((m) => [m.id, m])), [data]);
  const colourOf = (id: string) =>
    personColour(
      Math.max(
        0,
        (data?.members ?? []).findIndex((m) => m.id === id),
      ),
    );
  const teamName = (id: string | null) => data?.teams.find((t) => t.id === id)?.name ?? null;

  const busy = useMemo(
    () => busyByUser(data?.blocks ?? [], initial?.meetingId ?? null),
    [data, initial?.meetingId],
  );
  const participants = useMemo(() => (meId ? [meId, ...guestIds] : guestIds), [meId, guestIds]);
  const slot = start && end ? { start: start.getTime(), end: end.getTime() } : null;
  const clashList = slot ? clashes(busy, participants, slot) : [];

  const suggestions = useMemo(() => {
    if (!data || !start || guestIds.length === 0) return [];
    const from = new Date(Math.max(init.openedAt, startOfDay(start).getTime()));
    return suggestTimes({
      busy,
      userIds: participants,
      durationMin: duration,
      from,
      workDays: data.org.work_days,
      workStart: data.org.work_start,
      workEnd: data.org.work_end,
      limit: 4,
      days: 7,
    });
  }, [data, start, guestIds.length, busy, participants, duration, init.openedAt]);

  // The strip shows working hours, widened to include the chosen time
  const dayStart = start ? startOfDay(start).getTime() : 0;
  const stripStartMin = Math.min(
    data?.org.work_start ?? 540,
    start ? Math.floor((start.getTime() - dayStart) / 3_600_000) * 60 : 540,
  );
  const stripEndMin = Math.max(
    data?.org.work_end ?? 1080,
    end ? Math.min(1440, Math.ceil((end.getTime() - dayStart) / 3_600_000) * 60) : 1080,
  );
  const stripLen = Math.max(60, stripEndMin - stripStartMin);
  const pct = (ms: number) => ((ms - dayStart) / 60_000 - stripStartMin) / stripLen;
  const hourMarks: number[] = [];
  for (let m = Math.ceil(stripStartMin / 60) * 60; m <= stripStartMin + stripLen; m += 60) {
    hourMarks.push(m);
  }
  const markPct = (m: number) => `${((m - stripStartMin) / stripLen) * 100}%`;

  const candidates = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (data?.members ?? [])
      .filter((m) => m.id !== meId && !guestIds.includes(m.id))
      .filter((m) => !q || m.name.toLowerCase().includes(q))
      .slice(0, 8);
  }, [data, meId, guestIds, query]);

  const teamChips = useMemo(
    () =>
      (data?.teams ?? [])
        .map((t) => ({
          ...t,
          ids: (data?.members ?? [])
            .filter((m) => m.team_id === t.id && m.id !== meId)
            .map((m) => m.id),
        }))
        .filter((t) => t.ids.length > 0 && t.ids.some((id) => !guestIds.includes(id))),
    [data, meId, guestIds],
  );

  function addGuest(id: string) {
    setGuestIds((g) => (g.includes(id) ? g : [...g, id]));
    setQuery("");
    // Close the list so it doesn't cover the controls below; typing opens it again
    setPickerOpen(false);
  }

  function setEndTime(value: string) {
    if (!start) return;
    const e = fromInputs(date, value);
    if (!e) return;
    const mins = Math.round((e.getTime() - start.getTime()) / 60_000);
    if (mins > 0) setDuration(mins);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!title.trim()) return setError("Add a title");
    if (!start || !end) return setError("Pick a date and time");
    if (guestIds.length === 0) return setError("Add at least one guest");

    setSaving(true);
    const body = {
      title: title.trim(),
      start: start.toISOString(),
      end: end.toISOString(),
      guest_ids: guestIds,
      agenda: agenda.trim() || null,
      location: location.trim() || null,
      tz: getBrowserTimeZone(),
    };
    const res = await fetch(editing ? `/api/meetings/${initial!.meetingId}` : "/api/meetings", {
      method: editing ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setSaving(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error || "Couldn’t save the meeting");
      return;
    }
    toast.success(
      editing
        ? "Meeting updated"
        : `Invite sent to ${guestIds.length === 1 ? (memberById.get(guestIds[0])?.name ?? "1 person") : `${guestIds.length} people`}`,
    );
    emitMeetingChanged();
    onSaved?.();
    onClose();
  }

  const guestNames = guestIds.map((id) => memberById.get(id)?.name.split(" ")[0] ?? "Guest");

  return (
    <form onSubmit={submit} className="grid gap-6 md:grid-cols-[minmax(0,1.08fr)_minmax(0,1fr)]">
      {/* Left: the form */}
      <div className="space-y-4">
        <label className="block space-y-1.5">
          <span className="text-[13px] font-medium">Title</span>
          <Input
            ref={titleRef}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Q4 campaign sync"
            maxLength={200}
            className="h-10 text-[15px]"
          />
        </label>

        <div className="space-y-2">
          <span className="text-[13px] font-medium">When</span>
          <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2">
            <Input
              type="date"
              aria-label="Date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="col-span-3 h-9"
            />
            <Input
              type="time"
              aria-label="Start time"
              step={300}
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="h-9"
            />
            <span className="text-muted-foreground">–</span>
            <Input
              type="time"
              aria-label="End time"
              step={300}
              value={end ? toTimeInput(end) : ""}
              onChange={(e) => setEndTime(e.target.value)}
              className="h-9"
            />
          </div>
          <div role="group" aria-label="Length" className="flex flex-wrap gap-1.5">
            {DURATIONS.map((d) => (
              <button
                key={d}
                type="button"
                aria-pressed={duration === d}
                onClick={() => setDuration(d)}
                className={cn(
                  "h-7 rounded-full border px-3 text-xs transition-colors",
                  duration === d
                    ? "border-[#c6dafc] bg-[#e8f0fe] font-medium text-[#174ea6]"
                    : "hover:bg-accent",
                )}
              >
                {d < 60 ? `${d} min` : d === 60 ? "1 hour" : `${d / 60} hours`}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <span className="text-[13px] font-medium">Guests</span>
          <div className="relative">
            <div className="flex min-h-10 flex-wrap items-center gap-1.5 rounded-lg border px-1.5 py-1.5 focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50">
              {guestIds.map((id) => {
                const m = memberById.get(id);
                const clash = clashList.some((c) => c.userId === id);
                return (
                  <span
                    key={id}
                    className={cn(
                      "flex h-7 items-center gap-1.5 rounded-full pl-0.5 pr-1 text-[13px]",
                      clash ? "bg-[#fef7e0]" : "bg-muted",
                    )}
                  >
                    <span
                      className="flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-semibold text-white"
                      style={{ background: colourOf(id) }}
                    >
                      {initials(m?.name ?? "?")}
                    </span>
                    {m?.name ?? "…"}
                    <span className={cn("text-xs", clash ? "text-[#8a4b00]" : "text-[#137333]")}>
                      {clash ? "busy" : "free"}
                    </span>
                    <button
                      type="button"
                      aria-label={`Remove ${m?.name ?? "guest"}`}
                      onClick={() => setGuestIds((g) => g.filter((x) => x !== id))}
                      className="rounded-full p-0.5 text-muted-foreground hover:bg-background"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </span>
                );
              })}
              <input
                aria-label="Add guests"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setPickerOpen(true);
                }}
                onFocus={() => setPickerOpen(true)}
                onClick={() => setPickerOpen(true)}
                onBlur={() => setTimeout(() => setPickerOpen(false), 150)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    if (pickerOpen && candidates[0]) addGuest(candidates[0].id);
                  } else if (e.key === "Escape" && pickerOpen) {
                    // Close the list, not the whole dialog
                    e.preventDefault();
                    e.stopPropagation();
                    setPickerOpen(false);
                  } else if (e.key === "Backspace" && !query && guestIds.length) {
                    setGuestIds((g) => g.slice(0, -1));
                  }
                }}
                placeholder={guestIds.length ? "Add more" : "Add people"}
                className="h-7 min-w-24 flex-1 bg-transparent px-1.5 text-sm outline-none"
              />
            </div>
            {pickerOpen && candidates.length > 0 && (
              <ul
                role="listbox"
                className="absolute inset-x-0 top-full z-20 mt-1 max-h-60 overflow-y-auto rounded-lg border bg-popover p-1 shadow-lg"
              >
                {candidates.map((m) => (
                  <li key={m.id}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={false}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => addGuest(m.id)}
                      className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent"
                    >
                      <span
                        className="flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-semibold text-white"
                        style={{ background: colourOf(m.id) }}
                      >
                        {initials(m.name)}
                      </span>
                      <span className="min-w-0 flex-1 truncate">{m.name}</span>
                      {teamName(m.team_id) && (
                        <span className="text-xs text-muted-foreground">{teamName(m.team_id)}</span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          {teamChips.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
              Add a whole team:
              {teamChips.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setGuestIds((g) => [...new Set([...g, ...t.ids])])}
                  className="h-6 rounded-full border px-2.5 text-foreground hover:bg-accent"
                >
                  {t.name} · {t.ids.length}
                </button>
              ))}
            </div>
          )}
        </div>

        <label className="block space-y-1.5">
          <span className="text-[13px] font-medium">Meeting link or room</span>
          <span className="flex items-center gap-2 rounded-lg border px-2.5 focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50">
            <Link2 className="h-4 w-4 shrink-0 text-muted-foreground" />
            <input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Paste a Google Meet or Zoom link, or a room name"
              maxLength={500}
              className="h-9 min-w-0 flex-1 bg-transparent text-sm outline-none"
            />
          </span>
        </label>

        <label className="block space-y-1.5">
          <span className="text-[13px] font-medium">
            Agenda <span className="font-normal text-muted-foreground">(optional)</span>
          </span>
          <Textarea
            value={agenda}
            onChange={(e) => setAgenda(e.target.value)}
            rows={3}
            maxLength={4000}
            placeholder="What’s it about?"
          />
        </label>
      </div>

      {/* Right: who's free */}
      <div className="space-y-4">
        <section
          aria-label="Availability"
          className="space-y-3 rounded-xl bg-[#f8f9fa] p-4 dark:bg-muted/40"
        >
          <div className="flex items-baseline justify-between gap-2">
            <h3 className="text-sm font-semibold">
              Who’s free
              {start && (
                <span className="font-normal text-muted-foreground">
                  {" "}
                  ·{" "}
                  {start.toLocaleDateString(undefined, {
                    weekday: "short",
                    day: "numeric",
                    month: "short",
                  })}
                </span>
              )}
            </h3>
            <span className="text-[11px] text-muted-foreground">
              {fmtMinutes(stripStartMin)} – {fmtMinutes(stripEndMin)}
            </span>
          </div>

          {!data ? (
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading calendars…
            </p>
          ) : (
            <div className="relative space-y-2">
              {participants.map((id) => {
                const m = memberById.get(id);
                const intervals = (busy.get(id) ?? []).filter(
                  (i) => i.end > dayStart && i.start < dayStart + DAY_MS,
                );
                return (
                  <div key={id} className="flex items-center gap-2">
                    <span className="w-24 shrink-0 truncate text-xs">
                      {id === meId ? "You" : (m?.name ?? "…")}
                    </span>
                    <span className="relative h-6 flex-1 overflow-hidden rounded bg-[#e8eaed] dark:bg-muted">
                      {hourMarks.map((m) => (
                        <span
                          key={m}
                          aria-hidden
                          className="absolute inset-y-0 w-px bg-white/80 dark:bg-background/50"
                          style={{ left: markPct(m) }}
                        />
                      ))}
                      {intervals.map((i, k) => {
                        const l = Math.max(0, pct(i.start));
                        const r = Math.min(1, pct(i.end));
                        if (r <= 0 || l >= 1 || r <= l) return null;
                        const hit = slot && i.start < slot.end && slot.start < i.end;
                        return (
                          <span
                            key={k}
                            className={cn(
                              "absolute inset-y-0 rounded-[3px]",
                              hit ? "bg-[#e37400]" : "bg-[#80868b]",
                            )}
                            style={{ left: `${l * 100}%`, width: `${(r - l) * 100}%` }}
                          />
                        );
                      })}
                    </span>
                  </div>
                );
              })}
              {slot && pct(slot.end) > 0 && pct(slot.start) < 1 && (
                <span
                  aria-hidden
                  className="pointer-events-none absolute -inset-y-1 rounded border-2 border-[#1967d2] bg-[#1967d2]/15"
                  style={{
                    left: `calc(6.5rem + (100% - 6.5rem) * ${Math.max(0, pct(slot.start))})`,
                    width: `calc((100% - 6.5rem) * ${Math.min(1, pct(slot.end)) - Math.max(0, pct(slot.start))})`,
                  }}
                />
              )}
            </div>
          )}
          {data && (
            <div
              aria-hidden
              className="relative ml-[6.5rem] h-3 text-[10px] leading-none text-muted-foreground"
            >
              {hourMarks
                .filter((m) => (m / 60) % 3 === 0)
                .map((m) => (
                  <span key={m} className="absolute -translate-x-1/2" style={{ left: markPct(m) }}>
                    {(m / 60) % 12 || 12}
                    {m < 720 || m === 1440 ? "am" : "pm"}
                  </span>
                ))}
            </div>
          )}
          <div className="flex flex-wrap gap-3 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-[#80868b]" /> Busy
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-[#e37400]" /> Clashes
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm border-2 border-[#1967d2]" /> Your pick
            </span>
          </div>
        </section>

        {clashList.length > 0 && (
          <div className="flex gap-2.5 rounded-lg bg-[#fef7e0] px-3 py-2.5 text-[13px] leading-snug text-[#5c3b00]">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#b06000]" />
            <span>
              {clashList
                .map((c) =>
                  c.userId === meId
                    ? `You’re busy ${fmtTime(new Date(c.interval.start))} – ${fmtTime(new Date(c.interval.end))}`
                    : `${memberById.get(c.userId)?.name ?? "A guest"} is busy ${fmtTime(new Date(c.interval.start))} – ${fmtTime(new Date(c.interval.end))}`,
                )
                .join(". ")}
              . You can still send it — guests can accept or decline.
            </span>
          </div>
        )}

        {guestIds.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-sm font-semibold">Times when everyone is free</h3>
            {suggestions.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No shared free time in working hours over the next week.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {suggestions.map((s) => {
                  const sameDay = start && s.toDateString() === start.toDateString();
                  const today = s.toDateString() === new Date(init.openedAt).toDateString();
                  const label =
                    `${today ? "Today" : sameDay ? "" : s.toLocaleDateString(undefined, { weekday: "short", day: "numeric" })} ${fmtTime(s)}`.trim();
                  return (
                    <button
                      key={s.getTime()}
                      type="button"
                      onClick={() => {
                        setDate(toDateInput(s));
                        setTime(toTimeInput(s));
                      }}
                      className="h-8 rounded-lg border border-[#c6dafc] px-3 text-[13px] font-medium text-[#174ea6] hover:bg-[#e8f0fe]"
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3 border-t pt-4 md:col-span-2">
        <p className="text-[13px] text-muted-foreground">
          {guestIds.length
            ? `${guestNames.join(", ")} ${guestIds.length === 1 ? "gets" : "get"} a notification and can accept or decline.`
            : "Add the people you want to meet."}
          {editing && " Changing the time asks everyone again."}
        </p>
        {error && <p className="w-full text-sm text-destructive md:order-last">{error}</p>}
        <div className="ml-auto flex gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={saving}
            className="rounded-full bg-[#1967d2] px-5 text-white hover:bg-[#174ea6]"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              !editing && <Plus className="h-4 w-4" />
            )}
            {editing ? "Save changes" : "Send invite"}
          </Button>
        </div>
      </div>
    </form>
  );
}
