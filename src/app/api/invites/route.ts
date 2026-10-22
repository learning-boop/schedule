import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { appOrigin, inviteLink } from "@/lib/app-url";
import { emailConfigured } from "@/lib/email";
import type { Invite } from "@/generated/prisma/client";
import {
  cleanEmail,
  emailInvite,
  invitePermissions,
  inviteExpiry,
  inviteStatus,
  managerForInvite,
  newInviteToken,
} from "@/lib/invites";

const JOINED_DAYS = 30;

// Invite emails are sent before replying, so allow time for a slow mail server
export const maxDuration = 60;

/**
 * GET /api/invites — invites the caller can see (founders: all; team leads:
 * theirs), plus who joined recently and the teams the caller can invite into.
 */
export async function GET(request: Request) {
  const me = await getAuthUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!me.org_id) return NextResponse.json({ error: "No organisation" }, { status: 403 });
  const perms = await invitePermissions(me);
  if (!perms.canInvite) {
    return NextResponse.json({ error: "Only founders and managers can invite" }, { status: 403 });
  }

  const origin = appOrigin(request);
  const invites = await prisma.invite.findMany({
    where: {
      org_id: me.org_id,
      ...(perms.teamIds ? { OR: [{ invited_by: me.id }, { team_id: { in: perms.teamIds } }] } : {}),
    },
    include: {
      team: { select: { id: true, name: true } },
      inviter: { select: { id: true, name: true } },
    },
    orderBy: { created_at: "desc" },
  });

  const since = Date.now() - JOINED_DAYS * 24 * 60 * 60 * 1000;
  const joinedInvites = invites.filter((i) => i.accepted_at && i.accepted_at.getTime() >= since);
  const joinedUsers = await prisma.user.findMany({
    where: { org_id: me.org_id, email: { in: joinedInvites.map((i) => i.email) } },
    select: { id: true, name: true, email: true },
  });
  const userByEmail = new Map(joinedUsers.map((u) => [u.email.toLowerCase(), u]));

  const teams = await prisma.team.findMany({
    where: { org_id: me.org_id, ...(perms.teamIds ? { id: { in: perms.teamIds } } : {}) },
    select: { id: true, name: true, lead_id: true },
    orderBy: { name: "asc" },
  });

  return NextResponse.json({
    invites: invites
      .filter((i) => !i.accepted_at && !i.revoked_at)
      .map((i) => ({
        id: i.id,
        email: i.email,
        role: i.role,
        team: i.team,
        inviter: i.inviter,
        status: inviteStatus(i),
        expires_at: i.expires_at,
        created_at: i.created_at,
        link: inviteLink(origin, i.token),
      })),
    joined: joinedInvites.map((i) => ({
      id: i.id,
      email: i.email,
      role: i.role,
      team: i.team,
      inviter: i.inviter,
      accepted_at: i.accepted_at,
      user: userByEmail.get(i.email.toLowerCase()) ?? null,
    })),
    teams,
    can_invite_managers: perms.canInviteManagers,
    email_configured: emailConfigured(),
  });
}

type Row = { email?: unknown; role?: unknown; team_id?: unknown };

/**
 * POST /api/invites — invite one or more people.
 * Body: { invites: [{ email, role: "employee"|"manager", team_id? }] } (or one row)
 * No seat limit. Returns a private link per person (to copy and share) and
 * emails it too when email is set up.
 */
export async function POST(request: Request) {
  const me = await getAuthUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!me.org_id) return NextResponse.json({ error: "No organisation" }, { status: 403 });
  const perms = await invitePermissions(me);
  if (!perms.canInvite) {
    return NextResponse.json({ error: "Only founders and managers can invite" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const rows: Row[] = Array.isArray(body.invites) ? body.invites : [body];
  if (rows.length === 0 || rows.length > 50) {
    return NextResponse.json(
      { error: "Invite between 1 and 50 people at a time" },
      { status: 400 },
    );
  }

  const origin = appOrigin(request);
  const orgTeams = await prisma.team.findMany({
    where: { org_id: me.org_id },
    select: { id: true },
  });
  const orgTeamIds = new Set(orgTeams.map((t) => t.id));
  const seen = new Set<string>();
  const results: {
    email: string;
    ok: boolean;
    error?: string;
    invite?: { id: string; link: string; emailed: boolean; email_failed?: boolean };
  }[] = [];
  const toEmail: { result: (typeof results)[number]; invite: Invite }[] = [];

  for (const row of rows) {
    const email = cleanEmail(row.email);
    const label = typeof row.email === "string" ? row.email.trim() : "";
    if (!email) {
      results.push({ email: label, ok: false, error: "Not a valid email address" });
      continue;
    }
    if (seen.has(email)) {
      results.push({ email, ok: false, error: "Listed twice" });
      continue;
    }
    seen.add(email);

    const role = row.role === "manager" ? "manager" : "employee";
    if (role === "manager" && !perms.canInviteManagers) {
      results.push({ email, ok: false, error: "Only founders can invite managers" });
      continue;
    }

    const teamId = typeof row.team_id === "string" && row.team_id ? row.team_id : null;
    if (teamId && !orgTeamIds.has(teamId)) {
      results.push({ email, ok: false, error: "Unknown team" });
      continue;
    }
    if (perms.teamIds && perms.teamIds.length > 0 && (!teamId || !perms.teamIds.includes(teamId))) {
      results.push({ email, ok: false, error: "You can invite people into your own team only" });
      continue;
    }
    if (perms.teamIds && perms.teamIds.length === 0 && teamId) {
      results.push({ email, ok: false, error: "You can invite people into your own team only" });
      continue;
    }

    const member = await prisma.user.findFirst({
      where: { org_id: me.org_id, email: { equals: email, mode: "insensitive" } },
      select: { id: true },
    });
    if (member) {
      results.push({ email, ok: false, error: "Already in your company" });
      continue;
    }

    const managerId = await managerForInvite(me, role, teamId);
    const data = {
      role,
      team_id: teamId,
      manager_id: managerId,
      invited_by: me.id,
      token: newInviteToken(),
      expires_at: inviteExpiry(),
      revoked_at: null,
    } as const;

    // One open invite per person: re-inviting refreshes the existing one
    const existing = await prisma.invite.findFirst({
      where: { org_id: me.org_id, email, accepted_at: null },
      select: { id: true },
    });
    const invite = existing
      ? await prisma.invite.update({ where: { id: existing.id }, data })
      : await prisma.invite.create({ data: { ...data, org_id: me.org_id, email } });

    const result = {
      email,
      ok: true,
      invite: { id: invite.id, link: inviteLink(origin, invite.token), emailed: false },
    };
    results.push(result);
    toEmail.push({ result, invite });
  }

  // Email the links a few at a time
  for (let i = 0; i < toEmail.length; i += 4) {
    await Promise.all(
      toEmail.slice(i, i + 4).map(async ({ result, invite }) => {
        const outcome = await emailInvite(me, invite, origin);
        result.invite!.emailed = outcome === "sent";
        if (outcome === "failed") result.invite!.email_failed = true;
      }),
    );
  }

  return NextResponse.json({ results, email_configured: emailConfigured() });
}
