import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-helpers";
import { MeetingError, meetingDetails, respondToMeeting } from "@/lib/meetings";

/** POST /api/meetings/:id/respond — guest: { response: "accepted"|"declined", note? } */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ meetingId: string }> },
) {
  const me = await getAuthUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { meetingId } = await params;

  const body = await request.json().catch(() => ({}));
  const response =
    body.response === "accepted" || body.response === "declined" ? body.response : null;
  if (!response) {
    return NextResponse.json({ error: "response must be accepted or declined" }, { status: 400 });
  }
  const note =
    typeof body.note === "string" && body.note.trim() ? body.note.trim().slice(0, 500) : null;

  try {
    await respondToMeeting(me, meetingId, response, note);
    return NextResponse.json(await meetingDetails(me, meetingId));
  } catch (err) {
    if (err instanceof MeetingError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}
