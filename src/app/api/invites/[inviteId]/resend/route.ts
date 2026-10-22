import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { appOrigin, inviteLink } from "@/lib/app-url";
import { canManageInvite, emailInvite, inviteExpiry, newInviteToken } from "@/lib/invites";

/**
 * POST /api/invites/:id/resend — a fresh link valid for another 7 days (the
 * old link stops working), emailed again when email is set up.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ inviteId: string }> },
) {
  const me = await getAuthUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { inviteId } = await params;
  const invite = await prisma.invite.findUnique({ where: { id: inviteId } });
  if (!invite || !(await canManageInvite(me, invite))) {
    return NextResponse.json({ error: "Invite not found" }, { status: 404 });
  }
  if (invite.accepted_at) {
    return NextResponse.json({ error: "This person already joined" }, { status: 400 });
  }

  const updated = await prisma.invite.update({
    where: { id: invite.id },
    data: { token: newInviteToken(), expires_at: inviteExpiry(), revoked_at: null },
  });
  const origin = appOrigin(request);
  const outcome = await emailInvite(me, updated, origin);
  return NextResponse.json({
    link: inviteLink(origin, updated.token),
    emailed: outcome === "sent",
    email_failed: outcome === "failed",
    expires_at: updated.expires_at,
  });
}
