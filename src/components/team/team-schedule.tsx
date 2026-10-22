"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  ExternalLink,
  Loader2,
  Plus,
  Target,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { initials, personColour } from "@/components/calendar/gcal";
import {
  TeamDayGrid,
  type SlotSelection,
  type TeamBlock,
  type TeamGroup,
  type TeamMember,
} from "./team-day-grid";
import { TeamWeekTimeline } from "./team-week-timeline";
import { NoCompany } from "./no-company";
import { useIsMobile } from "@/hooks/use-mobile";
import { onCalendarRefresh, emitMeetingChanged } from "@/lib/app-events";
import { getBrowserTimeZone } from "@/lib/date-utils";
import { fmtTime } from "@/lib/format";
import { BookMeetingDialog, type BookInitial } from "@/components/meetings/book-meeting-dialog";
import {
  MeetingDetailsDialog,
  type MeetingDetails,
} from "@/components/meetings/meeting-details-dialog";

type View = "day" | "week";
type Team = { id: string; name: string; lead_id: string | null };

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function mondayOf(d: Date) {
  const x = startOfDay(d);
  const dow = x.getDay();
  x.setDate(x.getDate() + (dow === 0 ? -6 : 1 - dow));
  return x;
}
function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

type PopoverState = { block: TeamBlock; x: number; y: number } | null;
type QuickState = { slot: SlotSelection; anchor: DOMRect } | null;

