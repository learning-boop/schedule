/** Get Monday of the week containing the given date (local time) */
export function getWeekStart(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day; // Monday = 1
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

/** Get the 1st of the month for the given date */
export function getMonthStart(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

/**
 * Format as YYYY-MM-DD using the *local* calendar date.
 *
 * (Previously this used toISOString(), which converts to UTC first — for
 * users ahead of UTC, e.g. India, "Monday 00:00" became Sunday's date.)
 * On the server (UTC) both behave the same.
 */
export function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Parse YYYY-MM-DD as a *local* date at 00:00 */
export function parseLocalDate(s: string): Date {
  return new Date(s + "T00:00:00");
}

/** Add days to a YYYY-MM-DD string (calendar arithmetic, timezone independent) */
export function addDaysStr(s: string, days: number): string {
  const [y, m, d] = s.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

/** Get Sunday of the week */
export function getWeekEnd(d: Date): Date {
  const start = getWeekStart(d);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return end;
}

/** Get last day of the month */
export function getMonthEnd(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
}

/** Day names Mon-Sun */
export const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** The browser's IANA time zone (falls back to UTC) */
export function getBrowserTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}
