"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Check, CircleHelp, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { initials } from "@/components/calendar/gcal";

export type TeamMember = {
  id: string;
  name: string;
  role: string;
  manager_id?: string | null;
  team_id?: string | null;
};
export type TeamBlock = {
  id: string;
  user_id: string;
  title: string;
  start: string;
  end: string;
  done: boolean;
  category: string | null;
  goal: { title: string; colour: string } | null;
  meeting_id?: string | null;
  rsvp?: string | null;
  organiser_id?: string | null;
};
export type TeamGroup = { teamId: string | null; teamName: string | null; members: TeamMember[] };
export type SlotSelection = { memberId: string; start: Date; end: Date };

const HOUR = 48; // px per hour, same as the main calendar
const DAY_MIN = 24 * 60;
const TEAM_ROW = 30; // px, height of the team names row

type Placed = { block: TeamBlock; top: number; height: number; lane: number; lanes: number };

/** Lay out one person's blocks for the day, side by side when they overlap */
function placeBlocks(blocks: TeamBlock[], dayStart: Date): Placed[] {
  const items = blocks
    .map((b) => {
      const s = (new Date(b.start).getTime() - dayStart.getTime()) / 60000;
      const e = (new Date(b.end).getTime() - dayStart.getTime()) / 60000;
      return { block: b, s: Math.max(0, s), e: Math.min(DAY_MIN, e) };
    })
    .filter((x) => x.e > x.s)
    .sort((a, b) => a.s - b.s || b.e - a.e);

  const placed: Placed[] = [];
  let cluster: { item: (typeof items)[number]; lane: number }[] = [];
  let clusterEnd = -1;

  const flush = () => {
    const lanes = Math.max(1, ...cluster.map((c) => c.lane + 1));
    for (const c of cluster) {
      placed.push({
        block: c.item.block,
        top: (c.item.s / 60) * HOUR,
        height: Math.max(((c.item.e - c.item.s) / 60) * HOUR - 2, 20),
        lane: c.lane,
        lanes,
      });
    }
    cluster = [];
  };

  for (const item of items) {
    if (cluster.length && item.s >= clusterEnd) flush();
    const laneEnds: number[] = [];
    for (const c of cluster) laneEnds[c.lane] = Math.max(laneEnds[c.lane] ?? -1, c.item.e);
    let lane = laneEnds.findIndex((end) => end <= item.s);
    if (lane === -1) lane = laneEnds.length;
    cluster.push({ item, lane });
    clusterEnd = Math.max(clusterEnd, item.e);
  }
  if (cluster.length) flush();
  return placed;
}

function hourLabel(h: number) {
  if (h === 0) return "";
  const suffix = h < 12 ? "AM" : "PM";
  const hh = h % 12 === 0 ? 12 : h % 12;
  return `${hh} ${suffix}`;
}

function fmtTime(iso: string | Date) {
  return new Date(iso)
    .toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
    .replace(/\s?([AP])\.?M\.?/i, (_, p: string) => p.toLowerCase() + "m");
}

type Drag = {
  memberId: string;
  anchorMin: number;
  curMin: number;
  pointerType: string;
  x0: number;
  y0: number;
  moved: boolean;
};

