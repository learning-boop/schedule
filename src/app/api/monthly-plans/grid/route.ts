import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { addDays, daysInMonth, localDateStr, safeTimeZone, zonedTimeToUtc } from "@/lib/tz";

/** GET /api/monthly-plans/grid?month=YYYY-MM-01&tz=Area/City — hours logged per local day */
export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const month = searchParams.get("month"); // YYYY-MM-DD (1st of month)
  if (!month) return NextResponse.json({ error: "month required" }, { status: 400 });
  const tz = safeTimeZone(searchParams.get("tz"));

  const first = month.slice(0, 7) + "-01";
  const start = zonedTimeToUtc(first, tz);
  const end = zonedTimeToUtc(addDays(first, daysInMonth(first)), tz);

  const blocks = await prisma.timeBlock.findMany({
    where: {
      user_id: user.id,
      start: { gte: start, lt: end },
    },
    select: { start: true, end: true, done: true },
  });

  // Aggregate per local day
  const days: Record<string, { hours: number; doneCount: number; totalCount: number }> = {};

  for (const b of blocks) {
    const dayKey = localDateStr(new Date(b.start), tz);
    if (!days[dayKey]) days[dayKey] = { hours: 0, doneCount: 0, totalCount: 0 };
    days[dayKey].totalCount++;
    if (b.done) {
      days[dayKey].doneCount++;
      days[dayKey].hours += (new Date(b.end).getTime() - new Date(b.start).getTime()) / 3600000;
    }
  }

  for (const key of Object.keys(days)) {
    days[key].hours = Math.round(days[key].hours * 10) / 10;
  }

  return NextResponse.json(days);
}
