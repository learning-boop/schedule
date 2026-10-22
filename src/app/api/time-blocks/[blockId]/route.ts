import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { appOrigin } from "@/lib/app-url";
import { MeetingError, cancelMeeting, respondToMeeting, updateMeeting } from "@/lib/meetings";

type Ctx = { params: Promise<{ blockId: string }> };

function meetingError(err: unknown) {
  if (err instanceof MeetingError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  throw err;
}

export async function PUT(request: Request, { params }: Ctx) {
  const me = await getAuthUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { blockId } = await params;
  const block = await prisma.timeBlock.findFirst({
    where: { id: blockId, user_id: me.id },
    include: { meeting: { select: { organiser_id: true } } },
  });
  if (!block) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await request.json();
  const { title, goal_id, start, end, done, work_note, category } = body;

  // A meeting's title and time belong to the meeting: only its organiser can
  // change them, and the change applies to everyone's copy.
  if (block.meeting_id && block.meeting) {
    const newStart = start !== undefined ? new Date(start) : block.start;
    const newEnd = end !== undefined ? new Date(end) : block.end;
    const moved =
      newStart.getTime() !== block.start.getTime() || newEnd.getTime() !== block.end.getTime();
    const renamed = title !== undefined && title !== block.title;
    if (moved || renamed) {
      if (block.meeting.organiser_id !== me.id) {
        return NextResponse.json(
          { error: "Only the organiser can move or rename this meeting" },
          { status: 403 },
        );
      }
      try {
        await updateMeeting(
          me,
          block.meeting_id,
          {
            ...(renamed && { title: String(title).trim().slice(0, 200) || block.title }),
            ...(moved && { start: newStart, end: newEnd }),
            tz: typeof body.tz === "string" ? body.tz : null,
          },
          appOrigin(request),
        );
      } catch (err) {
        return meetingError(err);
      }
    }
  }

  const ownFields = {
    ...(goal_id !== undefined && { goal_id: goal_id || null }),
    ...(done !== undefined && { done }),
    ...(work_note !== undefined && { work_note }),
    ...(category !== undefined && !block.meeting_id && { category }),
    ...(!block.meeting_id && {
      ...(title !== undefined && { title }),
      ...(start !== undefined && { start: new Date(start) }),
      ...(end !== undefined && { end: new Date(end) }),
    }),
  };
  if (Object.keys(ownFields).length) {
    await prisma.timeBlock.update({ where: { id: block.id }, data: ownFields });
  }

  const updated = await prisma.timeBlock.findUnique({
    where: { id: blockId },
    include: { goal: { select: { title: true, colour: true } } },
  });

  return NextResponse.json(updated);
}

/**
 * DELETE — removes your block. For a meeting: the organiser cancels it for
 * everyone; a guest declines it.
 */
export async function DELETE(request: Request, { params }: Ctx) {
  const me = await getAuthUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { blockId } = await params;
  const block = await prisma.timeBlock.findFirst({
    where: { id: blockId, user_id: me.id },
    include: { meeting: { select: { organiser_id: true } } },
  });
  if (!block) return NextResponse.json({ success: true });

  if (block.meeting_id && block.meeting) {
    try {
      if (block.meeting.organiser_id === me.id) {
        const tz = new URL(request.url).searchParams.get("tz");
        await cancelMeeting(me, block.meeting_id, appOrigin(request), tz);
      } else {
        await respondToMeeting(me, block.meeting_id, "declined", null);
      }
    } catch (err) {
      return meetingError(err);
    }
    return NextResponse.json({ success: true });
  }

  await prisma.timeBlock.delete({ where: { id: block.id } });
  return NextResponse.json({ success: true });
}
