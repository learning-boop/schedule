import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-helpers";
import { appOrigin } from "@/lib/app-url";
import {
  MeetingError,
  cancelMeeting,
  meetingDetails,
  parseMeetingInput,
  updateMeeting,
} from "@/lib/meetings";

type Ctx = { params: Promise<{ meetingId: string }> };

function errorResponse(err: unknown) {
  if (err instanceof MeetingError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  throw err;
}

/** GET /api/meetings/:id — details, guests and their replies (anyone in the company) */
export async function GET(_request: Request, { params }: Ctx) {
  const me = await getAuthUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { meetingId } = await params;
  const details = await meetingDetails(me, meetingId);
  if (!details) return NextResponse.json({ error: "Meeting not found" }, { status: 404 });
  return NextResponse.json(details);
}

/**
 * PUT /api/meetings/:id — organiser: change title, time, guests, agenda or link.
 * Moving the time asks every guest again.
 */
export async function PUT(request: Request, { params }: Ctx) {
  const me = await getAuthUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { meetingId } = await params;
  try {
    const input = parseMeetingInput(await request.json().catch(() => ({})), true);
    await updateMeeting(me, meetingId, input, appOrigin(request));
    return NextResponse.json(await meetingDetails(me, meetingId));
  } catch (err) {
    return errorResponse(err);
  }
}

/** DELETE /api/meetings/:id?tz=… — organiser: cancel for everyone */
export async function DELETE(request: Request, { params }: Ctx) {
  const me = await getAuthUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { meetingId } = await params;
  const tz = new URL(request.url).searchParams.get("tz");
  try {
    await cancelMeeting(me, meetingId, appOrigin(request), tz);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
