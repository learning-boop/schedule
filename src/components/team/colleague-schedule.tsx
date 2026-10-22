"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import FullCalendar, {
  type CalendarRef,
  type DatesSetInfo,
  type EventInput,
} from "@fullcalendar/react";
import { CheckCircle, ChevronLeft, Clock, FileDown, Plus } from "lucide-react";
import { TopBar } from "@/components/top-bar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DEFAULT_EVENT_COLOUR, gcalBaseOptions, initials } from "@/components/calendar/gcal";
import { formatDate, getBrowserTimeZone, getWeekStart } from "@/lib/date-utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { BookMeetingDialog, type BookInitial } from "@/components/meetings/book-meeting-dialog";
import { onCalendarRefresh } from "@/lib/app-events";

type Block = {
  id: string;
  title: string;
  start: string;
  end: string;
  done: boolean;
  category: string | null;
  goal: { title: string; colour: string } | null;
  meeting_id?: string | null;
  rsvp?: string | null;
};

type ScheduleData = {
  user: { id: string; name: string; role: string };
  blocks: Block[];
  top3: { text: string; done: boolean }[];
  doneToday: { title: string; start: string; end: string }[];
  hoursThisWeek: number;
  canExport?: boolean;
  goals?: {
    id: string;
    title: string;
    colour: string;
    rank: number;
    sub_goals: { title: string; done: boolean }[];
    actions: { title: string; done: boolean }[];
  }[];
  notes?: string | null;
};

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

