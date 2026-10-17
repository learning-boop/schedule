import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const goals = await prisma.goal.findMany({
    where: { user_id: user.id },
    include: {
      sub_goals: { orderBy: { created_at: "asc" } },
      actions: { orderBy: { order: "asc" } },
    },
    orderBy: { rank: "asc" },
  });

  return NextResponse.json(goals);
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { title, deadline, colour } = body;

  if (!title) {
    return NextResponse.json({ error: "Title required" }, { status: 400 });
  }

  // Get next rank
  const maxRank = await prisma.goal.aggregate({
    where: { user_id: user.id },
    _max: { rank: true },
  });

  const goal = await prisma.goal.create({
    data: {
      user_id: user.id,
      title,
      deadline: deadline ? new Date(deadline) : null,
      colour: colour || "#6366f1",
      rank: (maxRank._max.rank ?? -1) + 1,
    },
    include: { sub_goals: true, actions: true },
  });

  return NextResponse.json(goal);
}
