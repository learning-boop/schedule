"use client";

import { useMemo } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { initials } from "@/components/calendar/gcal";
import type { TeamBlock, TeamMember } from "./team-day-grid";

const LANE_H = 14;
const MAX_LANES = 3;

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

function hourShort(h: number) {
  const hh = h % 12 === 0 ? 12 : h % 12;
  return `${hh}${h < 12 || h === 24 ? "a" : "p"}`;
}

type Bar = { block: TeamBlock; left: number; width: number; lane: number };

/** Week overview: one row per person, one mini-timeline per day */
export function TeamWeekTimeline({
  members,
  blocks,
  weekStart,
  now,
  meId,
  colourOf,
  onBlockClick,
}: {
  members: TeamMember[];
  blocks: TeamBlock[];
  weekStart: Date; // local Monday 00:00
  now: Date;
  meId: string;
  colourOf: (userId: string) => string;
  onBlockClick: (block: TeamBlock, e: React.MouseEvent) => void;
}) {
  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart],
  );

  // Visible hours: the working day, stretched to fit any earlier/later blocks
  const [axisStart, axisEnd] = useMemo(() => {
    let lo = 8;
    let hi = 19;
    for (const b of blocks) {
      const s = new Date(b.start);
      const e = new Date(b.end);
      if (s.toDateString() === e.toDateString() || e.getHours() === 0) {
        lo = Math.min(lo, s.getHours());
        hi = Math.max(
          hi,
          e.getHours() === 0 && e.getMinutes() === 0
            ? 24
            : e.getHours() + (e.getMinutes() > 0 ? 1 : 0),
        );
      }
    }
    return [Math.max(0, lo), Math.min(24, hi)];
  }, [blocks]);
  const axisMin = axisStart * 60;
  const axisLen = (axisEnd - axisStart) * 60;
  const ticks = useMemo(() => {
    const out: number[] = [];
    for (let h = Math.ceil(axisStart / 3) * 3; h < axisEnd; h += 3) if (h > axisStart) out.push(h);
    return out;
  }, [axisStart, axisEnd]);

  // Bars per person per day
  const bars = useMemo(() => {
    const map = new Map<string, Bar[]>();
    for (const b of blocks) {
      const s = new Date(b.start);
      const e = new Date(b.end);
      for (let i = 0; i < 7; i++) {
        const dayStart = days[i];
        const dayEnd = addDays(dayStart, 1);
        if (e <= dayStart || s >= dayEnd) continue;
        const sMin = Math.max((s.getTime() - dayStart.getTime()) / 60000, axisMin);
        const eMin = Math.min((e.getTime() - dayStart.getTime()) / 60000, axisMin + axisLen);
        if (eMin <= sMin) continue;
        const key = `${b.user_id}|${i}`;
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push({
          block: b,
          left: ((sMin - axisMin) / axisLen) * 100,
          width: Math.max(((eMin - sMin) / axisLen) * 100, 1.5),
          lane: 0,
        });
      }
    }
    // Stack overlapping bars into lanes
    for (const list of map.values()) {
      list.sort((a, b) => a.left - b.left);
      const laneEnds: number[] = [];
      for (const bar of list) {
        let lane = laneEnds.findIndex((end) => end <= bar.left + 0.01);
        if (lane === -1) lane = Math.min(laneEnds.length, MAX_LANES - 1);
        laneEnds[lane] = Math.max(laneEnds[lane] ?? 0, bar.left + bar.width);
        bar.lane = lane;
      }
    }
    return map;
  }, [blocks, days, axisMin, axisLen]);

  const hours = useMemo(() => {
    const done = new Map<string, number>();
    const planned = new Map<string, number>();
    for (const b of blocks) {
      const h = (new Date(b.end).getTime() - new Date(b.start).getTime()) / 36e5;
      planned.set(b.user_id, (planned.get(b.user_id) ?? 0) + h);
      if (b.done) done.set(b.user_id, (done.get(b.user_id) ?? 0) + h);
    }
    return { done, planned };
  }, [blocks]);

  const todayIndex = days.findIndex((d) => d.toDateString() === now.toDateString());
  const nowPct =
    todayIndex >= 0
      ? (((now.getTime() - days[todayIndex].getTime()) / 60000 - axisMin) / axisLen) * 100
      : -1;

  return (
    <div className="gcal h-[calc(100svh-11.5rem)] min-h-[420px] overflow-auto rounded-xl border bg-background">
      <div
        className="grid min-w-[980px]"
        style={{ gridTemplateColumns: "210px repeat(7, minmax(110px, 1fr))" }}
      >
        {/* Header */}
        <div className="sticky top-0 left-0 z-30 flex flex-col justify-end border-b bg-background px-3 pb-2">
          <span className="text-[11px] text-muted-foreground">
            Each day: {hourShort(axisStart)}m → {hourShort(axisEnd)}m
          </span>
        </div>
        {days.map((d, i) => {
          const isToday = i === todayIndex;
          return (
            <div key={i} className="sticky top-0 z-20 border-b border-l bg-background">
              <div className="gcal-dayhead !pb-1.5">
                <span className={cn("gcal-dow", isToday && "is-today")}>
                  {d.toLocaleDateString(undefined, { weekday: "short" }).toUpperCase()}
                </span>
                <span className={cn("gcal-daynum !h-9 !w-9 !text-xl", isToday && "is-today")}>
                  {d.getDate()}
                </span>
              </div>
              <div className="relative mx-1.5 mb-1 h-3 text-[9px] text-muted-foreground">
                {ticks.map((h) => (
                  <span
                    key={h}
                    className="absolute -translate-x-1/2"
                    style={{ left: `${((h * 60 - axisMin) / axisLen) * 100}%` }}
                  >
                    {hourShort(h)}
                  </span>
                ))}
              </div>
            </div>
          );
        })}

        {/* Rows */}
        {members.map((m) => {
          const colour = colourOf(m.id);
          const done = Math.round((hours.done.get(m.id) ?? 0) * 10) / 10;
          const planned = Math.round((hours.planned.get(m.id) ?? 0) * 10) / 10;
          return (
            <div key={m.id} className="contents">
              <div className="sticky left-0 z-10 flex items-center gap-2.5 border-b bg-background px-3 py-3">
                <span
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
                  style={{ background: colour }}
                >
                  {initials(m.name)}
                </span>
                <div className="min-w-0">
                  <Link
                    href={m.id === meId ? "/week" : `/team/${m.id}`}
                    className="block truncate text-sm font-medium hover:underline"
                  >
                    {m.name}
                    {m.id === meId && (
                      <span className="ml-1 text-xs text-muted-foreground">(you)</span>
                    )}
                  </Link>
                  <p className="text-[11px] text-muted-foreground">
                    {done}h done · {planned}h planned
                  </p>
                </div>
              </div>
              {days.map((_, i) => {
                const list = bars.get(`${m.id}|${i}`) ?? [];
                const lanes = Math.max(1, ...list.map((b) => b.lane + 1));
                return (
                  <div key={i} className="relative border-b border-l px-1.5 py-2">
                    <div
                      className="relative rounded-md bg-[#f1f3f4]"
                      style={{ height: Math.max(2, lanes) * (LANE_H + 2) + 2 }}
                    >
                      {ticks.map((h) => (
                        <span
                          key={h}
                          className="absolute inset-y-0 w-px bg-[#dadce0]"
                          style={{ left: `${((h * 60 - axisMin) / axisLen) * 100}%` }}
                        />
                      ))}
                      {list.map(({ block, left, width, lane }) => (
                        <button
                          key={block.id + i}
                          type="button"
                          onClick={(e) => onBlockClick(block, e)}
                          title={`${block.title} · ${fmtTime(block.start)} – ${fmtTime(block.end)}${block.done ? " · done" : ""}`}
                          className={cn(
                            "absolute rounded-[3px] shadow-[0_0_0_1px_rgba(255,255,255,0.9)] transition-[filter] hover:brightness-90",
                            block.done && "opacity-55",
                          )}
                          style={{
                            left: `${left}%`,
                            width: `${width}%`,
                            top: 2 + lane * (LANE_H + 2),
                            height: LANE_H,
                            background: colour,
                          }}
                        />
                      ))}
                      {i === todayIndex && nowPct >= 0 && nowPct <= 100 && (
                        <span
                          className="pointer-events-none absolute -inset-y-1 w-0.5 rounded bg-[#ea4335]"
                          style={{ left: `${nowPct}%` }}
                        />
                      )}
                    </div>
                    {list.length > 0 && (
                      <p className="mt-1 truncate text-[10px] leading-tight text-muted-foreground">
                        {list.length} block{list.length > 1 ? "s" : ""} · {list[0].block.title}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
      {members.length === 0 && (
        <p className="p-8 text-center text-sm text-muted-foreground">
          Select people on the left to see their week.
        </p>
      )}
    </div>
  );
}
