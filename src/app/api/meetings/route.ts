import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-helpers";
import { appOrigin } from "@/lib/app-url";
import { MeetingError, createMeeting, parseMeetingInput } from "@/lib/meetings";

/**
 * POST /api/meetings — book a meeting with colleagues.
 * Body: { title, start, end, guest_ids: string[], agenda?, location?, tz? }
 * It lands on everyone's calendar; guests are notified and can accept or decline.
 */
export async function POST(request: Request) {
  const me = await getAuthUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!me.org_id) return NextResponse.json({ error: "No organisation" }, { status: 403 });

  try {
    const input = parseMeetingInput(await request.json().catch(() => ({})));
    const meeting = await createMeeting(me, input, appOrigin(request));
    return NextResponse.json({ meeting: { id: meeting.id } });
  } catch (err) {
    if (err instanceof MeetingError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}
