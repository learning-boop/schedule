"use client";

import { useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { initials } from "@/components/calendar/gcal";

export type TeamMember = { id: string; name: string; role: string; manager_id?: string | null };
export type TeamBlock = {
  id: string;
  user_id: string;
  title: string;
  start: string;
  end: string;
  done: boolean;
  category: string | null;
  goal: { title: string; colour: string } | null;
};

const HOUR = 48; // px per hour, same as the main calendar
const DAY_MIN = 24 * 60;

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

function fmtTime(iso: string) {
  return new Date(iso)
    .toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
    .replace(/\s?([AP])\.?M\.?/i, (_, p: string) => p.toLowerCase() + "m");
}

export function TeamDayGrid({
  members,
  blocks,
  day,
  now,
  meId,
  colourOf,
  onBlockClick,
}: {
  members: TeamMember[];
  blocks: TeamBlock[];
  day: Date; // local midnight
  now: Date;
  meId: string;
  colourOf: (userId: string) => string;
  onBlockClick: (block: TeamBlock, e: React.MouseEvent) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const isToday = day.toDateString() === now.toDateString();
  const nowMin = (now.getTime() - day.getTime()) / 60000;

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
    el.scrollTop = start * HOUR;
  }, [day]);

  const cols = Math.max(1, members.length);

  return (
    <div
      ref={scrollRef}
      className="gcal team-day relative h-[calc(100svh-11.5rem)] min-h-[420px] overflow-auto rounded-xl border bg-background"
    >
      <div
        className="grid min-w-full"
        style={{ gridTemplateColumns: `56px repeat(${cols}, minmax(168px, 1fr))` }}
      >
        {/* Header row */}
        <div className="sticky top-0 left-0 z-30 border-b bg-background" />
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
            ? mine.find((b) => new Date(b.start) <= now && new Date(b.end) > now)
            : undefined;
          const colour = colourOf(m.id);
          return (
            <div
              key={m.id}
              className="sticky top-0 z-20 flex items-center gap-2 border-b border-l bg-background px-3 py-2.5"
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
                        Now: {current.title}
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
          return (
            <div
              key={m.id}
              className="team-day-col relative border-l"
              style={{ height: 24 * HOUR }}
            >
              {placed.map(({ block, top, height, lane, lanes }) => {
                const isNow = isToday && new Date(block.start) <= now && new Date(block.end) > now;
                const short = height < 34;
                return (
                  <button
                    key={block.id}
                    type="button"
                    onClick={(e) => onBlockClick(block, e)}
                    className={cn(
                      "team-block absolute overflow-hidden rounded-md px-2 text-left text-white shadow-sm transition-[filter] hover:brightness-95 focus-visible:outline-2 focus-visible:outline-offset-1",
                      short ? "py-0.5" : "py-1",
                      block.done && "opacity-60",
                      isNow && "ring-2 ring-offset-1 ring-[#1a73e8]",
                    )}
                    style={{
                      top: top + 1,
                      height,
                      left: `calc(${(lane / lanes) * 100}% + 2px)`,
                      width: `calc(${100 / lanes}% - 6px)`,
                      background: colour,
                    }}
                    title={`${m.name}: ${block.title} (${fmtTime(block.start)} – ${fmtTime(block.end)})`}
                  >
                    {short ? (
                      <div className="truncate text-[12px] leading-tight">
                        {block.done && <Check className="mr-0.5 inline h-3 w-3" strokeWidth={3} />}
                        <span className={cn("font-semibold", block.done && "line-through")}>
                          {block.title}
                        </span>
                        <span className="opacity-90">, {fmtTime(block.start)}</span>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-start gap-1 text-[12px] font-semibold leading-tight">
                          {block.done && (
                            <Check className="mt-px h-3 w-3 shrink-0" strokeWidth={3} />
                          )}
                          <span className={cn("line-clamp-2", block.done && "line-through")}>
                            {block.title}
                          </span>
                        </div>
                        <div className="text-[11px] leading-tight opacity-90">
                          {fmtTime(block.start)} – {fmtTime(block.end)}
                        </div>
                        {height > 64 && block.goal && (
                          <div className="truncate text-[11px] leading-tight opacity-85">
                            {block.goal.title}
                          </div>
                        )}
                      </>
                    )}
                  </button>
                );
              })}

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
