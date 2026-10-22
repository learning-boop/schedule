import { after } from "next/server";
import { prisma } from "@/lib/prisma";
import { notify } from "@/lib/notify";
import { emailConfigured, formatMeetingTime, meetingEmail, trySendMail } from "@/lib/email";

/**
 * Meetings between colleagues. Everyone taking part gets a TimeBlock linked to
 * the meeting (category "Meeting"), so it appears on their calendar and in
 * hours, "Right now" and PDFs. Guests' blocks carry rsvp = "pending" until
 * they accept; declining removes the block.
 */

export const MEETING_CATEGORY = "Meeting";
const MAX_MEETING_MS = 12 * 60 * 60 * 1000;
const MAX_GUESTS = 50;

export class MeetingError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}

type Me = { id: string; name: string; email: string; org_id: string | null };

export type MeetingInput = {
  title?: string;
  start?: Date;
  end?: Date;
  agenda?: string | null;
  location?: string | null;
  guestIds?: string[];
  /** Organiser's time zone, used for the times written in emails */
  tz?: string | null;
};

function cleanText(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t ? t.slice(0, max) : null;
}

/** Validate a create/update request body. `partial` allows missing fields (for updates). */
export function parseMeetingInput(body: unknown, partial = false): MeetingInput {
  const b = (body ?? {}) as Record<string, unknown>;
  const out: MeetingInput = {};

  if (b.title !== undefined || !partial) {
    const title = cleanText(b.title, 200);
    if (!title) throw new MeetingError("Add a title");
    out.title = title;
  }
  if (b.start !== undefined || b.end !== undefined || !partial) {
    const start = new Date(String(b.start ?? ""));
    const end = new Date(String(b.end ?? ""));
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      throw new MeetingError("Pick a start and end time");
    }
    if (end <= start) throw new MeetingError("The meeting must end after it starts");
    if (end.getTime() - start.getTime() > MAX_MEETING_MS) {
      throw new MeetingError("Meetings can be at most 12 hours long");
    }
    out.start = start;
    out.end = end;
  }
  if (b.agenda !== undefined) out.agenda = cleanText(b.agenda, 4000);
  if (b.location !== undefined) out.location = cleanText(b.location, 500);
  if (b.guest_ids !== undefined || !partial) {
    if (!Array.isArray(b.guest_ids)) throw new MeetingError("Add at least one guest");
    const ids = [...new Set(b.guest_ids.filter((x): x is string => typeof x === "string"))];
    if (ids.length > MAX_GUESTS) throw new MeetingError(`At most ${MAX_GUESTS} guests`);
    out.guestIds = ids;
  }
  if (typeof b.tz === "string") out.tz = b.tz;
  return out;
}

function snapshot(m: { title: string; start: Date; end: Date }, organiserName: string) {
  return {
    title: m.title,
    start: m.start.toISOString(),
    end: m.end.toISOString(),
    organiser: organiserName,
  };
}

function emailGuests(
  guests: { email: string }[],
  kind: "invite" | "moved" | "cancelled",
  m: {
    id: string;
    title: string;
    start: Date;
    end: Date;
    agenda: string | null;
    location: string | null;
  },
  organiser: { name: string; email: string },
  origin: string,
  tz: string | null | undefined,
) {
  if (guests.length === 0 || !emailConfigured()) return;
  const mail = meetingEmail({
    kind,
    organiserName: organiser.name,
    title: m.title,
    when: formatMeetingTime(m.start, m.end, tz),
    agenda: m.agenda,
    location: m.location,
    link: `${origin}/calendar?meeting=${m.id}`,
  });
  // Send after the response so booking stays fast
  after(async () => {
    for (const g of guests) {
      await trySendMail({
        to: g.email,
        ...mail,
        replyTo: organiser.email,
        fromName: `${organiser.name} via Schedule Planner`,
      });
    }
  });
}

async function guestsInOrg(orgId: string, ids: string[]) {
  if (ids.length === 0) return [];
  const users = await prisma.user.findMany({
    where: { id: { in: ids }, org_id: orgId },
    select: { id: true, name: true, email: true },
  });
  if (users.length !== ids.length) {
    throw new MeetingError("Some guests aren’t in your company", 400);
  }
  return users;
}

