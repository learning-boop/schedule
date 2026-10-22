import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import {
  DEFAULT_WORK_DAYS,
  DEFAULT_WORK_END,
  DEFAULT_WORK_START,
  cleanCompanyName,
  cleanWorkDays,
  cleanWorkHours,
} from "@/lib/company";
import { cleanTeamName } from "@/lib/teams";

/**
 * POST /api/company/create — start a new company; the caller becomes its founder.
 * Body: { name, team_name?, work_days?, work_start?, work_end? }
 * Anyone signed in who isn't in a company yet can do this; there is no limit
 * on the number of companies, and each one is private.
 */
export async function POST(request: Request) {
  const me = await getAuthUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (me.org_id) {
    return NextResponse.json({ error: "You’re already in a company" }, { status: 400 });
  }

  const body = await request.json().catch(() => ({}));
  const name = cleanCompanyName(body.name);
  if (!name) return NextResponse.json({ error: "Enter a company name" }, { status: 400 });

  let teamName: string | null = null;
  if (typeof body.team_name === "string" && body.team_name.trim()) {
    teamName = cleanTeamName(body.team_name);
    if (!teamName) {
      return NextResponse.json({ error: "Team names can be up to 60 characters" }, { status: 400 });
    }
  }

  const workDays = body.work_days === undefined ? DEFAULT_WORK_DAYS : cleanWorkDays(body.work_days);
  if (!workDays)
    return NextResponse.json({ error: "Pick at least one working day" }, { status: 400 });
  const hours =
    body.work_start === undefined && body.work_end === undefined
      ? { start: DEFAULT_WORK_START, end: DEFAULT_WORK_END }
      : cleanWorkHours(body.work_start, body.work_end);
  if (!hours) {
    return NextResponse.json({ error: "Working hours must end after they start" }, { status: 400 });
  }

  const org = await prisma.$transaction(async (tx) => {
    const org = await tx.organisation.create({
      data: { name, work_days: workDays, work_start: hours.start, work_end: hours.end },
    });
    const team = teamName
      ? await tx.team.create({ data: { org_id: org.id, name: teamName, lead_id: me.id } })
      : null;
    await tx.user.update({
      where: { id: me.id },
      data: { org_id: org.id, role: "founder", manager_id: null, team_id: team?.id ?? null },
    });
    return org;
  });

  return NextResponse.json({ org: { id: org.id, name: org.name } });
}