export function ColleagueSchedule() {
  const { userId } = useParams<{ userId: string }>();
  const isMobile = useIsMobile();
  const calendarRef = useRef<CalendarRef>(null);
  const [data, setData] = useState<ScheduleData | null>(null);
  const [date, setDate] = useState("");
  const [loading, setLoading] = useState(true);
  const [denied, setDenied] = useState(false);
  const [bookOpen, setBookOpen] = useState(false);
  const [bookInitial, setBookInitial] = useState<BookInitial | undefined>(undefined);
  const rangeRef = useRef<{ start: Date; end: Date } | null>(null);

  const load = useCallback(
    async (range: { start: Date; end: Date }, day: string) => {
      setLoading(true);
      const params = new URLSearchParams({
        date: day,
        tz: getBrowserTimeZone(),
        start: range.start.toISOString(),
        end: range.end.toISOString(),
      });
      try {
        const res = await fetch(`/api/team/${userId}/schedule?${params}`);
        if (!res.ok) {
          setDenied(true);
          setData(null);
          return;
        }
        setDenied(false);
        setData(await res.json());
      } finally {
        setLoading(false);
      }
    },
    [userId],
  );

  function handleDatesSet(arg: DatesSetInfo) {
    const api = calendarRef.current?.getApi();
    const current = api ? api.getDate() : new Date();
    // Side panel follows today when it is in view, otherwise the first visible day
    const inView = new Date() >= arg.start && new Date() < arg.end;
    const day = formatDate(inView ? new Date() : current);
    setDate(day);
    rangeRef.current = { start: arg.start, end: arg.end };
    load({ start: arg.start, end: arg.end }, day);
  }

  // Reload after booking (or any meeting change)
  useEffect(
    () =>
      onCalendarRefresh(() => {
        if (rangeRef.current && date) load(rangeRef.current, date);
      }),
    [load, date],
  );

  function bookStart() {
    const api = calendarRef.current?.getApi();
    const base = api ? api.getDate() : new Date();
    const n = new Date();
    const start = new Date(base);
    if (start.toDateString() === n.toDateString()) start.setHours(n.getHours() + 1, 0, 0, 0);
    else start.setHours(9, 0, 0, 0);
    return start;
  }

  const events: EventInput[] = useMemo(
    () =>
      (data?.blocks ?? []).map((b) => ({
        id: b.id,
        title: b.title,
        start: b.start,
        end: b.end,
        color:
          b.rsvp === "pending"
            ? "#ffffff"
            : b.meeting_id
              ? "#1967d2"
              : b.goal?.colour || DEFAULT_EVENT_COLOUR,
        ...(b.rsvp === "pending" && { contrastColor: "#174ea6" }),
        className: b.done ? "gcal-done" : undefined,
        extendedProps: {
          done: b.done,
          meeting: !!b.meeting_id,
          pending: b.rsvp === "pending",
          accent: b.meeting_id ? "#1967d2" : b.goal?.colour || DEFAULT_EVENT_COLOUR,
          subtitle:
            b.rsvp === "pending" ? "Invited · no reply yet" : (b.goal?.title ?? b.category ?? ""),
        },
      })),
    [data],
  );

  const baseOptions = useMemo(() => gcalBaseOptions(), []);

  const dayLabel = date
    ? new Date(date + "T00:00:00").toLocaleDateString(undefined, {
        weekday: "long",
        month: "long",
        day: "numeric",
      })
    : "";

  const exportUrl = data?.canExport
    ? `/api/export/preview?${new URLSearchParams({
        type: "week",
        weekStart: formatDate(getWeekStart(date ? new Date(date + "T00:00:00") : new Date())),
        userId,
        tz: getBrowserTimeZone(),
      })}`
    : null;

  return (
    <>
      <TopBar title={data?.user.name ?? "Colleague"} />
      <div className={isMobile ? "flex flex-col" : "flex"}>
        <div className="min-w-0 flex-1 space-y-3 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1 text-xs"
              nativeButton={false}
              render={<Link href="/team" />}
            >
              <ChevronLeft className="h-3.5 w-3.5" /> Back to team
            </Button>
            <div className="flex-1" />
            {data && (
              <Button
                size="sm"
                className="h-8 gap-1.5 rounded-full bg-[#1967d2] px-3.5 text-xs text-white hover:bg-[#174ea6]"
                onClick={() => {
                  const start = bookStart();
                  setBookInitial({
                    guestIds: [userId],
                    start,
                    end: new Date(start.getTime() + 30 * 60_000),
                  });
                  setBookOpen(true);
                }}
              >
                <Plus className="h-3.5 w-3.5" /> Book a meeting with {data.user.name.split(" ")[0]}
              </Button>
            )}
            {exportUrl && (
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1.5 text-xs"
                nativeButton={false}
                render={<a href={exportUrl} target="_blank" rel="noopener" />}
              >
                <FileDown className="h-3.5 w-3.5" /> Week PDF
              </Button>
            )}
          </div>

          <h2 className="sr-only">Schedule</h2>
          <div className="gcal overflow-hidden h-[calc(100svh-8.5rem)] min-h-[480px] rounded-xl border bg-background">
            <FullCalendar
              ref={calendarRef}
              {...baseOptions}
              initialView={isMobile ? "timeGridDay" : "timeGridWeek"}
              headerToolbar={{
                left: "today prev,next title",
                right: isMobile
                  ? "timeGridDay,dayGridMonth"
                  : "timeGridDay,timeGridWeek,dayGridMonth",
              }}
              height="100%"
              editable={false}
              selectable={false}
              events={events}
              datesSet={handleDatesSet}
            />
          </div>
          {denied && (
            <p className="text-center text-sm text-muted-foreground">
              Not a colleague or no access.
            </p>
          )}
          <BookMeetingDialog open={bookOpen} onOpenChange={setBookOpen} initial={bookInitial} />
        </div>

        {/* Side panel */}
        <aside
          className={
            isMobile
              ? "space-y-4 border-t p-4"
              : "w-80 shrink-0 space-y-4 overflow-y-auto border-l p-4"
          }
          style={isMobile ? undefined : { maxHeight: "calc(100svh - 3.5rem)" }}
        >
          {data && (
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#039be5] text-sm font-semibold text-white">
                {initials(data.user.name)}
              </span>
              <div className="min-w-0">
                <p className="truncate font-medium">{data.user.name}</p>
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span className="capitalize">{data.user.role}</span> ·
                  <Clock className="h-3.5 w-3.5" /> {data.hoursThisWeek}h this week
                </p>
              </div>
            </div>
          )}
          {loading && !data && <p className="text-sm text-muted-foreground">Loading...</p>}

          {data && (
            <>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Schedule · {dayLabel}
              </p>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Top 3 Priorities</CardTitle>
                </CardHeader>
                <CardContent className="space-y-1.5">
                  {(data.top3 || []).length === 0 && (
                    <p className="text-xs text-muted-foreground">None set</p>
                  )}
                  {(data.top3 || []).map((item, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                        {i + 1}
                      </span>
                      <span
                        className={`text-sm ${item.done ? "text-muted-foreground line-through" : ""}`}
                      >
                        {item.text}
                      </span>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Done</CardTitle>
                </CardHeader>
                <CardContent className="space-y-1.5">
                  {data.doneToday.length === 0 && (
                    <p className="text-xs text-muted-foreground">Nothing completed yet</p>
                  )}
                  {data.doneToday.map((d, i) => (
                    <div key={i} className="flex items-start gap-2 text-sm">
                      <CheckCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-green-600" />
                      <span className="min-w-0 flex-1">{d.title}</span>
                      <span className="shrink-0 text-[11px] text-muted-foreground">
                        {fmtTime(d.start)}
                      </span>
                    </div>
                  ))}
                </CardContent>
              </Card>

              {data.goals && data.goals.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Goals</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {data.goals.map((g) => {
                      const total = g.sub_goals.length + g.actions.length;
                      const done =
                        g.sub_goals.filter((s) => s.done).length +
                        g.actions.filter((a) => a.done).length;
                      const pct = total > 0 ? Math.round((done / total) * 100) : 0;
                      return (
                        <div key={g.id} className="space-y-1">
                          <div className="flex items-center gap-2">
                            <div
                              className="h-2.5 w-2.5 rounded-full"
                              style={{ background: g.colour }}
                            />
                            <span className="text-sm font-medium">{g.title}</span>
                            <span className="ml-auto text-xs text-muted-foreground">{pct}%</span>
                          </div>
                          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                            <div
                              className="h-full rounded-full"
                              style={{ width: `${pct}%`, background: g.colour }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>
              )}

              {data.notes && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Notes</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="whitespace-pre-wrap text-sm">{data.notes}</p>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </aside>
      </div>
    </>
  );
}
