import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";

/** GET /api/team/week — everyone's blocks side by side for a week */
export async function GET(request: Request) {
  const me = await getAuthUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!me.org_id) return NextResponse.json({ error: "No organisation" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const weekStart = searchParams.get("weekStart");
  const managerId = searchParams.get("managerId");
  const category = searchParams.get("category");

  if (!weekStart) return NextResponse.json({ error: "weekStart required" }, { status: 400 });

  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);

  // Get users, optionally filtered by manager
  const userWhere: Record<string, unknown> = { org_id: me.org_id };
  if (managerId) userWhere.manager_id = managerId;

  const users = await prisma.user.findMany({
    where: userWhere,
    select: { id: true, name: true, role: true },
    orderBy: { name: "asc" },
  });

  const userIds = users.map((u) => u.id);

  const blockWhere: Record<string, unknown> = {
    user_id: { in: userIds },
    start: { gte: new Date(weekStart) },
    end: { lte: weekEnd },
  };
  if (category) blockWhere.category = category;

  const blocks = await prisma.timeBlock.findMany({
    where: blockWhere,
    include: { goal: { select: { title: true, colour: true } } },
    orderBy: { start: "asc" },
  });

  // Group blocks by user
  const byUser = users.map((u) => ({
    user: u,
    blocks: blocks
      .filter((b) => b.user_id === u.id)
      .map((b) => ({
        id: b.id,
        title: b.title,
        start: b.start,
        end: b.end,
        done: b.done,
        category: b.category,
        goal: b.goal,
      })),
  }));

  return NextResponse.json(byUser);
}
