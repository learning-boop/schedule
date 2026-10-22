import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { cleanTeamName, syncTeamReporting } from "@/lib/teams";

async function loadTeam(teamId: string, orgId: string) {
  const team = await prisma.team.findUnique({
    where: { id: teamId },
    include: { members: { select: { id: true, manager_id: true } } },
  });
  return team && team.org_id === orgId ? team : null;
}

/**
 * PUT /api/teams/:id — founder: { name?, lead_id? (null clears), member_ids? (the full list) }
 * The lead is always in the team, becomes a manager, and the other members report to them.
 */
export async function PUT(request: Request, { params }: { params: Promise<{ teamId: string }> }) {
  const me = await getAuthUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!me.org_id) return NextResponse.json({ error: "No organisation" }, { status: 403 });
  if (me.role !== "founder") return NextResponse.json({ error: "Founders only" }, { status: 403 });

  const { teamId } = await params;
  const team = await loadTeam(teamId, me.org_id);
  if (!team) return NextResponse.json({ error: "Team not found" }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const data: { name?: string; lead_id?: string | null } = {};

  if (body.name !== undefined) {
    const name = cleanTeamName(body.name);
    if (!name) {
      return NextResponse.json(
        { error: "Enter a team name (up to 60 characters)" },
        { status: 400 },
      );
    }
    const clash = await prisma.team.findFirst({
      where: {
        org_id: me.org_id,
        id: { not: team.id },
        name: { equals: name, mode: "insensitive" },
      },
      select: { id: true },
    });
    if (clash) {
      return NextResponse.json({ error: "A team with that name already exists" }, { status: 409 });
    }
    data.name = name;
  }

  let memberIds: string[] | null = Array.isArray(body.member_ids)
    ? [
        ...new Set<string>(
          body.member_ids.filter((x: unknown): x is string => typeof x === "string"),
        ),
      ]
    : null;

  if (body.lead_id !== undefined) {
    data.lead_id = typeof body.lead_id === "string" && body.lead_id ? body.lead_id : null;
    if (data.lead_id) {
      memberIds ??= team.members.map((m) => m.id);
      if (!memberIds.includes(data.lead_id)) memberIds.push(data.lead_id);
    }
  }

  if (memberIds) {
    const count = await prisma.user.count({ where: { id: { in: memberIds }, org_id: me.org_id } });
    if (count !== memberIds.length) {
      return NextResponse.json({ error: "Some people aren’t in your company" }, { status: 400 });
    }
  }

  await prisma.$transaction(async (tx) => {
    if (Object.keys(data).length) await tx.team.update({ where: { id: team.id }, data });
    if (memberIds) {
      const keep = new Set(memberIds);
      const removed = team.members.filter((m) => !keep.has(m.id));
      if (removed.length) {
        await tx.user.updateMany({
          where: { id: { in: removed.map((m) => m.id) } },
          data: { team_id: null },
        });
        // People leaving the team stop reporting to its lead
        if (team.lead_id) {
          await tx.user.updateMany({
            where: { id: { in: removed.map((m) => m.id) }, manager_id: team.lead_id },
            data: { manager_id: null },
          });
        }
      }
      await tx.user.updateMany({
        where: { id: { in: memberIds }, org_id: me.org_id! },
        data: { team_id: team.id },
      });
    }
  });

  await syncTeamReporting(team.id);
  return NextResponse.json({ ok: true });
}

/** DELETE /api/teams/:id — founder: remove the team (its people stay, without a team) */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ teamId: string }> },
) {
  const me = await getAuthUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!me.org_id) return NextResponse.json({ error: "No organisation" }, { status: 403 });
  if (me.role !== "founder") return NextResponse.json({ error: "Founders only" }, { status: 403 });

  const { teamId } = await params;
  const team = await loadTeam(teamId, me.org_id);
  if (!team) return NextResponse.json({ error: "Team not found" }, { status: 404 });

  await prisma.team.delete({ where: { id: team.id } });
  return NextResponse.json({ ok: true });
}
