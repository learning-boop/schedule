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
  const month = searchParams.get("month");
  if (!month) return NextResponse.json({ error: "month required (YYYY-MM-DD)" }, { status: 400 });

  let plan = await prisma.monthlyPlan.findUnique({
    where: { user_id_month: { user_id: user.id, month: new Date(month) } },
  });

  if (!plan) {
    plan = await prisma.monthlyPlan.create({
      data: {
        user_id: user.id,
        month: new Date(month),
        top3: [],
        focus: null,
        swot: { strengths: "", weaknesses: "", opportunities: "", threats: "" },
      },
    });
  }

  return NextResponse.json(plan);
}

export async function PUT(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { month, top3, focus, swot } = body;
  if (!month) return NextResponse.json({ error: "month required" }, { status: 400 });

  const plan = await prisma.monthlyPlan.upsert({
    where: { user_id_month: { user_id: user.id, month: new Date(month) } },
    create: {
      user_id: user.id,
      month: new Date(month),
      top3: top3 ?? [],
      focus: focus ?? null,
      swot: swot ?? {},
    },
    update: {
      ...(top3 !== undefined && { top3 }),
      ...(focus !== undefined && { focus }),
      ...(swot !== undefined && { swot }),
    },
  });

  return NextResponse.json(plan);
}
