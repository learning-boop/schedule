import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { emailConfigured, inviteEmail, trySendMail } from "@/lib/email";
import { inviteLink } from "@/lib/app-url";
import { teamsLedBy } from "@/lib/teams";
import type { AuthUser } from "@/lib/auth-helpers";

export const INVITE_DAYS = 7;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type InviteStatus = "waiting" | "expired" | "joined" | "revoked";

export function inviteStatus(i: {
  accepted_at: Date | null;
  revoked_at: Date | null;
  expires_at: Date;
}): InviteStatus {
  if (i.accepted_at) return "joined";
  if (i.revoked_at) return "revoked";
  if (i.expires_at.getTime() <= Date.now()) return "expired";
  return "waiting";
}

export function newInviteToken(): string {
  return randomBytes(24).toString("base64url");
}

export function inviteExpiry(): Date {
  return new Date(Date.now() + INVITE_DAYS * 24 * 60 * 60 * 1000);
}

export function cleanEmail(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const e = v.trim().toLowerCase();
  return e.length <= 254 && EMAIL_RE.test(e) ? e : null;
}

/**
 * What the caller may invite. Founders: anyone into any team. Managers:
 * employees, into a team they lead (or, if they lead none, reporting to them).
 */
export async function invitePermissions(me: AuthUser) {
  if (me.role === "founder") {
    return { canInvite: true, canInviteManagers: true, teamIds: null as string[] | null };
  }
  if (me.role === "manager") {
    return { canInvite: true, canInviteManagers: false, teamIds: await teamsLedBy(me.id) };
  }
  return { canInvite: false, canInviteManagers: false, teamIds: [] as string[] };
}

/** May this person manage (copy, resend, remove) this invite? */
export async function canManageInvite(
  me: AuthUser,
  invite: { org_id: string; invited_by: string | null; team_id: string | null },
) {
  if (!me.org_id || invite.org_id !== me.org_id) return false;
  if (me.role === "founder") return true;
  if (me.role !== "manager") return false;
  if (invite.invited_by === me.id) return true;
  if (!invite.team_id) return false;
  return (await teamsLedBy(me.id)).includes(invite.team_id);
}

/** Who an invited employee will report to */
export async function managerForInvite(
  me: AuthUser,
  role: "employee" | "manager",
  teamId: string | null,
): Promise<string | null> {
  if (role !== "employee") return null;
  if (teamId) {
    const team = await prisma.team.findUnique({ where: { id: teamId }, select: { lead_id: true } });
    if (team?.lead_id) return team.lead_id;
  }
  return me.role === "manager" ? me.id : null;
}

export type EmailOutcome = "sent" | "failed" | "off";

/**
 * Email the invite link now (not in the background), so the person sending it
 * can be told when it didn't go out and share the link themselves.
 */
export async function emailInvite(
  me: AuthUser,
  invite: { email: string; role: string; token: string; expires_at: Date; team_id: string | null },
  origin: string,
): Promise<EmailOutcome> {
  if (!emailConfigured()) return "off";
  const team = invite.team_id
    ? await prisma.team.findUnique({ where: { id: invite.team_id }, select: { name: true } })
    : null;
  const mail = inviteEmail({
    inviterName: me.name,
    orgName: me.organisation?.name ?? "your company",
    role: invite.role,
    teamName: team?.name ?? null,
    link: inviteLink(origin, invite.token),
    expires: invite.expires_at,
  });
  const sent = await trySendMail({
    to: invite.email,
    ...mail,
    replyTo: me.email,
    fromName: `${me.name} via Schedule Planner`,
  });
  return sent ? "sent" : "failed";
}