export async function createMeeting(me: Me, input: MeetingInput, origin: string) {
  if (!me.org_id) throw new MeetingError("No organisation", 403);
  const guestIds = (input.guestIds ?? []).filter((id) => id !== me.id);
  if (guestIds.length === 0) throw new MeetingError("Add at least one guest");
  const guests = await guestsInOrg(me.org_id, guestIds);
  const { title, start, end } = input as Required<Pick<MeetingInput, "title" | "start" | "end">>;

  const meeting = await prisma.$transaction(async (tx) => {
    const m = await tx.meeting.create({
      data: {
        org_id: me.org_id!,
        organiser_id: me.id,
        title,
        start,
        end,
        agenda: input.agenda ?? null,
        location: input.location ?? null,
      },
    });
    await tx.meetingGuest.createMany({
      data: [
        { meeting_id: m.id, user_id: me.id, response: "accepted", responded_at: new Date() },
        ...guests.map((g) => ({ meeting_id: m.id, user_id: g.id })),
      ],
    });
    await tx.timeBlock.createMany({
      data: [me.id, ...guests.map((g) => g.id)].map((userId) => ({
        user_id: userId,
        title,
        start,
        end,
        category: MEETING_CATEGORY,
        meeting_id: m.id,
        rsvp: userId === me.id ? "accepted" : "pending",
      })),
    });
    return m;
  });

  await notify(
    guests.map((g) => ({
      user_id: g.id,
      actor_id: me.id,
      meeting_id: meeting.id,
      type: "meeting_invite" as const,
      data: snapshot(meeting, me.name),
    })),
  );
  emailGuests(guests, "invite", meeting, me, origin, input.tz);
  return meeting;
}

async function loadOwnMeeting(me: Me, meetingId: string) {
  const meeting = await prisma.meeting.findUnique({
    where: { id: meetingId },
    include: { guests: { include: { user: { select: { id: true, name: true, email: true } } } } },
  });
  if (!meeting || meeting.org_id !== me.org_id) throw new MeetingError("Meeting not found", 404);
  if (meeting.organiser_id !== me.id) {
    throw new MeetingError("Only the organiser can change this meeting", 403);
  }
  return meeting;
}

