import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { inviteStatus } from "@/lib/invites";

/**
 * GET /api/invites/lookup?token=… — public: what an invite link is for, so
 * the invite page can show it before the person signs in. The token itself
 * is the secret; nothing is shown for an unknown token.
 */
export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token")?.trim();
  if (!token || token.length > 200) return NextResponse.json({ status: "invalid" });

  const invite = await prisma.invite.findUnique({
    where: { token },
    include: {
      organisation: { select: { name: true } },
      team: { select: { name: true } },
      inviter: { select: { name: true } },
    },
  });
  if (!invite) return NextResponse.json({ status: "invalid" });

  const status = inviteStatus(invite);
  return NextResponse.json({
    status: status === "waiting" ? "valid" : status === "joined" ? "used" : status,
    email: invite.email,
    org: { name: invite.organisation.name },
    inviter: invite.inviter?.name ?? null,
    role: invite.role,
    team: invite.team?.name ?? null,
    expires_at: invite.expires_at,
  });
}
