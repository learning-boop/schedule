import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

const EMPTY_SWOT = { strengths: "", weaknesses: "", opportunities: "", threats: "" };

/** Keep only { "1".."31": non-empty string (≤ 300 chars) } */
function cleanDayPlans(input: unknown): Record<string, string> | undefined {
  if (input === undefined) return undefined;
  if (!input || typeof input !== "object" || Array.isArray(input)) return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
    const day = Number(k);
    if (!Number.isInteger(day) || day < 1 || day > 31) continue;
    if (typeof v !== "string") continue;
    const text = v.slice(0, 300);
    if (text.trim()) out[String(day)] = text;
  }
  return out;
}

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
        swot: EMPTY_SWOT,
        day_plans: {},
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
  const day_plans = cleanDayPlans(body.day_plans);

  const plan = await prisma.monthlyPlan.upsert({
    where: { user_id_month: { user_id: user.id, month: new Date(month) } },
    create: {
      user_id: user.id,
      month: new Date(month),
      top3: top3 ?? [],
      focus: focus ?? null,
      swot: swot ?? {},
      day_plans: day_plans ?? {},
    },
    update: {
      ...(top3 !== undefined && { top3 }),
      ...(focus !== undefined && { focus }),
      ...(swot !== undefined && { swot }),
      ...(day_plans !== undefined && { day_plans }),
    },
  });

  return NextResponse.json(plan);
}
