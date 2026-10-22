"use client";

import { useEffect, useEffectEvent, useState } from "react";
import {
  AlignLeft,
  Check,
  Clock,
  Loader2,
  MapPin,
  Pencil,
  Trash2,
  Users,
  Video,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { initials, personColour } from "@/components/calendar/gcal";
import { asLink, fmtMeetingWhen } from "@/lib/format";
import { emitMeetingChanged } from "@/lib/app-events";
import { getBrowserTimeZone } from "@/lib/date-utils";

export type MeetingDetails = {
  id: string;
  title: string;
  start: string;
  end: string;
  agenda: string | null;
  location: string | null;
  organiser: { id: string; name: string };
  is_organiser: boolean;
  my_response: "pending" | "accepted" | "declined" | null;
  guests: {
    id: string;
    name: string;
    response: "pending" | "accepted" | "declined";
    note: string | null;
    is_organiser: boolean;
  }[];
};

const RESPONSE_LABEL = {
  accepted: "Going",
  declined: "Declined",
  pending: "Awaiting reply",
} as const;

type DetailsProps = {
  onOpenChange: (open: boolean) => void;
  /** Organiser: open the booking form to change the meeting */
  onEdit?: (meeting: MeetingDetails) => void;
  /** Called once the meeting has loaded (e.g. to show its day) */
  onLoaded?: (meeting: MeetingDetails) => void;
  colourOf?: (userId: string) => string;
};

export function MeetingDetailsDialog({
  meetingId,
  ...props
}: DetailsProps & { meetingId: string | null }) {
  // Keep showing the last meeting while the dialog animates closed
  const [shownId, setShownId] = useState(meetingId);
  if (meetingId && meetingId !== shownId) setShownId(meetingId);

  return (
    <Dialog open={!!meetingId} onOpenChange={props.onOpenChange}>
      <DialogContent className="max-h-[calc(100svh-2rem)] overflow-y-auto sm:max-w-md">
        {shownId && <MeetingDetailsBody key={shownId} meetingId={shownId} {...props} />}
      </DialogContent>
    </Dialog>
  );
}

function MeetingDetailsBody({
  meetingId,
  onOpenChange,
  onEdit,
  onLoaded,
  colourOf,
}: DetailsProps & { meetingId: string }) {
  const [meeting, setMeeting] = useState<MeetingDetails | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [declining, setDeclining] = useState(false);
  const [note, setNote] = useState("");
  const [confirmCancel, setConfirmCancel] = useState(false);

  const loaded = useEffectEvent((m: MeetingDetails) => onLoaded?.(m));

  useEffect(() => {
    let alive = true;
    fetch(`/api/meetings/${meetingId}`)
      .then(async (res) => {
        if (!res.ok) {
          if (alive) {
            setError(
              res.status === 404 ? "This meeting was cancelled." : "Couldn’t load the meeting.",
            );
          }
          return;
        }
        const data: MeetingDetails = await res.json();
        if (!alive) return;
        setMeeting(data);
        loaded(data);
      })
      .catch(() => {
        if (alive) setError("Couldn’t load the meeting.");
      });
    return () => {
      alive = false;
    };
  }, [meetingId]);

  async function respond(response: "accepted" | "declined") {
    if (!meeting) return;
    setBusy(response);
    const res = await fetch(`/api/meetings/${meeting.id}/respond`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ response, note: response === "declined" ? note : undefined }),
    });
    setBusy(null);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      toast.error(d.error || "Couldn’t send your reply");
      return;
    }
    setMeeting(await res.json());
    setDeclining(false);
    toast.success(
      response === "accepted" ? "You’re going" : "Declined — the organiser will be told",
    );
    emitMeetingChanged();
  }

  async function cancelMeeting() {
    if (!meeting) return;
    setBusy("cancel");
    const res = await fetch(
      `/api/meetings/${meeting.id}?tz=${encodeURIComponent(getBrowserTimeZone())}`,
      { method: "DELETE" },
    );
    setBusy(null);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      toast.error(d.error || "Couldn’t cancel the meeting");
      return;
    }
    toast.success("Meeting cancelled — everyone was told");
    emitMeetingChanged();
    onOpenChange(false);
  }

  const link = asLink(meeting?.location);
  const counts = meeting
    ? meeting.guests.reduce(
        (acc, g) => {
          if (!g.is_organiser) acc[g.response] += 1;
          return acc;
        },
        { accepted: 0, declined: 0, pending: 0 },
      )
    : null;

  return (
    <>
      {!meeting && !error && (
        <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading meeting…
          <DialogTitle className="sr-only">Meeting</DialogTitle>
        </div>
      )}
      {error && (
        <div className="py-6 text-sm text-muted-foreground">
          <DialogTitle className="mb-2 text-base">Meeting</DialogTitle>
          {error}
        </div>
      )}

      {meeting && (
        <div className="space-y-4 pt-1">
          <div className="flex gap-3 pr-8">
            <span
              className="mt-1.5 h-3.5 w-3.5 shrink-0 rounded-[4px]"
              style={{ background: colourOf?.(meeting.organiser.id) ?? "#1967d2" }}
            />
            <div className="min-w-0">
              <DialogTitle className="text-xl font-normal leading-snug">
                {meeting.title}
              </DialogTitle>
              <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
                <Clock className="h-3.5 w-3.5" />
                {fmtMeetingWhen(meeting.start, meeting.end)}
              </p>
            </div>
          </div>

          {meeting.location && (
            <div className="flex items-center gap-3 text-sm">
              {link ? (
                <Video className="h-4 w-4 shrink-0 text-muted-foreground" />
              ) : (
                <MapPin className="h-4 w-4 shrink-0 text-muted-foreground" />
              )}
              {link ? (
                <Button
                  size="sm"
                  className="h-8 rounded-full bg-[#1967d2] px-4 hover:bg-[#174ea6]"
                  nativeButton={false}
                  render={<a href={link} target="_blank" rel="noopener noreferrer" />}
                >
                  Join meeting
                </Button>
              ) : (
                <span>{meeting.location}</span>
              )}
              {link && (
                <span className="min-w-0 truncate text-xs text-muted-foreground">
                  {meeting.location}
                </span>
              )}
            </div>
          )}

          <div className="flex gap-3 text-sm">
            <Users className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0 flex-1 space-y-2.5">
              <div>
                <p className="font-medium">{meeting.guests.length} people</p>
                {counts && (
                  <p className="text-xs text-muted-foreground">
                    {counts.accepted} going · {counts.pending} awaiting · {counts.declined} declined
                  </p>
                )}
              </div>
              <ul className="space-y-2">
                {meeting.guests.map((g, i) => (
                  <li key={g.id} className="flex items-start gap-2.5">
                    <span
                      className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold text-white"
                      style={{ background: colourOf?.(g.id) ?? personColour(i) }}
                    >
                      {initials(g.name)}
                      <span
                        className={cn(
                          "absolute -right-0.5 -bottom-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full border-2 border-background",
                          g.response === "accepted" && "bg-[#188038]",
                          g.response === "declined" && "bg-[#c5221f]",
                          g.response === "pending" && "bg-[#9aa0a6]",
                        )}
                      >
                        {g.response === "accepted" && (
                          <Check className="h-2 w-2 text-white" strokeWidth={4} />
                        )}
                        {g.response === "declined" && (
                          <X className="h-2 w-2 text-white" strokeWidth={4} />
                        )}
                      </span>
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">{g.name}</span>
                      <span
                        className={cn(
                          "block text-xs",
                          g.response === "accepted" && "text-[#137333]",
                          g.response === "declined" && "text-[#a50e0e]",
                          g.response === "pending" && "text-muted-foreground",
                        )}
                      >
                        {g.is_organiser ? "Organiser" : RESPONSE_LABEL[g.response]}
                      </span>
                      {g.note && (
                        <span className="mt-1 block rounded-lg rounded-tl-sm bg-muted px-2.5 py-1.5 text-xs">
                          “{g.note}”
                        </span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {meeting.agenda && (
            <div className="flex gap-3 text-sm">
              <AlignLeft className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              <p className="whitespace-pre-wrap">{meeting.agenda}</p>
            </div>
          )}

          {/* Guest: reply */}
          {!meeting.is_organiser && meeting.my_response && (
            <div className="space-y-2 border-t pt-3">
              {declining ? (
                <>
                  <Textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Add a note for the organiser (optional), e.g. “Can we do 5pm?”"
                    rows={2}
                    maxLength={500}
                    autoFocus
                  />
                  <div className="flex justify-end gap-2">
                    <Button variant="ghost" size="sm" onClick={() => setDeclining(false)}>
                      Back
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => respond("declined")}
                      disabled={!!busy}
                    >
                      {busy === "declined" && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                      Decline
                    </Button>
                  </div>
                </>
              ) : (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="mr-auto text-sm text-muted-foreground">
                    {meeting.my_response === "pending"
                      ? "Going?"
                      : meeting.my_response === "accepted"
                        ? "You’re going"
                        : "You declined"}
                  </span>
                  <Button
                    size="sm"
                    className="rounded-full"
                    variant={meeting.my_response === "accepted" ? "secondary" : "default"}
                    onClick={() => respond("accepted")}
                    disabled={!!busy || meeting.my_response === "accepted"}
                  >
                    {busy === "accepted" && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    Yes
                  </Button>
                  <Button
                    size="sm"
                    className="rounded-full"
                    variant="outline"
                    onClick={() => setDeclining(true)}
                    disabled={!!busy || meeting.my_response === "declined"}
                  >
                    No
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Organiser: change or cancel */}
          {meeting.is_organiser && (
            <div className="flex flex-wrap items-center justify-end gap-2 border-t pt-3">
              {confirmCancel ? (
                <>
                  <span className="mr-auto text-sm">Cancel this meeting for everyone?</span>
                  <Button variant="ghost" size="sm" onClick={() => setConfirmCancel(false)}>
                    Keep it
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={cancelMeeting}
                    disabled={busy === "cancel"}
                  >
                    {busy === "cancel" && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    Cancel meeting
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mr-auto text-destructive hover:text-destructive"
                    onClick={() => setConfirmCancel(true)}
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Cancel meeting
                  </Button>
                  {onEdit && (
                    <Button size="sm" className="rounded-full" onClick={() => onEdit(meeting)}>
                      <Pencil className="h-3.5 w-3.5" /> Change time or guests
                    </Button>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      )}
    </>
  );
}
