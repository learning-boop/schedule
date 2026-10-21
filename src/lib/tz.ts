/**
 * Time-zone helpers for server code.
 *
 * Servers run in UTC, but a planner "day" is the user's local day. The client
 * sends its IANA zone (e.g. "Asia/Kolkata") and these helpers turn local
 * calendar dates into UTC instants and back, without extra dependencies.
 */

const pad = (n: number) => String(n).padStart(2, "0");

export function isValidTimeZone(tz: string | null | undefined): tz is string {
  if (!tz) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export function safeTimeZone(tz: string | null | undefined): string {
  return isValidTimeZone(tz) ? tz : "UTC";
}

const formatters = new Map<string, Intl.DateTimeFormat>();
function partsFormatter(tz: string) {
  let f = formatters.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    formatters.set(tz, f);
  }
  return f;
}

/** Wall-clock parts of an instant in a time zone */
export function zonedParts(date: Date, tz: string) {
  const parts = partsFormatter(tz).formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  let hour = get("hour");
  if (hour === 24) hour = 0;
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour,
    minute: get("minute"),
    second: get("second"),
  };
}

/** Offset of `tz` at `date` in ms (local wall time minus UTC) */
function offsetMs(date: Date, tz: string) {
  const p = zonedParts(date, tz);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}

/** Add days to a YYYY-MM-DD string */
export function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/** Day of week for a YYYY-MM-DD string (0 = Sunday) */
export function dayOfWeek(dateStr: string): number {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** Monday of the week containing the date */
export function mondayOf(dateStr: string): string {
  const dow = dayOfWeek(dateStr);
  return addDays(dateStr, dow === 0 ? -6 : 1 - dow);
}

/** First day of the month containing the date */
export function monthStartOf(dateStr: string): string {
  return dateStr.slice(0, 7) + "-01";
}

export function daysInMonth(monthStart: string): number {
  const [y, m] = monthStart.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/** UTC instant of a local wall-clock time (date + hh:mm) in `tz` */
export function zonedTimeToUtc(dateStr: string, tz: string, hour = 0, minute = 0): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  const guess = Date.UTC(y, m - 1, d, hour, minute);
  const off1 = offsetMs(new Date(guess), tz);
  let t = guess - off1;
  const off2 = offsetMs(new Date(t), tz);
  if (off2 !== off1) t = guess - off2; // crossed a DST change
  return new Date(t);
}

/** [start, end) of a local calendar day, as UTC instants */
export function zonedDayRange(dateStr: string, tz: string) {
  return { start: zonedTimeToUtc(dateStr, tz), end: zonedTimeToUtc(addDays(dateStr, 1), tz) };
}

/** Local calendar date (YYYY-MM-DD) of an instant */
export function localDateStr(date: Date, tz: string): string {
  const p = zonedParts(date, tz);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}

/** Minutes since local midnight of an instant */
export function localMinutes(date: Date, tz: string): number {
  const p = zonedParts(date, tz);
  return p.hour * 60 + p.minute;
}

/** "9:30" (12-hour clock, no am/pm — matches the workbook's hour labels) */
export function shortTime(date: Date, tz: string): string {
  const p = zonedParts(date, tz);
  const h = p.hour % 12 === 0 ? 12 : p.hour % 12;
  return `${h}:${pad(p.minute)}`;
}

/** "9:30 am" */
export function clockTime(date: Date, tz: string): string {
  const p = zonedParts(date, tz);
  const h = p.hour % 12 === 0 ? 12 : p.hour % 12;
  return `${h}:${pad(p.minute)} ${p.hour < 12 ? "am" : "pm"}`;
}

/** Calendar date strings in [from, to] inclusive */
export function eachDay(from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}

/** "21 Oct 2026" style label for a YYYY-MM-DD string */
export function dateLabel(dateStr: string, opts: Intl.DateTimeFormatOptions = {}): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-GB", {
    timeZone: "UTC",
    day: "numeric",
    month: "short",
    year: "numeric",
    ...opts,
  });
}

/** Validate a YYYY-MM-DD string */
export function isDateStr(s: unknown): s is string {
  return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));
}
