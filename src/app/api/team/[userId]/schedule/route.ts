import { NextResponse } from "next/server";
import { getAuthUser, getColleague } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";

/** GET /api/team/:userId/schedule — read-only schedule view for a colleague */
export async function GET(request: Request, { params }: { params: Promise<{ userId: string }> }) {
  const me = await getAuthUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { userId } = await params;
  const colleague = await getColleague(me.id, me.org_id, userId);
  if (!colleague) return NextResponse.json({ error: "Not a colleague" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date");
  if (!date) return NextResponse.json({ error: "date required" }, { status: 400 });

  // Determine what's visible
  const visibility = me.organisation?.planner_visibility ?? "schedule";

  // Time blocks for the day
  const blocks = await prisma.timeBlock.findMany({
    where: {
      user_id: userId,
      start: { gte: new Date(date) },
      end: { lte: new Date(date + "T23:59:59Z") },
    },
    include: { goal: { select: { title: true, colour: true } } },
    orderBy: { start: "asc" },
  });

  // Daily page (top3 + done log)
  const daily = await prisma.dailyPage.findUnique({
    where: { user_id_date: { user_id: userId, date: new Date(date) } },
  });

  // Hours this week (Mon–Sun containing the date)
  const d = new Date(date + "T00:00:00");
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const weekStart = new Date(d);
  weekStart.setDate(weekStart.getDate() + diff);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);

  const weekBlocks = await prisma.timeBlock.findMany({
    where: {
      user_id: userId,
      done: true,
      start: { gte: weekStart },
      end: { lte: weekEnd },
    },
  });
  const hoursThisWeek = weekBlocks.reduce(
    (sum, b) => sum + (b.end.getTime() - b.start.getTime()) / 3600000,
    0,
  );

  // Build response
  const result: Record<string, unknown> = {
    user: { id: colleague.id, name: colleague.name, role: colleague.role },
    blocks,
    top3: daily?.top3 ?? [],
    doneToday: blocks
      .filter((b) => b.done)
      .map((b) => ({ title: b.title, start: b.start, end: b.end })),
    hoursThisWeek: Math.round(hoursThisWeek * 100) / 100,
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
