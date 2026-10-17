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

  let plan = await prisma.weeklyPlan.findUnique({
    where: { user_id_week_start: { user_id: user.id, week_start: new Date(weekStart) } },
  });

  // If no plan, check previous week for carry-over goals
  if (!plan) {
    const prevWeek = new Date(weekStart);
    prevWeek.setDate(prevWeek.getDate() - 7);
    const prevPlan = await prisma.weeklyPlan.findUnique({
      where: { user_id_week_start: { user_id: user.id, week_start: prevWeek } },
    });

    const carryOver: { text: string; done: boolean }[] = [];
    if (prevPlan && Array.isArray(prevPlan.goals)) {
      for (const g of prevPlan.goals as { text: string; done: boolean }[]) {
        if (!g.done) carryOver.push({ text: g.text, done: false });
      }
    }

    return NextResponse.json({ plan: null, carryOver });
  }

  return NextResponse.json({ plan, carryOver: [] });
}

export async function PUT(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { weekStart, goals, quote, slots } = body;
  if (!weekStart) return NextResponse.json({ error: "weekStart required" }, { status: 400 });

  const plan = await prisma.weeklyPlan.upsert({
    where: { user_id_week_start: { user_id: user.id, week_start: new Date(weekStart) } },
    create: {
      user_id: user.id,
      week_start: new Date(weekStart),
      goals: goals ?? [],
      quote: quote ?? null,
      slots: slots ?? [],
    },
    update: {
      ...(goals !== undefined && { goals }),
      ...(quote !== undefined && { quote }),
      ...(slots !== undefined && { slots }),
    },
  });

  return NextResponse.json(plan);
}
