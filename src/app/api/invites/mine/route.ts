import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";

/** GET /api/invites/mine — open invites sent to the signed-in person's email */
export async function GET() {
  const me = await getAuthUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const invites = await prisma.invite.findMany({
    where: {
      email: { equals: me.email.trim().toLowerCase(), mode: "insensitive" },
      accepted_at: null,
      revoked_at: null,
      expires_at: { gt: new Date() },
      ...(me.org_id ? { org_id: { not: me.org_id } } : {}),
    },
    include: {
      organisation: { select: { id: true, name: true, _count: { select: { users: true } } } },
      team: { select: { name: true } },
      inviter: { select: { name: true } },
    },
    orderBy: { created_at: "desc" },
  });

  return NextResponse.json(
    invites.map((i) => ({
      id: i.id,
      token: i.token,
      role: i.role,
      team: i.team?.name ?? null,
      inviter: i.inviter?.name ?? null,
      expires_at: i.expires_at,
      org: {
        id: i.organisation.id,
        name: i.organisation.name,
        members: i.organisation._count.users,
      },
    })),
  );
}
