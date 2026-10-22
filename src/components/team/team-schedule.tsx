"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Clock, ExternalLink, Target, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { initials, personColour } from "@/components/calendar/gcal";
import { TeamDayGrid, type TeamBlock, type TeamMember } from "./team-day-grid";
import { TeamWeekTimeline } from "./team-week-timeline";
import { NoCompany } from "./no-company";
import { useIsMobile } from "@/hooks/use-mobile";

type View = "day" | "week";

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function mondayOf(d: Date) {
  const x = startOfDay(d);
  const dow = x.getDay();
  x.setDate(x.getDate() + (dow === 0 ? -6 : 1 - dow));
  return x;
}
function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
function fmtTime(iso: string) {
  return new Date(iso)
    .toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
    .replace(/\s?([AP])\.?M\.?/i, (_, p: string) => p.toLowerCase() + "m");
}

type PopoverState = { block: TeamBlock; x: number; y: number } | null;

export function TeamSchedule() {
  const isMobile = useIsMobile();
  const [view, setView] = useState<View>("day");
  const [anchor, setAnchor] = useState<Date | null>(null);
  const [now, setNow] = useState<Date | null>(null);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [blocks, setBlocks] = useState<TeamBlock[]>([]);
  const [meId, setMeId] = useState("");
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [noCompany, setNoCompany] = useState(false);
  const [popover, setPopover] = useState<PopoverState>(null);

  // Client-only clock (avoids hydration mismatch); ticks every minute
  useEffect(() => {
    const t = new Date();
    setNow(t);
    setAnchor(startOfDay(t));
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  const range = useMemo(() => {
    if (!anchor) return null;
    if (view === "day") return { start: anchor, end: addDays(anchor, 1) };
    const mon = mondayOf(anchor);
    return { start: mon, end: addDays(mon, 7) };
  }, [anchor, view]);

  const load = useCallback(
    async (quiet = false) => {
      if (!range) return;
      if (!quiet) setLoading(true);
      try {
        const params = new URLSearchParams({
          start: range.start.toISOString(),
          end: range.end.toISOString(),
        });
        const res = await fetch(`/api/team/calendar?${params}`);
        if (res.status === 403) {
          setNoCompany(true);
          return;
        }
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setError(data.error || "Could not load the team schedule");
          return;
        }
        const data = await res.json();
        setError(null);
        setMembers(data.members);
        setBlocks(data.blocks);
        setMeId(data.me?.id ?? "");
      } finally {
        if (!quiet) setLoading(false);
      }
    },
    [range],
  );

  useEffect(() => {
    load();
  }, [load]);

  // Keep "what everyone is doing now" fresh
  useEffect(() => {
    const id = setInterval(() => load(true), 2 * 60_000);
    return () => clearInterval(id);
  }, [load]);

  // Close the popover on Escape
  useEffect(() => {
    if (!popover) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setPopover(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [popover]);

  const colourIndex = useMemo(() => new Map(members.map((m, i) => [m.id, i])), [members]);
  const colourOf = useCallback(
    (userId: string) => personColour(colourIndex.get(userId) ?? 0),
    [colourIndex],
  );
  const memberById = useMemo(() => new Map(members.map((m) => [m.id, m])), [members]);
  const visibleMembers = members.filter((m) => !hidden.has(m.id));
  const visibleBlocks = blocks.filter((b) => !hidden.has(b.user_id));

  const hoursByMember = useMemo(() => {
    const map = new Map<string, number>();
    for (const b of blocks) {
      if (!b.done) continue;
      const h = (new Date(b.end).getTime() - new Date(b.start).getTime()) / 36e5;
      map.set(b.user_id, (map.get(b.user_id) ?? 0) + h);
    }
    return map;
  }, [blocks]);

  if (noCompany) return <NoCompany />;
  if (!anchor || !now) return null;

  function shift(n: number) {
    setPopover(null);
    setAnchor((a) => (a ? addDays(a, view === "day" ? n : n * 7) : a));
  }

  function toggle(id: string) {
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function openPopover(block: TeamBlock, x: number, y: number) {
    setPopover({ block, x, y });
  }

  const title =
    view === "day"
      ? anchor.toLocaleDateString(undefined, {
          weekday: "long",
          day: "numeric",
          month: "long",
          year: "numeric",
        })
      : (() => {
          const mon = mondayOf(anchor);
          const sun = addDays(mon, 6);
          const sameMonth = mon.getMonth() === sun.getMonth();
          return `${mon.toLocaleDateString(undefined, { day: "numeric", ...(sameMonth ? {} : { month: "short" }) })} – ${sun.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}`;
        })();

  const isTodayAnchor = anchor.toDateString() === now.toDateString();

  return (
    <div className="flex min-h-0 gap-4">
      {/* People (like Google Calendar's "Other calendars") */}
      {!isMobile && (
        <aside className="w-60 shrink-0 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">People</h2>
            <div className="flex gap-1 text-[11px]">
              <button
                type="button"
                className="rounded px-1.5 py-0.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                onClick={() => setHidden(new Set())}
              >
                All
              </button>
              <button
                type="button"
                className="rounded px-1.5 py-0.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                onClick={() =>
                  setHidden(new Set(members.filter((m) => m.id !== meId).map((m) => m.id)))
                }
              >
                Only me
              </button>
            </div>
          </div>
          <ul className="space-y-0.5">
            {members.map((m) => {
              const on = !hidden.has(m.id);
              const colour = colourOf(m.id);
              const hrs = Math.round((hoursByMember.get(m.id) ?? 0) * 10) / 10;
              return (
                <li key={m.id}>
                  <label className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 hover:bg-accent">
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={on}
                      onChange={() => toggle(m.id)}
                    />
                    <span
                      aria-hidden
                      className="flex h-4 w-4 shrink-0 items-center justify-center rounded-[3px] border-2"
                      style={{ borderColor: colour, background: on ? colour : "transparent" }}
                    >
                      {on && (
                        <svg viewBox="0 0 12 12" className="h-3 w-3 text-white">
                          <path
                            d="M2.5 6.2 5 8.6 9.6 3.6"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.8"
                          />
                        </svg>
                      )}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm">
                      {m.name}
                      {m.id === meId && (
                        <span className="ml-1 text-xs text-muted-foreground">(you)</span>
                      )}
                    </span>
                    {hrs > 0 && (
                      <span className="text-[11px] tabular-nums text-muted-foreground">{hrs}h</span>
                    )}
                  </label>
                </li>
              );
            })}
          </ul>
          <p className="px-2 text-[11px] leading-relaxed text-muted-foreground">
            Hours = completed blocks in the {view === "day" ? "selected day" : "selected week"}.
            Everyone in the company can see these schedules.
          </p>
        </aside>
      )}

      <div className="min-w-0 flex-1 space-y-3">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            className="h-9 rounded-full px-4"
            onClick={() => setAnchor(startOfDay(new Date()))}
            disabled={isTodayAnchor && view === "day"}
          >
            Today
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 rounded-full"
            onClick={() => shift(-1)}
            aria-label="Previous"
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 rounded-full"
            onClick={() => shift(1)}
            aria-label="Next"
          >
            <ChevronRight className="h-5 w-5" />
          </Button>
          <h2 className="ml-1 text-lg font-medium sm:text-xl">{title}</h2>
          {loading && <span className="text-xs text-muted-foreground">Loading…</span>}
          <div className="flex-1" />
          <div className="inline-flex rounded-full border p-0.5">
            {(["day", "week"] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => {
                  setPopover(null);
                  setView(v);
                }}
                className={cn(
                  "rounded-full px-4 py-1.5 text-sm transition-colors",
                  view === v
                    ? "bg-[#e8f0fe] font-medium text-[#174ea6]"
                    : "text-muted-foreground hover:bg-accent",
                )}
              >
                {v === "day" ? "Day" : "Week"}
              </button>
            ))}
          </div>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        {view === "day" ? (
          <TeamDayGrid
            members={visibleMembers}
            blocks={visibleBlocks}
            day={anchor}
            now={now}
            meId={meId}
            colourOf={colourOf}
            onBlockClick={(b, e) => openPopover(b, e.clientX, e.clientY)}
          />
        ) : (
          <TeamWeekTimeline
            members={visibleMembers}
            blocks={visibleBlocks}
            weekStart={mondayOf(anchor)}
            now={now}
            meId={meId}
            colourOf={colourOf}
            onBlockClick={(b, e) => openPopover(b, e.clientX, e.clientY)}
          />
        )}

        {/* Legend on mobile (no sidebar) */}
        {isMobile && (
          <div className="flex flex-wrap gap-2">
            {members.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => toggle(m.id)}
                className={cn(
                  "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs",
                  hidden.has(m.id) && "opacity-40",
                )}
              >
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: colourOf(m.id) }} />
                {m.name.split(" ")[0]}
              </button>
            ))}
          </div>
        )}
      </div>

      {popover && (
        <BlockPopover
          state={popover}
          member={memberById.get(popover.block.user_id)}
          colour={colourOf(popover.block.user_id)}
          isMe={popover.block.user_id === meId}
          now={now}
          onClose={() => setPopover(null)}
        />
      )}
    </div>
  );
}

