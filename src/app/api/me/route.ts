import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-helpers";

/** GET /api/me — who is signed in, and their company (or null) */
export async function GET() {
  const me = await getAuthUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const org = me.organisation;
  return NextResponse.json({
    id: me.id,
    name: me.name,
    email: me.email,
    role: me.role,
    team_id: me.team_id,
    org: org
      ? {
          id: org.id,
          name: org.name,
          work_days: org.work_days,
          work_start: org.work_start,
          work_end: org.work_end,
        }
      : null,
  });
}
