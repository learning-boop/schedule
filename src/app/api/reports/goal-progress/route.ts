import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const start = searchParams.get("start");
  const end = searchParams.get("end");

  if (!start || !end) {
    return NextResponse.json({ error: "start and end required" }, { status: 400 });
  }

  // Get all goals with sub-goals and actions
  const goals = await prisma.goal.findMany({
    where: { user_id: user.id, status: "active" },
    include: { sub_goals: true, actions: true },
    orderBy: { rank: "asc" },
  });

  // Get done time blocks in range grouped by goal & date
  const blocks = await prisma.timeBlock.findMany({
    where: {
      user_id: user.id,
      done: true,
      goal_id: { not: null },
      start: { gte: new Date(start) },
      end: { lte: new Date(end + "T23:59:59Z") },
    },
    orderBy: { start: "asc" },
  });

  // Goal progress: sub-goal completion % and action completion %
  const goalProgress = goals.map((g) => {
    const totalSub = g.sub_goals.length;
    const doneSub = g.sub_goals.filter((s) => s.done).length;
    const totalAct = g.actions.length;
    const doneAct = g.actions.filter((a) => a.done).length;
    const total = totalSub + totalAct;
    const done = doneSub + doneAct;
    return {
      id: g.id,
      title: g.title,
      colour: g.colour,
      rank: g.rank,
      progress: total > 0 ? Math.round((done / total) * 100) : 0,
      subGoals: { total: totalSub, done: doneSub },
      actions: { total: totalAct, done: doneAct },
    };
  });

  // Streak: consecutive days with at least one done block linked to Goal #1 (rank=0)
  const goal1 = goals.find((g) => g.rank === 0);
  let streak = 0;
  if (goal1) {
    const goal1Blocks = blocks.filter((b) => b.goal_id === goal1.id);
    const daysWithGoal1 = new Set(goal1Blocks.map((b) => b.start.toISOString().split("T")[0]));

    // Count backward from today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const d = new Date(today);
    while (true) {
      const key = d.toISOString().split("T")[0];
      if (daysWithGoal1.has(key)) {
        streak++;
        d.setDate(d.getDate() - 1);
      } else {
        break;
      }
    }
  }

  return NextResponse.json({
    goals: goalProgress,
    streak,
    goal1Title: goal1?.title ?? null,
  });
}
