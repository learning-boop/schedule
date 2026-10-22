/** Display helpers (browser time zone) */

/** "2:00pm" */
export function fmtTime(d: Date | string) {
  return new Date(d)
    .toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
    .replace(/\s?([AP])\.?M\.?/i, (_, p: string) => p.toLowerCase() + "m");
}

/** "Thursday, 22 October · 2:00 – 2:30pm" */
export function fmtMeetingWhen(
  start: Date | string,
  end: Date | string,
  weekday: "long" | "short" = "long",
) {
  const s = new Date(start);
  const e = new Date(end);
  const day = s.toLocaleDateString(undefined, {
    weekday,
    day: "numeric",
    month: weekday === "long" ? "long" : "short",
  });
  const startText = fmtTime(s).replace(/(am|pm)$/, (m) =>
    fmtTime(e).endsWith(m) && s.toDateString() === e.toDateString() ? "" : m,
  );
  const sameDay = s.toDateString() === e.toDateString();
  return sameDay
    ? `${day} · ${startText} – ${fmtTime(e)}`
    : `${day} ${fmtTime(s)} – ${e.toLocaleDateString(undefined, { weekday, day: "numeric", month: "short" })} ${fmtTime(e)}`;
}

/** "2 min", "3 h", "Yesterday", "12 Oct" */
export function fmtAgo(d: Date | string, now = new Date()) {
  const t = new Date(d);
  const mins = Math.round((now.getTime() - t.getTime()) / 60000);
  if (mins < 1) return "Now";
  if (mins < 60) return `${mins} min`;
  const hours = Math.round(mins / 60);
  if (hours < 24 && t.toDateString() === now.toDateString()) return `${hours} h`;
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (t.toDateString() === yesterday.toDateString()) return "Yesterday";
  return t.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

/** Local "YYYY-MM-DD" for a date input */
export function toDateInput(d: Date) {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Local "HH:MM" for a time input */
export function toTimeInput(d: Date) {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** Local Date from date + time inputs */
export function fromInputs(date: string, time: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const t = /^(\d{2}):(\d{2})$/.exec(time);
  if (!m || !t) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(t[1]), Number(t[2]));
}

/** "9:00 am" from minutes after midnight */
export function fmtMinutes(min: number) {
  const d = new Date(2000, 0, 1, Math.floor(min / 60), min % 60);
  return fmtTime(d).replace(/(am|pm)$/, " $1");
}

/** Is this text a web link we can open? */
export function asLink(text: string | null | undefined): string | null {
  if (!text) return null;
  const t = text.trim();
  if (/^https?:\/\/\S+$/i.test(t)) return t;
  if (/^(meet\.google\.com|zoom\.us|[\w-]+\.zoom\.us|teams\.microsoft\.com)\/\S*$/i.test(t)) {
    return `https://${t}`;
  }
  return null;
}