export function TeamSchedule() {
  const isMobile = useIsMobile();
  const [view, setView] = useState<View>("day");
  const [anchor, setAnchor] = useState<Date | null>(null);
  const [now, setNow] = useState<Date | null>(null);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [blocks, setBlocks] = useState<TeamBlock[]>([]);
  const [meId, setMeId] = useState("");
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [teamFilter, setTeamFilter] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [noCompany, setNoCompany] = useState(false);
  const [popover, setPopover] = useState<PopoverState>(null);
  const [quick, setQuick] = useState<QuickState>(null);
  const [bookOpen, setBookOpen] = useState(false);
  const [bookInitial, setBookInitial] = useState<BookInitial | undefined>(undefined);
  const [meetingId, setMeetingId] = useState<string | null>(null);

  // Client-only clock (avoids hydration mismatch); ticks every minute
  useEffect(() => {
    const t = new Date();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the clock must start after hydration
    setNow(t);
    setAnchor(startOfDay(t));
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  const range = useMemo(() => {
    if (!anchor) return null;
    if (view === "day") return { start: anchor, end: addDays(anchor, 1) };
    const mon = mondayOf(anchor);
    return { start: mon, end: addDays(mon, 7) };
  }, [anchor, view]);

  const load = useCallback(
    async (quiet = false) => {
      if (!range) return;
      if (!quiet) setLoading(true);
      try {
        const params = new URLSearchParams({
          start: range.start.toISOString(),
          end: range.end.toISOString(),
        });
        const res = await fetch(`/api/team/calendar?${params}`);
        if (res.status === 403) {
          setNoCompany(true);
          return;
        }
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setError(data.error || "Could not load the team schedule");
          return;
        }
        const data = await res.json();
        setError(null);
        setMembers(data.members);
        setTeams(data.teams ?? []);
        setBlocks(data.blocks);
        setMeId(data.me?.id ?? "");
      } finally {
        if (!quiet) setLoading(false);
      }
    },
    [range],
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- loads from the server when the range changes
    load();
  }, [load]);

  // Keep "what everyone is doing now" fresh, and reload after any meeting change
  useEffect(() => {
    const id = setInterval(() => load(true), 2 * 60_000);
    const off = onCalendarRefresh(() => load(true));
    return () => {
      clearInterval(id);
      off();
    };
  }, [load]);

  // Close popovers on Escape
  useEffect(() => {
    if (!popover && !quick) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setPopover(null);
      setQuick(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [popover, quick]);

  const colourIndex = useMemo(() => new Map(members.map((m, i) => [m.id, i])), [members]);
  const colourOf = useCallback(
    (userId: string) => personColour(colourIndex.get(userId) ?? 0),
    [colourIndex],
  );
  const memberById = useMemo(() => new Map(members.map((m) => [m.id, m])), [members]);

  // People grouped by team: your team first, then the others (each with its lead
  // first), then anyone without a team
  const allGroups: TeamGroup[] = useMemo(() => {
    const byName = (a: TeamMember, b: TeamMember) => a.name.localeCompare(b.name);
    const myTeam = members.find((m) => m.id === meId)?.team_id ?? null;
    const out: TeamGroup[] = [...teams]
      .sort((a, b) => (a.id === myTeam ? -1 : b.id === myTeam ? 1 : 0))
      .map((t) => ({
        teamId: t.id,
        teamName: t.name,
        members: members
          .filter((m) => m.team_id === t.id)
          .sort((a, b) => (a.id === t.lead_id ? -1 : b.id === t.lead_id ? 1 : byName(a, b))),
      }));
    const loose = members.filter((m) => !m.team_id || !teams.some((t) => t.id === m.team_id));
    if (loose.length)
      out.push({
        teamId: null,
        teamName: teams.length ? "No team" : null,
        members: loose.sort(byName),
      });
    return out.filter((g) => g.members.length > 0);
  }, [teams, members, meId]);

  const groups: TeamGroup[] = useMemo(
    () =>
      allGroups
        .filter((g) => teamFilter === "all" || (g.teamId ?? "none") === teamFilter)
        .map((g) => ({ ...g, members: g.members.filter((m) => !hidden.has(m.id)) }))
        .filter((g) => g.members.length > 0),
    [allGroups, teamFilter, hidden],
  );
  const visibleMembers = useMemo(() => groups.flatMap((g) => g.members), [groups]);
  const visibleIds = useMemo(() => new Set(visibleMembers.map((m) => m.id)), [visibleMembers]);
  const visibleBlocks = useMemo(
    () => blocks.filter((b) => visibleIds.has(b.user_id)),
    [blocks, visibleIds],
  );

  const hoursByMember = useMemo(() => {
    const map = new Map<string, number>();
    for (const b of blocks) {
      if (!b.done) continue;
      const h = (new Date(b.end).getTime() - new Date(b.start).getTime()) / 36e5;
      map.set(b.user_id, (map.get(b.user_id) ?? 0) + h);
    }
    return map;
  }, [blocks]);

  if (noCompany) return <NoCompany />;
  if (!anchor || !now) return null;

  function shift(n: number) {
    setPopover(null);
    setQuick(null);
    setAnchor((a) => (a ? addDays(a, view === "day" ? n : n * 7) : a));
  }

  function toggle(id: string) {
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function openBook(initial: BookInitial) {
    setQuick(null);
    setPopover(null);
    setBookInitial(initial);
    setBookOpen(true);
  }

  function bookButton() {
    const start = new Date(anchor!);
    const n = new Date();
    if (start.toDateString() === n.toDateString()) start.setHours(n.getHours() + 1, 0, 0, 0);
    else start.setHours(9, 0, 0, 0);
    openBook({ start, end: new Date(start.getTime() + 30 * 60_000) });
  }

  function editMeeting(m: MeetingDetails) {
    setMeetingId(null);
    openBook({
      meetingId: m.id,
      title: m.title,
      start: new Date(m.start),
      end: new Date(m.end),
      guestIds: m.guests.filter((g) => !g.is_organiser).map((g) => g.id),
      agenda: m.agenda,
      location: m.location,
    });
  }

  const title =
    view === "day"
      ? anchor.toLocaleDateString(undefined, {
          weekday: "long",
          day: "numeric",
          month: "long",
          year: "numeric",
        })
      : (() => {
          const mon = mondayOf(anchor);
          const sun = addDays(mon, 6);
          const sameMonth = mon.getMonth() === sun.getMonth();
          return `${mon.toLocaleDateString(undefined, { day: "numeric", ...(sameMonth ? {} : { month: "short" }) })} – ${sun.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}`;
        })();

  const isTodayAnchor = anchor.toDateString() === now.toDateString();
  const teamCount = (id: string | null) =>
    allGroups.find((g) => g.teamId === id)?.members.length ?? 0;

  return (
    <div className="space-y-3">
      {/* Teams + booking */}
      <div className="flex flex-wrap items-center gap-2">
        {teams.length > 0 && (
          <div role="group" aria-label="Show teams" className="flex flex-wrap gap-1.5">
            {[
              { id: "all", name: "All teams", count: null as number | null },
              ...allGroups.map((g) => ({
                id: g.teamId ?? "none",
                name: g.teamName ?? "No team",
                count: teamCount(g.teamId),
              })),
            ].map((t) => (
              <button
                key={t.id}
                type="button"
                aria-pressed={teamFilter === t.id}
                onClick={() => setTeamFilter(t.id)}
                className={cn(
                  "flex h-8 items-center gap-1.5 rounded-full border px-3.5 text-[13px] transition-colors",
                  teamFilter === t.id
                    ? "border-[#c6dafc] bg-[#e8f0fe] font-medium text-[#174ea6]"
                    : "hover:bg-accent",
                )}
              >
                {t.name}
                {t.count !== null && <span className="text-muted-foreground">{t.count}</span>}
              </button>
            ))}
          </div>
        )}
        <div className="flex-1" />
        <Button
          className="h-10 gap-2 rounded-full bg-[#1967d2] pr-5 pl-4 text-white shadow-sm hover:bg-[#174ea6]"
          onClick={bookButton}
        >
          <Plus className="h-[18px] w-[18px]" /> Book a meeting
        </Button>
      </div>

      <div className="flex min-h-0 gap-4">
        {/* People, by team (like Google Calendar's "Other calendars") */}
        {!isMobile && (
          <aside className="w-60 shrink-0 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">People</h2>
              <div className="flex gap-1 text-[11px]">
                <button
                  type="button"
                  className="rounded px-1.5 py-0.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                  onClick={() => setHidden(new Set())}
                >
                  All
                </button>
                <button
                  type="button"
                  className="rounded px-1.5 py-0.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                  onClick={() => {
                    setTeamFilter("all");
                    setHidden(new Set(members.filter((m) => m.id !== meId).map((m) => m.id)));
                  }}
                >
                  Only me
                </button>
              </div>
            </div>
            {allGroups.map((g) => (
              <div key={g.teamId ?? "none"} className="space-y-0.5">
                {g.teamName && (
                  <p className="px-2 pb-1 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                    {g.teamName}
                  </p>
                )}
                <ul className="space-y-0.5">
                  {g.members.map((m) => {
                    const on = !hidden.has(m.id);
                    const colour = colourOf(m.id);
                    const hrs = Math.round((hoursByMember.get(m.id) ?? 0) * 10) / 10;
                    const lead = teams.find((t) => t.id === g.teamId)?.lead_id === m.id;
                    return (
                      <li key={m.id}>
                        <label className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 hover:bg-accent">
                          <input
                            type="checkbox"
                            className="sr-only"
                            checked={on}
                            onChange={() => toggle(m.id)}
                          />
                          <span
                            aria-hidden
                            className="flex h-4 w-4 shrink-0 items-center justify-center rounded-[3px] border-2"
                            style={{ borderColor: colour, background: on ? colour : "transparent" }}
                          >
                            {on && (
                              <svg viewBox="0 0 12 12" className="h-3 w-3 text-white">
                                <path
                                  d="M2.5 6.2 5 8.6 9.6 3.6"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="1.8"
                                />
                              </svg>
                            )}
                          </span>
                          <span className="min-w-0 flex-1 truncate text-sm">
                            {m.name}
                            {m.id === meId ? (
                              <span className="ml-1 text-xs text-muted-foreground">(you)</span>
                            ) : (
                              lead && (
                                <span className="ml-1 text-xs text-muted-foreground">· lead</span>
                              )
                            )}
                          </span>
                          {hrs > 0 && (
                            <span className="text-[11px] tabular-nums text-muted-foreground">
                              {hrs}h
                            </span>
                          )}
                        </label>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
            <div className="space-y-2 rounded-lg bg-muted/60 p-3 text-[11px] leading-relaxed text-muted-foreground">
              <p className="flex items-center gap-2">
                <span className="inline-flex h-3.5 w-5 items-center justify-center rounded-[3px] bg-[#1967d2] text-white">
                  <Users className="h-2.5 w-2.5" />
                </span>
                Meeting
              </p>
              <p className="flex items-center gap-2">
                <span className="inline-block h-3.5 w-5 rounded-[3px] border-[1.5px] border-dashed border-[#8e24aa]" />
                Invited — waiting for a reply
              </p>
              <p>
                Drag across anyone’s free time to book a meeting with them. Hours = completed
                blocks.
              </p>
            </div>
          </aside>
        )}

        <div className="min-w-0 flex-1 space-y-3">
          {/* Toolbar */}
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              className="h-9 rounded-full px-4"
              onClick={() => setAnchor(startOfDay(new Date()))}
              disabled={isTodayAnchor && view === "day"}
            >
              Today
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-full"
              onClick={() => shift(-1)}
              aria-label="Previous"
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-full"
              onClick={() => shift(1)}
              aria-label="Next"
            >
              <ChevronRight className="h-5 w-5" />
            </Button>
            <h2 className="ml-1 text-lg font-medium sm:text-xl">{title}</h2>
            {loading && <span className="text-xs text-muted-foreground">Loading…</span>}
            <div className="flex-1" />
            <div className="inline-flex rounded-full border p-0.5">
              {(["day", "week"] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => {
                    setPopover(null);
                    setQuick(null);
                    setView(v);
                  }}
                  className={cn(
                    "rounded-full px-4 py-1.5 text-sm transition-colors",
                    view === v
                      ? "bg-[#e8f0fe] font-medium text-[#174ea6]"
                      : "text-muted-foreground hover:bg-accent",
                  )}
                >
                  {v === "day" ? "Day" : "Week"}
                </button>
              ))}
            </div>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          {view === "day" ? (
            <TeamDayGrid
              groups={groups}
              blocks={visibleBlocks}
              day={anchor}
              now={now}
              meId={meId}
              colourOf={colourOf}
              onBlockClick={(b, e) => {
                setQuick(null);
                setPopover({ block: b, x: e.clientX, y: e.clientY });
              }}
              selection={quick?.slot ?? null}
              onSelectSlot={(slot, rect) => {
                setPopover(null);
                setQuick({ slot, anchor: rect });
              }}
            />
          ) : (
            <TeamWeekTimeline
              groups={groups}
              blocks={visibleBlocks}
              weekStart={mondayOf(anchor)}
              now={now}
              meId={meId}
              colourOf={colourOf}
              onBlockClick={(b, e) => setPopover({ block: b, x: e.clientX, y: e.clientY })}
            />
          )}

          {/* Legend on mobile (no sidebar) */}
          {isMobile && (
            <div className="flex flex-wrap gap-2">
              {members.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => toggle(m.id)}
                  className={cn(
                    "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs",
                    hidden.has(m.id) && "opacity-40",
                  )}
                >
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ background: colourOf(m.id) }}
                  />
                  {m.name.split(" ")[0]}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {popover && (
        <BlockPopover
          state={popover}
          member={memberById.get(popover.block.user_id)}
          organiser={
            popover.block.organiser_id ? memberById.get(popover.block.organiser_id) : undefined
          }
          colour={colourOf(popover.block.user_id)}
          isMe={popover.block.user_id === meId}
          now={now}
          onClose={() => setPopover(null)}
          onOpenMeeting={(id) => {
            setPopover(null);
            setMeetingId(id);
          }}
        />
      )}

      {quick && (
        <QuickBook
          state={quick}
          member={memberById.get(quick.slot.memberId)}
          isMe={quick.slot.memberId === meId}
          colour={colourOf(quick.slot.memberId)}
          busy={blocks.some(
            (b) =>
              b.user_id === quick.slot.memberId &&
              new Date(b.start) < quick.slot.end &&
              new Date(b.end) > quick.slot.start,
          )}
          onClose={() => setQuick(null)}
          onMore={(t) =>
            openBook({
              title: t,
              start: quick.slot.start,
              end: quick.slot.end,
              guestIds: quick.slot.memberId === meId ? [] : [quick.slot.memberId],
            })
          }
          onDone={() => {
            setQuick(null);
            load(true);
          }}
        />
      )}

      <BookMeetingDialog open={bookOpen} onOpenChange={setBookOpen} initial={bookInitial} />

      <MeetingDetailsDialog
        meetingId={meetingId}
        onOpenChange={(open) => !open && setMeetingId(null)}
        onEdit={editMeeting}
        colourOf={colourOf}
      />
    </div>
  );
}

/** Quick booking card next to the time picked in someone's column */
function QuickBook({
  state,
  member,
  isMe,
  colour,
  busy,
  onClose,
  onMore,
  onDone,
}: {
  state: NonNullable<QuickState>;
  member: TeamMember | undefined;
  isMe: boolean;
  colour: string;
  busy: boolean;
  onClose: () => void;
  onMore: (title: string) => void;
  onDone: () => void;
}) {
  const [title, setTitle] = useState("");
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { slot, anchor } = state;

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const width = 320;
  const vw = typeof window === "undefined" ? 1280 : window.innerWidth;
  const vh = typeof window === "undefined" ? 800 : window.innerHeight;
  // Beside the column: on the right if there's room, else on the left
  const left =
    anchor.right + 12 + width < vw ? anchor.right + 12 : Math.max(12, anchor.left - width - 12);
  const top = Math.max(12, Math.min(anchor.top - 40, vh - 300));
  const first = member?.name.split(" ")[0] ?? "them";

  async function save(e?: React.FormEvent) {
    e?.preventDefault();
    const t = title.trim() || (isMe ? "Focus time" : `Meeting with ${first}`);
    setSaving(true);
    const res = isMe
      ? await fetch("/api/time-blocks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: t,
            start: slot.start.toISOString(),
            end: slot.end.toISOString(),
          }),
        })
      : await fetch("/api/meetings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: t,
            start: slot.start.toISOString(),
            end: slot.end.toISOString(),
            guest_ids: [slot.memberId],
            tz: getBrowserTimeZone(),
          }),
        });
    setSaving(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      toast.error(d.error || "Couldn’t save");
      return;
    }
    toast.success(isMe ? "Added to your calendar" : `Invite sent to ${member?.name ?? "them"}`);
    emitMeetingChanged();
    onDone();
  }

  const day = slot.start.toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} aria-hidden />
      <form
        role="dialog"
        aria-label={isMe ? "Add a block" : `Book a meeting with ${member?.name ?? "colleague"}`}
        onSubmit={save}
        className="fixed z-50 space-y-3 rounded-2xl border bg-background p-4 shadow-xl"
        style={{ left, top, width }}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute top-2 right-2 rounded-full p-1.5 text-muted-foreground hover:bg-accent"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>
        <label className="block pr-6">
          <span className="sr-only">Title</span>
          <input
            ref={inputRef}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={isMe ? "Add title" : `Meeting with ${first}`}
            maxLength={200}
            className="w-full border-b-2 border-[#1967d2] bg-transparent pb-1.5 text-lg outline-none placeholder:text-muted-foreground"
          />
        </label>
        <p className="flex items-center gap-2.5 text-sm text-muted-foreground">
          <Clock className="h-4 w-4 shrink-0" />
          {day} · {fmtTime(slot.start)} – {fmtTime(slot.end)}
        </p>
        {!isMe && member && (
          <div className="flex items-center gap-2.5 text-sm">
            <Users className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="flex items-center gap-2 rounded-full border py-0.5 pr-2.5 pl-0.5">
              <span
                className="flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-semibold text-white"
                style={{ background: colour }}
              >
                {initials(member.name)}
              </span>
              {member.name}
              <span className={cn("text-xs", busy ? "text-[#8a4b00]" : "text-[#137333]")}>
                {busy ? "busy" : "free"}
              </span>
            </span>
          </div>
        )}
        {isMe && <p className="text-xs text-muted-foreground">A block on your own calendar.</p>}
        <div className="flex items-center justify-end gap-2 pt-1">
          <Button
            type="button"
            variant="ghost"
            className="rounded-full text-[#1967d2]"
            onClick={() => onMore(title.trim())}
          >
            {isMe ? "Book a meeting instead" : "More options"}
          </Button>
          <Button
            type="submit"
            disabled={saving}
            className="rounded-full bg-[#1967d2] px-4 text-white hover:bg-[#174ea6]"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {isMe ? "Save" : "Send invite"}
          </Button>
        </div>
      </form>
    </>
  );
}