export function TeamDayGrid({
  groups,
  blocks,
  day,
  now,
  meId,
  colourOf,
  onBlockClick,
  selection,
  onSelectSlot,
}: {
  groups: TeamGroup[];
  blocks: TeamBlock[];
  day: Date; // local midnight
  now: Date;
  meId: string;
  colourOf: (userId: string) => string;
  onBlockClick: (block: TeamBlock, e: React.MouseEvent) => void;
  /** The time someone picked to book (drawn as a dashed blue box) */
  selection?: SlotSelection | null;
  /** Drag (or click) on free time in someone's column */
  onSelectSlot?: (slot: SlotSelection, anchor: DOMRect) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const isToday = day.toDateString() === now.toDateString();
  const nowMin = (now.getTime() - day.getTime()) / 60000;
  const members = useMemo(() => groups.flatMap((g) => g.members), [groups]);
  const showTeams = groups.some((g) => g.teamName);

  const byMember = useMemo(() => {
    const map = new Map<string, TeamBlock[]>();
    for (const b of blocks) {
      if (!map.has(b.user_id)) map.set(b.user_id, []);
      map.get(b.user_id)!.push(b);
    }
    return map;
  }, [blocks]);

  // Scroll to the working day (or around now) when the day changes
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const h = new Date().getHours();
    let start = 8;
    if (h < 8) start = Math.max(0, h - 1);
    else if (h >= 19) start = Math.min(h - 6, 16);
    // A little above the hour so its label isn't hidden under the sticky header
    el.scrollTop = Math.max(0, start * HOUR - 12);
  }, [day]);

  const cols = Math.max(1, members.length);
  const headerTop = showTeams ? TEAM_ROW : 0;

  function minuteAt(e: React.PointerEvent, el: HTMLElement) {
    const y = e.clientY - el.getBoundingClientRect().top;
    return Math.max(0, Math.min(DAY_MIN - 15, Math.floor(((y / HOUR) * 60) / 15) * 15));
  }

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>, memberId: string) {
    if (!onSelectSlot || e.button !== 0) return;
    if ((e.target as HTMLElement).closest("button,a")) return;
    const m = minuteAt(e, e.currentTarget);
    if (e.pointerType === "mouse") e.currentTarget.setPointerCapture(e.pointerId);
    setDrag({
      memberId,
      anchorMin: m,
      curMin: m,
      pointerType: e.pointerType,
      x0: e.clientX,
      y0: e.clientY,
      moved: false,
    });
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!drag || drag.pointerType !== "mouse") return;
    const m = minuteAt(e, e.currentTarget);
    const moved = drag.moved || Math.abs(e.clientY - drag.y0) > 4;
    if (m !== drag.curMin || moved !== drag.moved) setDrag({ ...drag, curMin: m, moved });
  }

  function onPointerUp(e: React.PointerEvent<HTMLDivElement>) {
    if (!drag || !onSelectSlot) return;
    const d = drag;
    setDrag(null);
    // On touch screens a drag is a scroll, not a selection
    if (
      d.pointerType !== "mouse" &&
      (Math.abs(e.clientY - d.y0) > 8 || Math.abs(e.clientX - d.x0) > 8)
    ) {
      return;
    }
    let s: number;
    let en: number;
    if (d.moved) {
      s = Math.min(d.anchorMin, d.curMin);
      en = Math.max(d.anchorMin, d.curMin) + 15;
    } else {
      s = Math.floor(d.anchorMin / 30) * 30;
      en = s + 30;
    }
    const start = new Date(day);
    start.setMinutes(s);
    const end = new Date(day);
    end.setMinutes(Math.min(en, DAY_MIN));
    const rect = e.currentTarget.getBoundingClientRect();
    const anchor = new DOMRect(
      rect.left,
      rect.top + (s / 60) * HOUR,
      rect.width,
      ((en - s) / 60) * HOUR,
    );
    onSelectSlot({ memberId: d.memberId, start, end }, anchor);
  }

  const dragBox =
    drag && drag.pointerType === "mouse" && drag.moved
      ? {
          memberId: drag.memberId,
          top: (Math.min(drag.anchorMin, drag.curMin) / 60) * HOUR,
          height: ((Math.abs(drag.curMin - drag.anchorMin) + 15) / 60) * HOUR,
        }
      : null;

  return (
    <div
      ref={scrollRef}
      className="gcal team-day relative h-[calc(100svh-14rem)] min-h-[420px] overflow-auto rounded-xl border bg-background"
    >
      <div
        className="grid min-w-full"
        style={{ gridTemplateColumns: `56px repeat(${cols}, minmax(168px, 1fr))` }}
      >
        {/* Team names row */}
        {showTeams && (
          <>
            <div className="sticky top-0 left-0 z-30 bg-background" style={{ height: TEAM_ROW }} />
            {groups.map((g) => (
              <div
                key={g.teamId ?? "none"}
                className="sticky top-0 z-20 flex items-end border-l bg-background px-3 pb-0.5 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase"
                style={{ gridColumn: `span ${Math.max(1, g.members.length)}`, height: TEAM_ROW }}
              >
                <span className="truncate">{g.teamName ?? "No team"}</span>
              </div>
            ))}
          </>
        )}

        {/* People row */}
        <div className="sticky left-0 z-30 border-b bg-background" style={{ top: headerTop }} />
        {members.map((m) => {
          const mine = byMember.get(m.id) ?? [];
          const doneHours =
            Math.round(
              mine
                .filter((b) => b.done)
                .reduce(
                  (sum, b) =>
                    sum + (new Date(b.end).getTime() - new Date(b.start).getTime()) / 36e5,
                  0,
                ) * 10,
            ) / 10;
          const current = isToday
            ? mine.find(
                (b) => b.rsvp !== "pending" && new Date(b.start) <= now && new Date(b.end) > now,
              )
            : undefined;
          const colour = colourOf(m.id);
          return (
            <div
              key={m.id}
              className="sticky z-20 flex items-center gap-2 border-b border-l bg-background px-3 py-2.5"
              style={{ top: headerTop }}
            >
              <span
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
                style={{ background: colour }}
              >
                {initials(m.name)}
              </span>
              <div className="min-w-0 flex-1">
                <Link
                  href={m.id === meId ? "/calendar" : `/team/${m.id}`}
                  className="block truncate text-sm font-medium hover:underline"
                >
                  {m.name}
                  {m.id === meId && (
                    <span className="ml-1 text-xs text-muted-foreground">(you)</span>
                  )}
                </Link>
                <p className="truncate text-[11px] text-muted-foreground">
                  {isToday ? (
                    current ? (
                      <>
                        <span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-green-500 align-middle" />
                        {current.meeting_id ? "In a meeting" : `Now: ${current.title}`}
                      </>
                    ) : (
                      "Free now"
                    )
                  ) : (
                    <span className="capitalize">{m.role}</span>
                  )}
                  {doneHours > 0 && <> · {doneHours}h done</>}
                </p>
              </div>
            </div>
          );
        })}

        {/* Hour gutter */}
        <div className="sticky left-0 z-10 bg-background" style={{ height: 24 * HOUR }}>
          {Array.from({ length: 24 }, (_, h) => (
            <span
              key={h}
              className="gcal-slot-label absolute right-2"
              style={{ top: h * HOUR - 6 }}
            >
              {hourLabel(h)}
            </span>
          ))}
        </div>

        {/* One column per person */}
        {members.map((m, colIndex) => {
          const placed = placeBlocks(byMember.get(m.id) ?? [], day);
          const colour = colourOf(m.id);
          const sel =
            selection &&
            selection.memberId === m.id &&
            selection.start.toDateString() === day.toDateString()
              ? {
                  top: ((selection.start.getTime() - day.getTime()) / 3_600_000) * HOUR,
                  height:
                    ((selection.end.getTime() - selection.start.getTime()) / 3_600_000) * HOUR,
                }
              : null;
          return (
            <div
              key={m.id}
              className={cn("team-day-col relative border-l", onSelectSlot && "cursor-cell")}
              style={{ height: 24 * HOUR }}
              onPointerDown={(e) => onPointerDown(e, m.id)}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={() => setDrag(null)}
            >
              {placed.map(({ block, top, height, lane, lanes }) => {
                const isNow = isToday && new Date(block.start) <= now && new Date(block.end) > now;
                const short = height < 34;
                const pending = block.rsvp === "pending";
                const meeting = !!block.meeting_id;
                const icon = pending ? (
                  <CircleHelp className="mt-px h-3 w-3 shrink-0" strokeWidth={2.5} />
                ) : meeting ? (
                  <Users className="mt-px h-3 w-3 shrink-0" strokeWidth={2.5} />
                ) : null;
                return (
                  <button
                    key={block.id}
                    type="button"
                    onClick={(e) => onBlockClick(block, e)}
                    className={cn(
                      "team-block absolute overflow-hidden rounded-md px-2 text-left shadow-sm transition-[filter] hover:brightness-95 focus-visible:outline-2 focus-visible:outline-offset-1",
                      short ? "py-0.5" : "py-1",
                      pending ? "border-[1.5px] border-dashed bg-background" : "text-white",
                      block.done && "opacity-60",
                      isNow && !pending && "ring-2 ring-offset-1 ring-[#1a73e8]",
                    )}
                    style={{
                      top: top + 1,
                      height,
                      left: `calc(${(lane / lanes) * 100}% + 2px)`,
                      width: `calc(${100 / lanes}% - 6px)`,
                      ...(pending
                        ? { borderColor: colour, color: colour }
                        : { background: colour }),
                    }}
                    title={`${m.name}: ${block.title} (${fmtTime(block.start)} – ${fmtTime(block.end)})${pending ? " · invited, no reply yet" : ""}`}
                  >
                    {short ? (
                      <div className="flex items-center gap-1 truncate text-[12px] leading-tight">
                        {block.done ? <Check className="h-3 w-3 shrink-0" strokeWidth={3} /> : icon}
                        <span
                          className={cn("truncate font-semibold", block.done && "line-through")}
                        >
                          {block.title}
                        </span>
                        <span className="shrink-0 opacity-90">, {fmtTime(block.start)}</span>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-start gap-1 text-[12px] font-semibold leading-tight">
                          {block.done ? (
                            <Check className="mt-px h-3 w-3 shrink-0" strokeWidth={3} />
                          ) : (
                            icon
                          )}
                          <span className={cn("line-clamp-2", block.done && "line-through")}>
                            {block.title}
                          </span>
                        </div>
                        <div className="text-[11px] leading-tight opacity-90">
                          {fmtTime(block.start)} – {fmtTime(block.end)}
                        </div>
                        {height > 64 && (pending || block.goal) && (
                          <div className="truncate text-[11px] leading-tight opacity-85">
                            {pending ? "Invited · no reply yet" : block.goal?.title}
                          </div>
                        )}
                      </>
                    )}
                  </button>
                );
              })}

              {/* The time being booked */}
              {(sel || (dragBox && dragBox.memberId === m.id)) && (
                <div
                  className="pointer-events-none absolute inset-x-0.5 z-[5] rounded-md border-2 border-[#1967d2] bg-[#e8f0fe]/90 px-2 py-0.5 text-[12px] font-medium text-[#174ea6] shadow-sm"
                  style={
                    dragBox && dragBox.memberId === m.id
                      ? { top: dragBox.top, height: Math.max(dragBox.height, 18) }
                      : { top: sel!.top, height: Math.max(sel!.height, 18) }
                  }
                >
                  {sel && selection && !dragBox && (
                    <span className="block truncate">
                      {fmtTime(selection.start)} – {fmtTime(selection.end)}
                    </span>
                  )}
                </div>
              )}

              {isToday && nowMin >= 0 && nowMin <= DAY_MIN && (
                <div
                  className="pointer-events-none absolute inset-x-0 z-10"
                  style={{ top: (nowMin / 60) * HOUR }}
                >
                  <div className="h-0.5 bg-[#ea4335]" />
                  {colIndex === 0 && (
                    <div className="absolute -left-1.5 -top-[5px] h-3 w-3 rounded-full bg-[#ea4335]" />
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {members.length === 0 && (
        <p className="p-8 text-center text-sm text-muted-foreground">
          Select people on the left to see their schedules.
        </p>
      )}
    </div>
  );
}
