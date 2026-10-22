import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { canManageInvite } from "@/lib/invites";

/** DELETE /api/invites/:id — revoke a waiting invite (its link stops working) or clear an expired one */
export async function DELETE(
  _request: Request,
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

  await prisma.invite.delete({ where: { id: invite.id } });
  return NextResponse.json({ ok: true });
}
