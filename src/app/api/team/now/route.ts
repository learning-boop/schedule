import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { localDateStr, safeTimeZone, zonedDayRange } from "@/lib/tz";

/** GET /api/team/now?tz=Area/City — "Right now" board: one card per person */
export async function GET(request: Request) {
  const me = await getAuthUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!me.org_id) return NextResponse.json({ error: "No organisation" }, { status: 403 });

  const tz = safeTimeZone(new URL(request.url).searchParams.get("tz"));
  const now = new Date();
  // "Today" is the viewer's local day, not the server's (UTC) day
  const { start: todayStart, end: todayEnd } = zonedDayRange(localDateStr(now, tz), tz);

  const users = await prisma.user.findMany({
    where: { org_id: me.org_id },
    select: { id: true, name: true, role: true, manager_id: true },
    orderBy: { name: "asc" },
  });

  // Get all time blocks for today for all org users
  const userIds = users.map((u) => u.id);
  const allBlocks = await prisma.timeBlock.findMany({
    where: {
      user_id: { in: userIds },
      start: { lt: todayEnd },
      end: { gt: todayStart },
    },
    include: { goal: { select: { title: true, colour: true } } },
    orderBy: { start: "asc" },
  });

  const cards = users.map((u) => {
    const blocks = allBlocks.filter((b) => b.user_id === u.id);
    const currentBlock = blocks.find((b) => b.start <= now && b.end >= now);
    const doneBlocks = blocks.filter((b) => b.done);
    const hoursToday = doneBlocks.reduce(
      (sum, b) => sum + (b.end.getTime() - b.start.getTime()) / 3600000,
      0,
    );

    return {
      user: u,
      currentBlock: currentBlock
        ? {
            title: currentBlock.title,
            start: currentBlock.start,
            end: currentBlock.end,
            goal: currentBlock.goal,
            done: currentBlock.done,
          }
        : null,
      doneToday: doneBlocks.map((b) => ({
        title: b.title,
        start: b.start,
        end: b.end,
      })),
      hoursToday: Math.round(hoursToday * 100) / 100,
    };
  });

  return NextResponse.json(cards);
}
