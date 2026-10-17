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

  const blocks = await prisma.timeBlock.findMany({
    where: {
      user_id: user.id,
      start: { gte: new Date(start) },
      end: { lte: new Date(end + "T23:59:59Z") },
    },
    orderBy: { start: "asc" },
  });

  // Group by week (Monday)
  function getWeekKey(d: Date): string {
    const date = new Date(d);
    const day = date.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    date.setDate(date.getDate() + diff);
    return date.toISOString().split("T")[0];
  }

  const weeks: Record<string, { planned: number; actual: number }> = {};

  for (const b of blocks) {
    const key = getWeekKey(b.start);
    if (!weeks[key]) weeks[key] = { planned: 0, actual: 0 };
    const hours = (b.end.getTime() - b.start.getTime()) / 3600000;
    weeks[key].planned += hours;
    if (b.done) weeks[key].actual += hours;
  }

  const data = Object.entries(weeks)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([week, val]) => ({
      week,
      planned: Math.round(val.planned * 100) / 100,
      actual: Math.round(val.actual * 100) / 100,
    }));

  return NextResponse.json(data);
}
