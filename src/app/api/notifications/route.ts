import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";

/** GET /api/notifications — latest notifications and the unread count */
export async function GET() {
  const me = await getAuthUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [items, unread] = await Promise.all([
    prisma.notification.findMany({
      where: { user_id: me.id },
      orderBy: { created_at: "desc" },
      take: 30,
      include: { actor: { select: { id: true, name: true } } },
    }),
    prisma.notification.count({ where: { user_id: me.id, read_at: null } }),
  ]);

  // For invites, show whether they still need a reply
  const meetingIds = [
    ...new Set(
      items.filter((n) => n.type === "meeting_invite" && n.meeting_id).map((n) => n.meeting_id!),
    ),
  ];
  const replies = meetingIds.length
    ? await prisma.meetingGuest.findMany({
        where: { user_id: me.id, meeting_id: { in: meetingIds } },
        select: { meeting_id: true, response: true },
      })
    : [];
  const replyByMeeting = new Map(replies.map((r) => [r.meeting_id, r.response]));

  return NextResponse.json({
    unread,
    items: items.map((n) => ({
      id: n.id,
      type: n.type,
      data: n.data,
      read: !!n.read_at,
      created_at: n.created_at,
      actor: n.actor,
      meeting_id: n.meeting_id,
      // null when the meeting is gone (cancelled) or you were removed
      my_response: n.meeting_id ? (replyByMeeting.get(n.meeting_id) ?? null) : null,
    })),
  });
}