export async function updateMeeting(
  me: Me,
  meetingId: string,
  input: MeetingInput,
  origin: string,
) {
  const meeting = await loadOwnMeeting(me, meetingId);
  const start = input.start ?? meeting.start;
  const end = input.end ?? meeting.end;
  const title = input.title ?? meeting.title;
  const timeChanged =
    start.getTime() !== meeting.start.getTime() || end.getTime() !== meeting.end.getTime();

  const current = meeting.guests.filter((g) => g.user_id !== me.id);
  const currentIds = new Set(current.map((g) => g.user_id));
  const nextIds = input.guestIds
    ? new Set(input.guestIds.filter((id) => id !== me.id))
    : new Set(currentIds);
  if (nextIds.size === 0) throw new MeetingError("Keep at least one guest");
  const addedIds = [...nextIds].filter((id) => !currentIds.has(id));
  const removed = current.filter((g) => !nextIds.has(g.user_id));
  const added = await guestsInOrg(me.org_id!, addedIds);
  const kept = current.filter((g) => nextIds.has(g.user_id));

  const updated = await prisma.$transaction(async (tx) => {
    const m = await tx.meeting.update({
      where: { id: meeting.id },
      data: {
        title,
        start,
        end,
        ...(input.agenda !== undefined && { agenda: input.agenda }),
        ...(input.location !== undefined && { location: input.location }),
      },
    });

    if (removed.length) {
      const ids = removed.map((g) => g.user_id);
      await tx.meetingGuest.deleteMany({ where: { meeting_id: m.id, user_id: { in: ids } } });
      await tx.timeBlock.deleteMany({ where: { meeting_id: m.id, user_id: { in: ids } } });
    }

    if (timeChanged) {
      // Moving a meeting asks everyone again
      await tx.meetingGuest.updateMany({
        where: { meeting_id: m.id, user_id: { not: me.id } },
        data: { response: "pending", note: null, responded_at: null },
      });
      await tx.timeBlock.updateMany({
        where: { meeting_id: m.id, user_id: { not: me.id } },
        data: { rsvp: "pending" },
      });
      // Guests who had declined get the meeting back on their calendar
      const declined = kept.filter((g) => g.response === "declined").map((g) => g.user_id);
      if (declined.length) {
        await tx.timeBlock.createMany({
          data: declined.map((userId) => ({
            user_id: userId,
            title,
            start,
            end,
            category: MEETING_CATEGORY,
            meeting_id: m.id,
            rsvp: "pending",
          })),
        });
      }
    }

    if (added.length) {
      await tx.meetingGuest.createMany({
        data: added.map((g) => ({ meeting_id: m.id, user_id: g.id })),
      });
      await tx.timeBlock.createMany({
        data: added.map((g) => ({
          user_id: g.id,
          title,
          start,
          end,
          category: MEETING_CATEGORY,
          meeting_id: m.id,
          rsvp: "pending",
        })),
      });
    }

    await tx.timeBlock.updateMany({ where: { meeting_id: m.id }, data: { title, start, end } });
    return m;
  });

  const snap = snapshot(updated, me.name);
  await notify([
    ...added.map((g) => ({
      user_id: g.id,
      actor_id: me.id,
      meeting_id: updated.id,
      type: "meeting_invite" as const,
      data: snap,
    })),
    ...removed.map((g) => ({
      user_id: g.user_id,
      actor_id: me.id,
      meeting_id: updated.id,
      type: "meeting_cancelled" as const,
      data: { ...snapshot(meeting, me.name), removed: true },
    })),
    ...(timeChanged
      ? kept.map((g) => ({
          user_id: g.user_id,
          actor_id: me.id,
          meeting_id: updated.id,
          type: "meeting_moved" as const,
          data: {
            ...snap,
            from_start: meeting.start.toISOString(),
            from_end: meeting.end.toISOString(),
          },
        }))
      : []),
  ]);

  emailGuests(added, "invite", updated, me, origin, input.tz);
  if (timeChanged) {
    emailGuests(
      kept.map((g) => g.user),
      "moved",
      updated,
      me,
      origin,
      input.tz,
    );
  }
  return updated;
}

export async function cancelMeeting(me: Me, meetingId: string, origin: string, tz?: string | null) {
  const meeting = await loadOwnMeeting(me, meetingId);
  const others = meeting.guests.filter((g) => g.user_id !== me.id);
  await notify(
    others.map((g) => ({
      user_id: g.user_id,
      actor_id: me.id,
      meeting_id: meeting.id,
      type: "meeting_cancelled" as const,
      data: snapshot(meeting, me.name),
    })),
  );
  emailGuests(
    others.filter((g) => g.response !== "declined").map((g) => g.user),
    "cancelled",
    meeting,
    me,
    origin,
    tz,
  );
  // Blocks and guest rows go with it; notifications keep their snapshot
  await prisma.meeting.delete({ where: { id: meeting.id } });
}

/**
 * Someone is leaving a company (removed by the founder, or moving to another
 * one). Upcoming meetings they organise there are cancelled — everyone else is
 * told — and they drop out of the ones they were invited to. Past meetings stay
 * in their planner.
 */
