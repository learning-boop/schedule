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
  const month = searchParams.get("month"); // YYYY-MM-DD (1st of month)
  if (!month) return NextResponse.json({ error: "month required" }, { status: 400 });

  const start = new Date(month);
  const end = new Date(start.getFullYear(), start.getMonth() + 1, 1);

  const blocks = await prisma.timeBlock.findMany({
    where: {
      user_id: user.id,
      start: { gte: start },
      end: { lt: end },
    },
    select: { start: true, end: true, done: true },
  });

  // Aggregate per day
  const days: Record<string, { hours: number; doneCount: number; totalCount: number }> = {};

  for (const b of blocks) {
    const dayKey = new Date(b.start).toISOString().split("T")[0];
    if (!days[dayKey]) days[dayKey] = { hours: 0, doneCount: 0, totalCount: 0 };
    days[dayKey].totalCount++;
    if (b.done) {
      days[dayKey].doneCount++;
      days[dayKey].hours += (new Date(b.end).getTime() - new Date(b.start).getTime()) / 3600000;
    }
  }

  // Round hours
  for (const key of Object.keys(days)) {
    days[key].hours = Math.round(days[key].hours * 10) / 10;
  }

  return NextResponse.json(days);
}
