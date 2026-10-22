/** Validation for company settings (name, working days and hours) */

export const DEFAULT_WORK_DAYS = [1, 2, 3, 4, 5, 6];
export const DEFAULT_WORK_START = 9 * 60;
export const DEFAULT_WORK_END = 18 * 60;

export function cleanCompanyName(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const n = v.trim().replace(/\s+/g, " ");
  return n.length >= 1 && n.length <= 120 ? n : null;
}

/** ISO weekday numbers 1–7, unique and sorted; null if invalid or empty */
export function cleanWorkDays(v: unknown): number[] | null {
  if (!Array.isArray(v)) return null;
  const days = [...new Set(v.map(Number))].filter((d) => Number.isInteger(d) && d >= 1 && d <= 7);
  if (days.length === 0 || days.length !== v.length) return null;
  return days.sort((a, b) => a - b);
}

/** Minutes from midnight; start before end, both within the day */
export function cleanWorkHours(
  start: unknown,
  end: unknown,
): { start: number; end: number } | null {
  const s = Number(start);
  const e = Number(end);
  if (!Number.isInteger(s) || !Number.isInteger(e)) return null;
  if (s < 0 || e > 24 * 60 || s >= e) return null;
  return { start: s, end: e };
}
