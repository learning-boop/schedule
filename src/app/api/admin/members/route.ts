import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { syncTeamReporting } from "@/lib/teams";
import { leaveCompanyMeetings } from "@/lib/meetings";
import { appOrigin } from "@/lib/app-url";

/** PUT /api/admin/members — founder: change role, manager or team of a user */
export async function PUT(request: Request) {
  const me = await getAuthUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (me.role !== "founder") return NextResponse.json({ error: "Founders only" }, { status: 403 });
  if (!me.org_id) return NextResponse.json({ error: "No organisation" }, { status: 403 });

  const body = await request.json();
  const { userId, role, managerId, teamId } = body;

  if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });

  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target || target.org_id !== me.org_id) {
    return NextResponse.json({ error: "User not in your org" }, { status: 404 });
  }

  // Can't demote yourself
  if (userId === me.id && role !== "founder") {
    return NextResponse.json({ error: "Cannot change your own founder role" }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};
  if (role === "employee" || role === "manager" || role === "founder") {
    updates.role = role;
  }
  if (managerId !== undefined) {
    // Validate manager is in same org (or null to remove)
    if (managerId) {
      const mgr = await prisma.user.findUnique({ where: { id: managerId } });
      if (!mgr || mgr.org_id !== me.org_id) {
        return NextResponse.json({ error: "Manager not in your org" }, { status: 400 });
      }
    }
    updates.manager_id = managerId || null;
  }

  let newTeamLead: string | null | undefined;
  if (teamId !== undefined) {
    if (teamId) {
      const team = await prisma.team.findUnique({ where: { id: teamId } });
      if (!team || team.org_id !== me.org_id) {
        return NextResponse.json({ error: "Team not in your org" }, { status: 400 });
      }
      newTeamLead = team.lead_id;
      updates.team_id = team.id;
    } else {
      updates.team_id = null;
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No valid updates" }, { status: 400 });
  }

  await prisma.user.update({ where: { id: userId }, data: updates });

  // An employee can't lead a team
  if (updates.role === "employee") {
    await prisma.team.updateMany({ where: { lead_id: userId }, data: { lead_id: null } });
  }
  // Moving into a team: report to its lead (unless a manager was chosen too)
  if (typeof updates.team_id === "string" && managerId === undefined && newTeamLead !== userId) {
    await syncTeamReporting(updates.team_id);
  }

  const updated = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true, role: true, manager_id: true, team_id: true },
  });

  return NextResponse.json(updated);
}

/** DELETE /api/admin/members — founder: remove a user from the org */
export async function DELETE(request: Request) {
  const me = await getAuthUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (me.role !== "founder") return NextResponse.json({ error: "Founders only" }, { status: 403 });
  if (!me.org_id) return NextResponse.json({ error: "No organisation" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");
  if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });
  if (userId === me.id)
    return NextResponse.json({ error: "Cannot remove yourself" }, { status: 400 });

  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target || target.org_id !== me.org_id) {
    return NextResponse.json({ error: "User not in your org" }, { status: 404 });
  }

  // Upcoming meetings: theirs are cancelled, and they leave everyone else's
  await leaveCompanyMeetings(target, me.org_id, appOrigin(request), searchParams.get("tz"));

  // Remove from org (don't delete the user, just unassign)
  await prisma.$transaction([
    prisma.team.updateMany({ where: { lead_id: userId }, data: { lead_id: null } }),
    prisma.user.updateMany({ where: { manager_id: userId }, data: { manager_id: null } }),
    prisma.user.update({
      where: { id: userId },
      data: { org_id: null, role: "employee", manager_id: null, team_id: null },
    }),
  ]);

  return NextResponse.json({ ok: true });
}
