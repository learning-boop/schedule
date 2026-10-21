"use client";

/**
 * Shared Google-Calendar-style rendering for FullCalendar v7.
 *
 * FullCalendar v7 ships its layout in `skeleton.css` + a theme (imported in
 * the dashboard layout). These helpers add the Google Calendar look on top:
 * "TUE / 21" day headers with today in a blue circle, "9 AM" hour labels,
 * solid colour blocks with title + time, and a red now-line.
 */

import type {
  CalendarOptions,
  DayHeaderInfo,
  EventDisplayInfo,
  SlotHeaderInfo,
  SlotLaneInfo,
} from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/react/daygrid";
import timeGridPlugin from "@fullcalendar/react/timegrid";
import interactionPlugin from "@fullcalendar/react/interaction";
import monarchTheme from "@fullcalendar/react/themes/monarch";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

/** Google Calendar's event colours — used to tell people apart in team views */
export const PERSON_COLOURS = [
  "#039be5", // peacock
  "#33b679", // sage
  "#f4511e", // tangerine
  "#8e24aa", // grape
  "#e67c73", // flamingo
  "#f6bf26", // banana
  "#3f51b5", // blueberry
  "#0b8043", // basil
  "#d50000", // tomato
  "#7986cb", // lavender
  "#616161", // graphite
  "#ef6c00", // pumpkin
];

export const DEFAULT_EVENT_COLOUR = "#039be5";

export function personColour(index: number) {
  return PERSON_COLOURS[
    ((index % PERSON_COLOURS.length) + PERSON_COLOURS.length) % PERSON_COLOURS.length
  ];
}

export function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** Readable text colour (white or near-black) for a hex background */
export function contrastText(hex: string) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return "#ffffff";
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  // perceived luminance
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.72 ? "#1f1f1f" : "#ffffff";
}

/** Format an hour-of-day like Google Calendar: "9 AM", "12 PM" */
function formatHourLabel(text: string) {
  return text.replace(/\s*([ap])\.?m\.?/i, (_, p: string) => ` ${p.toUpperCase()}M`).trim();
}

function DayHeader({ arg }: { arg: DayHeaderInfo }) {
  const weekday = arg.date.toLocaleDateString(undefined, { weekday: "short" }).toUpperCase();
  if (arg.view.type === "dayGridMonth") {
    return <span className="gcal-dow">{weekday}</span>;
  }
  return (
    <div className="gcal-dayhead">
      <span className={cn("gcal-dow", arg.isToday && "is-today")}>{weekday}</span>
      <span className={cn("gcal-daynum", arg.isToday && "is-today")}>{arg.date.getDate()}</span>
    </div>
  );
}

function SlotLabel({ arg }: { arg: SlotHeaderInfo }) {
  return <span className="gcal-slot-label">{formatHourLabel(arg.text)}</span>;
}

/** Event block content: title, time and an optional subtitle (goal / person) */
export function EventContent({ arg }: { arg: EventDisplayInfo }) {
  const { event, timeText, isShort } = arg;
  const done = !!event.extendedProps.done;
  const subtitle = (event.extendedProps.subtitle as string | undefined) || "";

  if (arg.view.type.startsWith("dayGrid")) {
    return (
      <div className="gcal-row-event">
        <span className="gcal-dot" style={{ background: arg.color }} />
        {timeText && <span className="gcal-row-time">{timeText}</span>}
        <span className={cn("gcal-row-title", done && "is-done")}>{event.title}</span>
      </div>
    );
  }

  if (isShort) {
    // One line, like Google Calendar: "Title, 1:30pm"
    return (
      <div className={cn("gcal-block is-short", done && "is-done")}>
        <div className="gcal-short-line">
          {done && <Check className="gcal-check" strokeWidth={3} aria-label="Done" />}
          <span className="gcal-title-text">{event.title}</span>
          {timeText && <span className="gcal-block-time-inline">, {timeText}</span>}
        </div>
      </div>
    );
  }

  return (
    <div className={cn("gcal-block", done && "is-done")}>
      <div className="gcal-block-title">
        {done && <Check className="gcal-check" strokeWidth={3} aria-label="Done" />}
        <span className="gcal-title-text">{event.title}</span>
      </div>
      {timeText && <div className="gcal-block-time">{timeText}</div>}
      {subtitle && <div className="gcal-block-sub">{subtitle}</div>}
    </div>
  );
}

/** Where to scroll on open: the working day from 8 AM, following the clock early/late */
export function initialScrollTime(now = new Date()) {
  const h = now.getHours();
  let start = 8;
  if (h < 8) start = Math.max(0, h - 1);
  else if (h >= 19) start = Math.min(h - 6, 16);
  return `${String(start).padStart(2, "0")}:00:00`;
}

/** Options shared by every calendar in the app */
export function gcalBaseOptions(): CalendarOptions {
  return {
    plugins: [dayGridPlugin, timeGridPlugin, interactionPlugin, monarchTheme],
    firstDay: 1,
    nowIndicator: true,
    allDaySlot: false,
    slotDuration: "00:30:00",
    snapDuration: "00:15:00",
    slotHeaderInterval: "01:00",
    slotHeaderFormat: { hour: "numeric", meridiem: "short" },
    eventTimeFormat: { hour: "numeric", minute: "2-digit", meridiem: "short" },
    dayMaxEvents: 3,
    expandRows: false,
    scrollTime: initialScrollTime(),
    todayText: "Today",
    dayText: "Day",
    weekTextLong: "Week",
    weekTextShort: "Week",
    monthText: "Month",
    // Google-style grid: 48px per hour, hour lines only, labels on the line
    slotLaneClass: (info: SlotLaneInfo) =>
      info.isMinor ? "gcal-lane gcal-lane-minor" : "gcal-lane",
    slotHeaderInnerClass: "gcal-slot-inner",
    dayHeaderContent: (arg: DayHeaderInfo) => <DayHeader arg={arg} />,
    slotHeaderContent: (arg: SlotHeaderInfo) => <SlotLabel arg={arg} />,
    eventContent: (arg: EventDisplayInfo) => <EventContent arg={arg} />,
  };
}
