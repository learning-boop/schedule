import { after, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { appOrigin } from "@/lib/app-url";
import { sendWelcomeEmail } from "@/lib/email";
import { inviteStatus } from "@/lib/invites";
import { notify } from "@/lib/notify";
import { leaveCompanyMeetings } from "@/lib/meetings";
import { syncTeamReporting } from "@/lib/teams";

/**
 * POST /api/invites/accept — join the company an invite is for.
 * Body: { token, move?: boolean }
 *
 * The invite only works for the email it was sent to. Someone already in
 * another company must confirm the move (`move: true`); a founder with other
 * people in their company has to hand it over first.
 */
export async function POST(request: Request) {
  const me = await getAuthUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const token = typeof body.token === "string" ? body.token.trim() : "";
  if (!token)
    return NextResponse.json({ error: "Missing invite", code: "invalid" }, { status: 400 });

  const invite = await prisma.invite.findUnique({
    where: { token },
    include: {
      organisation: { select: { id: true, name: true } },
      team: { select: { id: true, name: true, lead_id: true } },
    },
  });
  if (!invite) {
    return NextResponse.json(
      { error: "This invite link doesn’t work", code: "invalid" },
      { status: 404 },
    );
  }

  const status = inviteStatus(invite);
  if (status === "joined" && me.org_id === invite.org_id) {
    return NextResponse.json({ ok: true, org: { name: invite.organisation.name } });
  }
  if (status !== "waiting") {
    const code = status === "joined" ? "used" : status;
    return NextResponse.json({ error: "This invite link no longer works", code }, { status: 410 });
  }

  if (invite.email.toLowerCase() !== me.email.trim().toLowerCase()) {
    return NextResponse.json(
      { error: `This invite is for ${invite.email}`, code: "email_mismatch", email: invite.email },
      { status: 403 },
    );
  }

  if (me.org_id === invite.org_id) {
    await prisma.invite.update({ where: { id: invite.id }, data: { accepted_at: new Date() } });
    return NextResponse.json({ ok: true, org: { name: invite.organisation.name } });
  }

  if (me.org_id) {
    if (body.move !== true) {
      return NextResponse.json(
        {
          error: `You’re in ${me.organisation?.name ?? "another company"}`,
          code: "in_other_org",
          current_org: me.organisation?.name ?? null,
        },
        { status: 409 },
      );
    }
    if (me.role === "founder") {
      const others = await prisma.user.count({
        where: { org_id: me.org_id, id: { not: me.id } },
      });
      if (others > 0) {
        return NextResponse.json(
          {
            error: `You founded ${me.organisation?.name ?? "your company"} and others are in it. Make someone else a founder before you leave.`,
            code: "founder_must_handover",
          },
          { status: 409 },
        );
      }
    }
  }

  const origin = appOrigin(request);
  if (me.org_id) {
    // Moving companies: drop out of the old company's upcoming meetings
    await leaveCompanyMeetings(me, me.org_id, origin, typeof body.tz === "string" ? body.tz : null);
  }

  // A manager joining a team that has no lead becomes its lead
  const becomesLead = invite.role === "manager" && !!invite.team && !invite.team.lead_id;

  // Employees report to their team's lead
  const managerId =
    invite.role === "employee"
      ? invite.team?.lead_id && invite.team.lead_id !== me.id
        ? invite.team.lead_id
        : invite.manager_id
      : null;

  await prisma.$transaction(async (tx) => {
    if (me.org_id) {
      // Leaving the old company: stop leading its teams and managing its people
      await tx.team.updateMany({ where: { lead_id: me.id }, data: { lead_id: null } });
      await tx.user.updateMany({ where: { manager_id: me.id }, data: { manager_id: null } });
    }
    await tx.user.update({
      where: { id: me.id },
      data: {
        org_id: invite.org_id,
        role: invite.role,
        manager_id: managerId,
        team_id: invite.team_id,
      },
    });
    await tx.invite.update({ where: { id: invite.id }, data: { accepted_at: new Date() } });
    if (becomesLead) {
      await tx.team.update({ where: { id: invite.team!.id }, data: { lead_id: me.id } });
    }
  });
  if (becomesLead) await syncTeamReporting(invite.team!.id);

  if (invite.invited_by) {
    await notify([
      {
        user_id: invite.invited_by,
        actor_id: me.id,
        type: "member_joined",
        data: {
          name: me.name,
          org: invite.organisation.name,
          team: invite.team?.name ?? null,
          role: invite.role,
        },
      },
    ]);
  }

  after(() => sendWelcomeEmail(me.email, me.name, invite.organisation.name, origin));

  return NextResponse.json({ ok: true, org: { name: invite.organisation.name } });
}