function BlockPopover({
  state,
  member,
  organiser,
  colour,
  isMe,
  now,
  onClose,
  onOpenMeeting,
}: {
  state: NonNullable<PopoverState>;
  member: TeamMember | undefined;
  organiser: TeamMember | undefined;
  colour: string;
  isMe: boolean;
  now: Date;
  onClose: () => void;
  onOpenMeeting: (meetingId: string) => void;
}) {
  const { block } = state;
  const width = 320;
  const left = Math.max(12, Math.min(state.x + 12, window.innerWidth - width - 12));
  const top = Math.max(12, Math.min(state.y - 20, window.innerHeight - 280));
  const start = new Date(block.start);
  const end = new Date(block.end);
  const pending = block.rsvp === "pending";
  const status = pending
    ? "Invited — no reply yet"
    : block.done
      ? "Done"
      : start <= now && end > now
        ? "In progress"
        : end <= now
          ? "Not marked done"
          : "Planned";

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} aria-hidden />
      <div
        role="dialog"
        aria-label={block.title}
        className="fixed z-50 rounded-2xl border bg-background p-4 shadow-xl"
        style={{ left, top, width }}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute top-2 right-2 rounded-full p-1.5 text-muted-foreground hover:bg-accent"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>
        <div className="flex gap-3 pr-6">
          <span
            className="mt-1.5 h-3.5 w-3.5 shrink-0 rounded-[4px]"
            style={{ background: colour }}
          />
          <div className="min-w-0">
            <p className={cn("text-base font-medium leading-snug", block.done && "line-through")}>
              {block.title}
            </p>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {start.toLocaleDateString(undefined, {
                weekday: "long",
                day: "numeric",
                month: "long",
              })}
              {" · "}
              {fmtTime(block.start)} – {fmtTime(block.end)}
            </p>
          </div>
        </div>
        <div className="mt-3 space-y-2 text-sm">
          {member && (
            <div className="flex items-center gap-3">
              <span
                className="flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-semibold text-white"
                style={{ background: colour }}
              >
                {initials(member.name)}
              </span>
              <span>
                {member.name}{" "}
                <span className="text-xs capitalize text-muted-foreground">· {member.role}</span>
              </span>
            </div>
          )}
          {block.meeting_id && (
            <div className="flex items-center gap-3">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span>Meeting{organiser ? ` organised by ${organiser.name}` : ""}</span>
            </div>
          )}
          {block.goal && (
            <div className="flex items-center gap-3">
              <Target className="h-4 w-4 text-muted-foreground" />
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full" style={{ background: block.goal.colour }} />
                {block.goal.title}
              </span>
            </div>
          )}
          <div className="flex items-center gap-3">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span>
              {status}
              {block.category && !block.meeting_id ? ` · ${block.category}` : ""}
            </span>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
          {block.meeting_id && (
            <Button
              size="sm"
              className="rounded-full"
              onClick={() => onOpenMeeting(block.meeting_id!)}
            >
              Open meeting
            </Button>
          )}
          {member && (
            <Link
              href={isMe ? "/calendar" : `/team/${member.id}`}
              className="inline-flex items-center gap-1 text-sm font-medium text-[#1a73e8] hover:underline"
            >
              {isMe ? "Open my calendar" : `Open ${member.name.split(" ")[0]}'s schedule`}
              <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          )}
        </div>
      </div>
    </>
  );
}
