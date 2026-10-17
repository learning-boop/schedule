import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";

/** GET /api/team/dashboard — manager/founder dashboard: hours, goals, done-today per person */
export async function GET() {
  const me = await getAuthUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!me.org_id) return NextResponse.json({ error: "No organisation" }, { status: 403 });

  if (me.role !== "manager" && me.role !== "founder") {
    return NextResponse.json({ error: "Managers and founders only" }, { status: 403 });
  }

  // Founders see everyone; managers see their reports
  const userWhere: Record<string, unknown> = { org_id: me.org_id };
  if (me.role === "manager") userWhere.manager_id = me.id;

  const users = await prisma.user.findMany({
    where: userWhere,
    select: { id: true, name: true, role: true },
    orderBy: { name: "asc" },
  });

  const userIds = users.map((u) => u.id);

  // This week's date range (Mon–Sun)
  const now = new Date();
  const day = now.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const weekStart = new Date(now);
  weekStart.setDate(weekStart.getDate() + diff);
  weekStart.setHours(0, 0, 0, 0);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);

  const todayStr = now.toISOString().split("T")[0];

  // All done blocks this week
  const weekBlocks = await prisma.timeBlock.findMany({
    where: {
      user_id: { in: userIds },
      done: true,
      start: { gte: weekStart },
      end: { lte: weekEnd },
    },
    orderBy: { start: "asc" },
  });

  // Goals for all users
  const goals = await prisma.goal.findMany({
    where: { user_id: { in: userIds }, status: "active" },
    include: { sub_goals: true, actions: true },
    orderBy: { rank: "asc" },
  });

  // Today's done blocks
  const todayBlocks = weekBlocks.filter((b) => b.start.toISOString().split("T")[0] === todayStr);

  const rows = users.map((u) => {
    const uBlocks = weekBlocks.filter((b) => b.user_id === u.id);
    const hoursThisWeek = uBlocks.reduce(
      (sum, b) => sum + (b.end.getTime() - b.start.getTime()) / 3600000,
      0,
    );

    const uGoals = goals.filter((g) => g.user_id === u.id);
    const goalsOnTrack = uGoals.map((g) => {
      const total = g.sub_goals.length + g.actions.length;
      const done =
        g.sub_goals.filter((s) => s.done).length + g.actions.filter((a) => a.done).length;
      return {
        title: g.title,
        colour: g.colour,
        progress: total > 0 ? Math.round((done / total) * 100) : 0,
      };
    });

    const uToday = todayBlocks
      .filter((b) => b.user_id === u.id)
      .map((b) => ({ title: b.title, start: b.start, end: b.end }));

    return {
      user: u,
      hoursThisWeek: Math.round(hoursThisWeek * 100) / 100,
      goals: goalsOnTrack,
      doneToday: uToday,
    };
  });

  return NextResponse.json(rows);
}
