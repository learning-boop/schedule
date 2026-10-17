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
  const groupBy = searchParams.get("groupBy") ?? "day"; // day | week | month

  if (!start || !end) {
    return NextResponse.json({ error: "start and end required" }, { status: 400 });
  }

  const blocks = await prisma.timeBlock.findMany({
    where: {
      user_id: user.id,
      done: true,
      start: { gte: new Date(start) },
      end: { lte: new Date(end + "T23:59:59Z") },
    },
    include: { goal: { select: { id: true, title: true, colour: true } } },
    orderBy: { start: "asc" },
  });

  // Compute hours per block
  const enriched = blocks.map((b) => {
    const hours = (b.end.getTime() - b.start.getTime()) / 3600000;
    const dateStr = b.start.toISOString().split("T")[0];
    return { ...b, hours, dateStr };
  });

  // Group helper
  function getGroupKey(dateStr: string): string {
    const d = new Date(dateStr + "T00:00:00");
    if (groupBy === "day") return dateStr;
    if (groupBy === "week") {
      const day = d.getDay();
      const diff = day === 0 ? -6 : 1 - day;
      const monday = new Date(d);
      monday.setDate(monday.getDate() + diff);
      return monday.toISOString().split("T")[0];
    }
    // month
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
  }

  // Aggregate by time period
  const byPeriod: Record<
    string,
    {
      total: number;
      byGoal: Record<string, { hours: number; title: string; colour: string }>;
      byCategory: Record<string, number>;
    }
  > = {};

  for (const b of enriched) {
    const key = getGroupKey(b.dateStr);
    if (!byPeriod[key]) {
      byPeriod[key] = { total: 0, byGoal: {}, byCategory: {} };
    }
    byPeriod[key].total += b.hours;

    const goalKey = b.goal?.id ?? "none";
    if (!byPeriod[key].byGoal[goalKey]) {
      byPeriod[key].byGoal[goalKey] = {
        hours: 0,
        title: b.goal?.title ?? "No Goal",
        colour: b.goal?.colour ?? "#94a3b8",
      };
    }
    byPeriod[key].byGoal[goalKey].hours += b.hours;

    const cat = b.category ?? "Uncategorised";
    byPeriod[key].byCategory[cat] = (byPeriod[key].byCategory[cat] ?? 0) + b.hours;
  }

  // Convert to sorted array
  const data = Object.entries(byPeriod)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([period, val]) => ({
      period,
      total: Math.round(val.total * 100) / 100,
      byGoal: Object.entries(val.byGoal).map(([id, g]) => ({
        id,
        title: g.title,
        colour: g.colour,
        hours: Math.round(g.hours * 100) / 100,
      })),
      byCategory: Object.entries(val.byCategory).map(([name, hours]) => ({
        name,
        hours: Math.round(hours * 100) / 100,
      })),
    }));

  return NextResponse.json(data);
}
