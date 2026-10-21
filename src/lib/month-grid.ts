/**
 * The workbook's month page has a "Date and Day" grid: one column per week
 * (Week 1 … Week 5) and one row per weekday (Monday … Sunday).
 *
 * Week 1 is the Monday-to-Sunday week that contains the 1st of the month.
 * A month can touch a 6th week (e.g. it starts on a Sunday and has 30+ days);
 * with 5 columns those last days wrap into the empty start of Week 1, the same
 * way paper calendars show "23/30". They never collide with real Week 1 days.
 */

export type MonthGridCell = { day: number; wrapped: boolean } | null;

export const WEEKDAY_NAMES = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

/** month is the first day of the month, "YYYY-MM-01" (or any day in it) */
export function monthMeta(month: string) {
  const [y, m] = month.split("-").map(Number);
  const firstDow = (new Date(Date.UTC(y, m - 1, 1)).getUTCDay() + 6) % 7; // Monday = 0
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const weeksNeeded = Math.ceil((firstDow + daysInMonth) / 7);
  return { year: y, month: m, firstDow, daysInMonth, weeksNeeded };
}

/**
 * grid[weekdayRow][weekColumn]; weekdayRow 0 = Monday.
 * columns = 5 wraps a 6th week into Week 1; columns = 6 never wraps.
 */
export function buildMonthGrid(month: string, columns: 5 | 6 = 5): MonthGridCell[][] {
  const { firstDow, daysInMonth } = monthMeta(month);
  const grid: MonthGridCell[][] = Array.from({ length: 7 }, () =>
    Array.from({ length: columns }, () => null as MonthGridCell),
  );
  for (let day = 1; day <= daysInMonth; day++) {
    const idx = firstDow + day - 1;
    let col = Math.floor(idx / 7);
    const row = idx % 7;
    let wrapped = false;
    if (col >= columns) {
      col = col % columns;
      wrapped = true;
    }
    grid[row][col] = { day, wrapped };
  }
  return grid;
}

/** YYYY-MM-DD for a day of the given month */
export function dayKey(month: string, day: number) {
  return `${month.slice(0, 7)}-${String(day).padStart(2, "0")}`;
}