function BlockPopover({
  state,
  member,
  colour,
  isMe,
  now,
  onClose,
}: {
  state: NonNullable<PopoverState>;
  member: TeamMember | undefined;
  colour: string;
  isMe: boolean;
  now: Date;
  onClose: () => void;
}) {
  const { block } = state;
  const width = 320;
  const left = Math.max(12, Math.min(state.x + 12, window.innerWidth - width - 12));
  const top = Math.max(12, Math.min(state.y - 20, window.innerHeight - 260));
  const start = new Date(block.start);
  const end = new Date(block.end);
  const status = block.done
    ? "Done"
    : start <= now && end > now
      ? "In progress"
      : end <= now
        ? "Not marked done"
        : "Planned";

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} aria-hidden />
      <div
        role="dialog"
        aria-label={block.title}
        className="fixed z-50 rounded-2xl border bg-background p-4 shadow-xl"
        style={{ left, top, width }}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-2 top-2 rounded-full p-1.5 text-muted-foreground hover:bg-accent"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>
        <div className="flex gap-3 pr-6">
          <span
            className="mt-1.5 h-3.5 w-3.5 shrink-0 rounded-[4px]"
            style={{ background: colour }}
          />
          <div className="min-w-0">
            <p className={cn("text-base font-medium leading-snug", block.done && "line-through")}>
              {block.title}
            </p>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {start.toLocaleDateString(undefined, {
                weekday: "long",
                day: "numeric",
                month: "long",
              })}
              {" · "}
              {fmtTime(block.start)} – {fmtTime(block.end)}
            </p>
          </div>
        </div>
        <div className="mt-3 space-y-2 text-sm">
          {member && (
            <div className="flex items-center gap-3">
              <span
                className="flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-semibold text-white"
                style={{ background: colour }}
              >
                {initials(member.name)}
              </span>
              <span>
                {member.name}{" "}
                <span className="text-xs capitalize text-muted-foreground">· {member.role}</span>
              </span>
            </div>
          )}
          {block.goal && (
            <div className="flex items-center gap-3">
              <Target className="h-4 w-4 text-muted-foreground" />
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full" style={{ background: block.goal.colour }} />
                {block.goal.title}
              </span>
            </div>
          )}
          <div className="flex items-center gap-3">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span>
              {status}
              {block.category ? ` · ${block.category}` : ""}
            </span>
          </div>
        </div>
        {member && (
          <Link
            href={isMe ? "/calendar" : `/team/${member.id}`}
            className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-[#1a73e8] hover:underline"
          >
            {isMe ? "Open my calendar" : `Open ${member.name.split(" ")[0]}'s schedule`}
            <ExternalLink className="h-3.5 w-3.5" />
          </Link>
        )}
      </div>
    </>
  );
}
