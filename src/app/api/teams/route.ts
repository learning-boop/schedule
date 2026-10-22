import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { cleanTeamName, syncTeamReporting } from "@/lib/teams";

/** GET /api/teams — the company's teams with their lead and members, and anyone not in a team */
export async function GET() {
  const me = await getAuthUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!me.org_id) return NextResponse.json({ error: "No organisation" }, { status: 403 });

  const teams = await prisma.team.findMany({
    where: { org_id: me.org_id },
    include: {
      lead: { select: { id: true, name: true } },
      members: { select: { id: true, name: true, role: true }, orderBy: { name: "asc" } },
    },
    orderBy: { name: "asc" },
  });
  const unassigned = await prisma.user.findMany({
    where: { org_id: me.org_id, team_id: null },
    select: { id: true, name: true, role: true },
    orderBy: { name: "asc" },
  });

  return NextResponse.json({
    teams: teams.map((t) => ({
      id: t.id,
      name: t.name,
      lead: t.lead,
      members: t.members,
    })),
    unassigned,
    can_edit: me.role === "founder",
  });
}

/** POST /api/teams — founder: { name, lead_id?, member_ids? } */
export async function POST(request: Request) {
  const me = await getAuthUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!me.org_id) return NextResponse.json({ error: "No organisation" }, { status: 403 });
  if (me.role !== "founder") return NextResponse.json({ error: "Founders only" }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  const name = cleanTeamName(body.name);
  if (!name)
    return NextResponse.json({ error: "Enter a team name (up to 60 characters)" }, { status: 400 });

  const leadId = typeof body.lead_id === "string" && body.lead_id ? body.lead_id : null;
  const memberIds: string[] = Array.isArray(body.member_ids)
    ? [
        ...new Set<string>(
          body.member_ids.filter((x: unknown): x is string => typeof x === "string"),
        ),
      ]
    : [];
  if (leadId && !memberIds.includes(leadId)) memberIds.push(leadId);

  if (memberIds.length) {
    const count = await prisma.user.count({ where: { id: { in: memberIds }, org_id: me.org_id } });
    if (count !== memberIds.length) {
      return NextResponse.json({ error: "Some people aren’t in your company" }, { status: 400 });
    }
  }
  const clash = await prisma.team.findFirst({
    where: { org_id: me.org_id, name: { equals: name, mode: "insensitive" } },
    select: { id: true },
  });
  if (clash)
    return NextResponse.json({ error: "A team with that name already exists" }, { status: 409 });

  const team = await prisma.team.create({ data: { org_id: me.org_id, name, lead_id: leadId } });
  if (memberIds.length) {
    await prisma.user.updateMany({
      where: { id: { in: memberIds }, org_id: me.org_id },
      data: { team_id: team.id },
    });
  }
  await syncTeamReporting(team.id);
  return NextResponse.json({ team: { id: team.id, name: team.name } });
}
