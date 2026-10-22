/**
 * Free/busy maths for booking meetings (runs in the browser, in the viewer's
 * own time zone). Times are epoch milliseconds.
 */

export type Interval = { start: number; end: number };

export type BusyBlock = {
  user_id: string;
  start: string;
  end: string;
  meeting_id?: string | null;
};

const MIN = 60_000;

export function mergeIntervals(list: Interval[]): Interval[] {
  const sorted = list.filter((i) => i.end > i.start).sort((a, b) => a.start - b.start);
  const out: Interval[] = [];
  for (const i of sorted) {
    const last = out[out.length - 1];
    if (last && i.start <= last.end) last.end = Math.max(last.end, i.end);
    else out.push({ ...i });
  }
  return out;
}

/** Busy time per person. Blocks of `ignoreMeetingId` (the meeting being edited) don't count. */
export function busyByUser(blocks: BusyBlock[], ignoreMeetingId?: string | null) {
  const map = new Map<string, Interval[]>();
  for (const b of blocks) {
    if (ignoreMeetingId && b.meeting_id === ignoreMeetingId) continue;
    const start = new Date(b.start).getTime();
    const end = new Date(b.end).getTime();
    if (!map.has(b.user_id)) map.set(b.user_id, []);
    map.get(b.user_id)!.push({ start, end });
  }
  for (const [k, v] of map) map.set(k, mergeIntervals(v));
  return map;
}

export function overlaps(a: Interval, b: Interval) {
  return a.start < b.end && b.start < a.end;
}

/** People (from userIds) who are busy during [start, end), with the clashing time */
export function clashes(
  busy: Map<string, Interval[]>,
  userIds: string[],
  slot: Interval,
): { userId: string; interval: Interval }[] {
  const out: { userId: string; interval: Interval }[] = [];
  for (const id of userIds) {
    const hit = (busy.get(id) ?? []).find((i) => overlaps(i, slot));
    if (hit) out.push({ userId: id, interval: hit });
  }
  return out;
}

/** ISO weekday (1 = Monday … 7 = Sunday) of a local date */
export function isoWeekday(d: Date) {
  const w = d.getDay();
  return w === 0 ? 7 : w;
}

function atMinutes(day: Date, minutes: number) {
  const d = new Date(day);
  d.setHours(0, 0, 0, 0);
  d.setMinutes(minutes);
  return d;
}

/**
 * Start times when everyone is free for `durationMin`, inside working days and
 * hours, from `from` onwards (rounded up to the step), over the next `days` days.
 */
export function suggestTimes(opts: {
  busy: Map<string, Interval[]>;
  userIds: string[];
  durationMin: number;
  from: Date;
  workDays: number[];
  workStart: number;
  workEnd: number;
  limit?: number;
  days?: number;
  stepMin?: number;
}): Date[] {
  const { busy, userIds, durationMin, workDays, workStart, workEnd } = opts;
  const limit = opts.limit ?? 4;
  const days = opts.days ?? 7;
  const step = (opts.stepMin ?? 30) * MIN;
  const duration = durationMin * MIN;
  const out: Date[] = [];
  const earliest = opts.from.getTime();

  const day = new Date(opts.from);
  day.setHours(0, 0, 0, 0);
  for (let d = 0; d < days && out.length < limit; d++) {
    const date = new Date(day);
    date.setDate(day.getDate() + d);
    if (!workDays.includes(isoWeekday(date))) continue;
    const dayStart = atMinutes(date, workStart).getTime();
    const dayEnd = atMinutes(date, workEnd).getTime();
    // First step-aligned start (counted from the start of the working day) not in the past
    let t = dayStart + Math.max(0, Math.ceil((earliest - dayStart) / step)) * step;
    while (t + duration <= dayEnd && out.length < limit) {
      if (clashes(busy, userIds, { start: t, end: t + duration }).length === 0) {
        out.push(new Date(t));
        // Spread suggestions out: the next one starts after this one ends
        t += Math.max(step, Math.ceil(duration / step) * step);
      } else {
        t += step;
      }
    }
  }
  return out;
}
