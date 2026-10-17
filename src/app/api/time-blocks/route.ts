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
  const goalId = searchParams.get("goalId");
  const category = searchParams.get("category");

  const where: Record<string, unknown> = { user_id: user.id };
  if (start && end) {
    where.start = { gte: new Date(start) };
    where.end = { lte: new Date(end) };
  }
  if (goalId) where.goal_id = goalId;
  if (category) where.category = category;

  const blocks = await prisma.timeBlock.findMany({
    where,
    include: { goal: { select: { title: true, colour: true } } },
    orderBy: { start: "asc" },
  });

  return NextResponse.json(blocks);
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { title, goal_id, start, end, category, recurrence } = body;

  if (!title || !start || !end) {
    return NextResponse.json({ error: "title, start, end required" }, { status: 400 });
  }

  // If recurring, create multiple blocks
  if (recurrence && (recurrence === "daily" || recurrence === "weekly")) {
    const blocks = [];
    const startDate = new Date(start);
    const endDate = new Date(end);
    const durationMs = endDate.getTime() - startDate.getTime();
    const incrementDays = recurrence === "daily" ? 1 : 7;
    const weeksToCreate = recurrence === "daily" ? 4 : 8; // 4 weeks daily, 8 weeks weekly
    const totalBlocks = recurrence === "daily" ? weeksToCreate * 7 : weeksToCreate;

    for (let i = 0; i < totalBlocks; i++) {
      const blockStart = new Date(startDate.getTime() + i * incrementDays * 86400000);
      const blockEnd = new Date(blockStart.getTime() + durationMs);

      blocks.push({
        user_id: user.id,
        title,
        goal_id: goal_id || null,
        start: blockStart,
        end: blockEnd,
        category: category || null,
      });
    }

    const created = await prisma.timeBlock.createMany({ data: blocks });
    return NextResponse.json({ count: created.count });
  }

  const block = await prisma.timeBlock.create({
    data: {
      user_id: user.id,
      title,
      goal_id: goal_id || null,
      start: new Date(start),
      end: new Date(end),
      category: category || null,
    },
    include: { goal: { select: { title: true, colour: true } } },
  });

  return NextResponse.json(block);
}
