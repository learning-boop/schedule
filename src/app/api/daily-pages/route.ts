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
  const date = searchParams.get("date");
  if (!date) return NextResponse.json({ error: "date required" }, { status: 400 });

  let page = await prisma.dailyPage.findUnique({
    where: { user_id_date: { user_id: user.id, date: new Date(date) } },
  });

  if (!page) {
    page = await prisma.dailyPage.create({
      data: {
        user_id: user.id,
        date: new Date(date),
        top3: [],
        matrix: {
          urgent_important: [],
          urgent_not: [],
          not_urgent_important: [],
          not_urgent_not: [],
        },
        water: 0,
        fitness: null,
        notes: null,
      },
    });
  }

  return NextResponse.json(page);
}

export async function PUT(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { date, top3, matrix, water, fitness, notes } = body;

  if (!date) return NextResponse.json({ error: "date required" }, { status: 400 });

  const page = await prisma.dailyPage.upsert({
    where: { user_id_date: { user_id: user.id, date: new Date(date) } },
    create: {
      user_id: user.id,
      date: new Date(date),
      top3: top3 ?? [],
      matrix: matrix ?? {},
      water: water ?? 0,
      fitness: fitness ?? null,
      notes: notes ?? null,
    },
    update: {
      ...(top3 !== undefined && { top3 }),
      ...(matrix !== undefined && { matrix }),
      ...(water !== undefined && { water }),
      ...(fitness !== undefined && { fitness }),
      ...(notes !== undefined && { notes }),
    },
  });

  return NextResponse.json(page);
}