export async function leaveCompanyMeetings(
  user: { id: string; name: string; email: string },
  orgId: string,
  origin: string,
  tz?: string | null,
) {
  const now = new Date();
  const organised = await prisma.meeting.findMany({
    where: { org_id: orgId, organiser_id: user.id, end: { gt: now } },
    include: { guests: { include: { user: { select: { id: true, name: true, email: true } } } } },
  });
  for (const m of organised) {
    const others = m.guests.filter((g) => g.user_id !== user.id);
    await notify(
      others.map((g) => ({
        user_id: g.user_id,
        actor_id: user.id,
        meeting_id: m.id,
        type: "meeting_cancelled" as const,
        data: snapshot(m, user.name),
      })),
    );
    emailGuests(
      others.filter((g) => g.response !== "declined").map((g) => g.user),
      "cancelled",
      m,
      user,
      origin,
      tz,
    );
  }
  if (organised.length) {
    await prisma.meeting.deleteMany({ where: { id: { in: organised.map((m) => m.id) } } });
  }

  const invited = await prisma.meetingGuest.findMany({
    where: { user_id: user.id, meeting: { org_id: orgId, end: { gt: now } } },
    select: { meeting_id: true },
  });
  const ids = invited.map((g) => g.meeting_id);
  if (ids.length) {
    await prisma.$transaction([
      prisma.timeBlock.deleteMany({ where: { user_id: user.id, meeting_id: { in: ids } } }),
      prisma.meetingGuest.deleteMany({ where: { user_id: user.id, meeting_id: { in: ids } } }),
    ]);
  }
}

export async function respondToMeeting(
  me: Me,
  meetingId: string,
  response: "accepted" | "declined",
  note: string | null,
) {
  const meeting = await prisma.meeting.findUnique({
    where: { id: meetingId },
    include: { organiser: { select: { id: true, name: true } } },
  });
  if (!meeting || meeting.org_id !== me.org_id) throw new MeetingError("Meeting not found", 404);
  if (meeting.organiser_id === me.id) {
    throw new MeetingError("You organised this meeting", 400);
  }
  const guest = await prisma.meetingGuest.findUnique({
    where: { meeting_id_user_id: { meeting_id: meetingId, user_id: me.id } },
  });
  if (!guest) throw new MeetingError("You’re not invited to this meeting", 403);

  await prisma.$transaction(async (tx) => {
    await tx.meetingGuest.update({
      where: { meeting_id_user_id: { meeting_id: meetingId, user_id: me.id } },
      data: { response, note, responded_at: new Date() },
    });
    if (response === "accepted") {
      const updatedBlocks = await tx.timeBlock.updateMany({
        where: { meeting_id: meetingId, user_id: me.id },
        data: { rsvp: "accepted", title: meeting.title, start: meeting.start, end: meeting.end },
      });
      if (updatedBlocks.count === 0) {
        await tx.timeBlock.create({
          data: {
            user_id: me.id,
            title: meeting.title,
            start: meeting.start,
            end: meeting.end,
            category: MEETING_CATEGORY,
            meeting_id: meetingId,
            rsvp: "accepted",
          },
        });
      }
    } else {
      await tx.timeBlock.deleteMany({ where: { meeting_id: meetingId, user_id: me.id } });
    }
  });

  // Tell the organiser (again only if the answer changed)
  if (guest.response !== response || (note && note !== guest.note)) {
    await notify([
      {
        user_id: meeting.organiser_id,
        actor_id: me.id,
        meeting_id: meeting.id,
        type: "meeting_response",
        data: { ...snapshot(meeting, meeting.organiser.name), response, note },
      },
    ]);
  }
}

/** Everything the meeting details card shows, for anyone in the same company */
export async function meetingDetails(me: Me, meetingId: string) {
  const meeting = await prisma.meeting.findUnique({
    where: { id: meetingId },
    include: {
      organiser: { select: { id: true, name: true } },
      guests: {
        include: { user: { select: { id: true, name: true } } },
      },
    },
  });
  if (!meeting || meeting.org_id !== me.org_id) return null;
  const mine = meeting.guests.find((g) => g.user_id === me.id);
  return {
    id: meeting.id,
    title: meeting.title,
    start: meeting.start,
    end: meeting.end,
    agenda: meeting.agenda,
    location: meeting.location,
    organiser: meeting.organiser,
    is_organiser: meeting.organiser_id === me.id,
    my_response: mine ? mine.response : null,
    guests: meeting.guests
      .map((g) => ({
        id: g.user.id,
        name: g.user.name,
        response: g.response,
        note: g.note,
        is_organiser: g.user_id === meeting.organiser_id,
      }))
      .sort((a, b) =>
        a.is_organiser === b.is_organiser ? a.name.localeCompare(b.name) : a.is_organiser ? -1 : 1,
      ),
  };
}
