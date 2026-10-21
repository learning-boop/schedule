import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";

const MAX_RANGE_MS = 45 * 24 * 60 * 60 * 1000;

/**
 * GET /api/team/calendar?start=ISO&end=ISO
 * Everyone in the company, with all of their time blocks overlapping the range.
 * (Everyone in a company can see each other's schedule.)
 */
export async function GET(request: Request) {
  const me = await getAuthUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!me.org_id) return NextResponse.json({ error: "No organisation" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const start = new Date(searchParams.get("start") ?? "");
  const end = new Date(searchParams.get("end") ?? "");
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
    return NextResponse.json({ error: "start and end (ISO) required" }, { status: 400 });
  }
  if (end.getTime() - start.getTime() > MAX_RANGE_MS) {
    return NextResponse.json({ error: "Range too large (max 45 days)" }, { status: 400 });
  }

  const members = await prisma.user.findMany({
    where: { org_id: me.org_id },
    select: { id: true, name: true, role: true, manager_id: true },
    orderBy: { name: "asc" },
  });

  const blocks = await prisma.timeBlock.findMany({
    where: {
      user_id: { in: members.map((m) => m.id) },
      start: { lt: end },
      end: { gt: start },
    },
    select: {
      id: true,
      user_id: true,
      title: true,
      start: true,
      end: true,
      done: true,
      category: true,
      goal: { select: { title: true, colour: true } },
    },
    orderBy: { start: "asc" },
  });

  // Put the viewer first, then everyone else alphabetically
  members.sort((a, b) => (a.id === me.id ? -1 : b.id === me.id ? 1 : a.name.localeCompare(b.name)));

  return NextResponse.json({ me: { id: me.id, role: me.role }, members, blocks });
}
