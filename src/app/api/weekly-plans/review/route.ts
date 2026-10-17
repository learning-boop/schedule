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
  const weekStart = searchParams.get("weekStart");
  if (!weekStart) return NextResponse.json({ error: "weekStart required" }, { status: 400 });

  const start = new Date(weekStart);
  const end = new Date(weekStart);
  end.setDate(end.getDate() + 7);

  // Get all time blocks for the week
  const blocks = await prisma.timeBlock.findMany({
    where: {
      user_id: user.id,
      start: { gte: start },
      end: { lt: end },
    },
  });

  const totalBlocks = blocks.length;
  const doneBlocks = blocks.filter((b) => b.done).length;

  // Calculate hours worked from done blocks
  let hoursWorked = 0;
  for (const b of blocks.filter((bl) => bl.done)) {
    hoursWorked += (new Date(b.end).getTime() - new Date(b.start).getTime()) / 3600000;
  }

  // Get weekly plan for goal counts
  const plan = await prisma.weeklyPlan.findUnique({
    where: { user_id_week_start: { user_id: user.id, week_start: start } },
  });

  const goalsList = (plan?.goals as { text: string; done: boolean }[]) || [];
  const plannedGoals = goalsList.length;
  const doneGoals = goalsList.filter((g) => g.done).length;

  return NextResponse.json({
    totalBlocks,
    doneBlocks,
    hoursWorked: Math.round(hoursWorked * 10) / 10,
    plannedGoals,
    doneGoals,
  });
}
