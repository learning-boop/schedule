import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";

/** GET /api/team/members — everyone in the company, grouped by team */
export async function GET(request: Request) {
  const me = await getAuthUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!me.org_id) return NextResponse.json({ error: "No organisation" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const search = searchParams.get("q")?.toLowerCase();

  const [allUsers, teams] = await Promise.all([
    prisma.user.findMany({
      where: { org_id: me.org_id },
      select: { id: true, name: true, email: true, role: true, manager_id: true, team_id: true },
      orderBy: { name: "asc" },
    }),
    prisma.team.findMany({
      where: { org_id: me.org_id },
      select: { id: true, name: true, lead_id: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const users = search
    ? allUsers.filter(
        (u) => u.name.toLowerCase().includes(search) || u.email.toLowerCase().includes(search),
      )
    : allUsers;

  const grouped: {
    teamId: string | null;
    teamName: string | null;
    leadId: string | null;
    members: typeof users;
  }[] = teams.map((t) => ({
    teamId: t.id,
    teamName: t.name,
    leadId: t.lead_id,
    members: users
      .filter((u) => u.team_id === t.id)
      // Lead first
      .sort((a, b) => (a.id === t.lead_id ? -1 : b.id === t.lead_id ? 1 : 0)),
  }));
  const noTeam = users.filter((u) => !u.team_id || !teams.some((t) => t.id === u.team_id));
  if (noTeam.length) grouped.push({ teamId: null, teamName: null, leadId: null, members: noTeam });

  return NextResponse.json({
    me: { id: me.id, role: me.role, org_id: me.org_id, team_id: me.team_id },
    org: {
      name: me.organisation?.name,
      planner_visibility: me.organisation?.planner_visibility,
      allow_comments: me.organisation?.allow_comments,
    },
    teams,
    members: allUsers,
    grouped: grouped.filter((g) => g.members.length > 0 || !search),
  });
}
