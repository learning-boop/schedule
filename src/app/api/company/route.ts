import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { emailConfigured } from "@/lib/email";
import { cleanCompanyName, cleanWorkDays, cleanWorkHours } from "@/lib/company";

/** GET /api/company — the caller's company settings */
export async function GET() {
  const me = await getAuthUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const org = me.organisation;
  if (!org) return NextResponse.json({ error: "No organisation" }, { status: 403 });

  const members = await prisma.user.count({ where: { org_id: org.id } });
  return NextResponse.json({
    org: {
      id: org.id,
      name: org.name,
      work_days: org.work_days,
      work_start: org.work_start,
      work_end: org.work_end,
      planner_visibility: org.planner_visibility,
      allow_comments: org.allow_comments,
      members,
    },
    me: { id: me.id, role: me.role },
    email_configured: emailConfigured(),
  });
}

/** PUT /api/company — founder: rename, set working days and hours */
export async function PUT(request: Request) {
  const me = await getAuthUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!me.org_id) return NextResponse.json({ error: "No organisation" }, { status: 403 });
  if (me.role !== "founder") return NextResponse.json({ error: "Founders only" }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  const data: { name?: string; work_days?: number[]; work_start?: number; work_end?: number } = {};

  if (body.name !== undefined) {
    const name = cleanCompanyName(body.name);
    if (!name) return NextResponse.json({ error: "Enter a company name" }, { status: 400 });
    data.name = name;
  }
  if (body.work_days !== undefined) {
    const days = cleanWorkDays(body.work_days);
    if (!days)
      return NextResponse.json({ error: "Pick at least one working day" }, { status: 400 });
    data.work_days = days;
  }
  if (body.work_start !== undefined || body.work_end !== undefined) {
    const hours = cleanWorkHours(
      body.work_start ?? me.organisation?.work_start,
      body.work_end ?? me.organisation?.work_end,
    );
    if (!hours) {
      return NextResponse.json(
        { error: "Working hours must end after they start" },
        { status: 400 },
      );
    }
    data.work_start = hours.start;
    data.work_end = hours.end;
  }
  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const org = await prisma.organisation.update({ where: { id: me.org_id }, data });
  return NextResponse.json({
    org: {
      id: org.id,
      name: org.name,
      work_days: org.work_days,
      work_start: org.work_start,
      work_end: org.work_end,
    },
  });
}
