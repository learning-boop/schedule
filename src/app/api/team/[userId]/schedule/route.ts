import { NextResponse } from "next/server";
import { canManage, getAuthUser, getColleague } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import {
  addDays,
  isDateStr,
  mondayOf,
  safeTimeZone,
  zonedDayRange,
  zonedTimeToUtc,
} from "@/lib/tz";

const MAX_RANGE_MS = 45 * 24 * 60 * 60 * 1000;

/**
 * GET /api/team/:userId/schedule?date=YYYY-MM-DD&tz=Area/City[&start=ISO&end=ISO]
 * Read-only view of a colleague's planner. `date` is the viewer's local day
 * (for Top 3 / done today / hours this week); `start`/`end` is the calendar range.
 */
export async function GET(request: Request, { params }: { params: Promise<{ userId: string }> }) {
  const me = await getAuthUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { userId } = await params;
  const colleague = await getColleague(me.id, me.org_id, userId);
  if (!colleague) return NextResponse.json({ error: "Not a colleague" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date");
  if (!isDateStr(date)) return NextResponse.json({ error: "date required" }, { status: 400 });
  const tz = safeTimeZone(searchParams.get("tz"));

  const day = zonedDayRange(date, tz);
  let rangeStart = day.start;
  let rangeEnd = day.end;
  const startParam = searchParams.get("start");
  const endParam = searchParams.get("end");
  if (startParam && endParam) {
    const s = new Date(startParam);
    const e = new Date(endParam);
    if (!Number.isNaN(s.getTime()) && !Number.isNaN(e.getTime()) && e > s) {
      if (e.getTime() - s.getTime() > MAX_RANGE_MS) {
        return NextResponse.json({ error: "Range too large" }, { status: 400 });
      }
      rangeStart = s;
      rangeEnd = e;
    }
  }

  const visibility = me.organisation?.planner_visibility ?? "schedule";

  const blocks = await prisma.timeBlock.findMany({
    where: { user_id: userId, start: { lt: rangeEnd }, end: { gt: rangeStart } },
    include: { goal: { select: { title: true, colour: true } } },
    orderBy: { start: "asc" },
  });

  const dayBlocks = await prisma.timeBlock.findMany({
    where: { user_id: userId, done: true, start: { lt: day.end }, end: { gt: day.start } },
    orderBy: { start: "asc" },
  });

  const daily = await prisma.dailyPage.findUnique({
    where: { user_id_date: { user_id: userId, date: new Date(date) } },
  });

  // Hours done this week (local Monday–Sunday containing `date`)
  const monday = mondayOf(date);
  const weekBlocks = await prisma.timeBlock.findMany({
    where: {
      user_id: userId,
      done: true,
      start: { gte: zonedTimeToUtc(monday, tz), lt: zonedTimeToUtc(addDays(monday, 7), tz) },
    },
    select: { start: true, end: true },
  });
  const hoursThisWeek = weekBlocks.reduce(
    (sum, b) => sum + (b.end.getTime() - b.start.getTime()) / 3600000,
    0,
  );

  const result: Record<string, unknown> = {
    user: { id: colleague.id, name: colleague.name, role: colleague.role },
    blocks,
    top3: daily?.top3 ?? [],
    doneToday: dayBlocks.map((b) => ({ title: b.title, start: b.start, end: b.end })),
    hoursThisWeek: Math.round(hoursThisWeek * 100) / 100,
    canExport: canManage(me.role, me.id, colleague.manager_id),
  };

  // Full visibility includes goals, notes, matrix
  if (visibility === "full") {
    const goals = await prisma.goal.findMany({
      where: { user_id: userId, status: "active" },
      include: { sub_goals: true, actions: true },
      orderBy: { rank: "asc" },
    });
    result.goals = goals;
    result.notes = daily?.notes ?? null;
    result.matrix = daily?.matrix ?? null;
  }

  return NextResponse.json(result);
}
