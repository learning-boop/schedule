import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";

/** POST /api/notifications/read — { ids?: string[] } (omit ids to mark everything read) */
export async function POST(request: Request) {
  const me = await getAuthUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const ids: string[] | null = Array.isArray(body.ids)
    ? body.ids.filter((x: unknown): x is string => typeof x === "string").slice(0, 200)
    : null;

  const result = await prisma.notification.updateMany({
    where: { user_id: me.id, read_at: null, ...(ids ? { id: { in: ids } } : {}) },
    data: { read_at: new Date() },
  });
  return NextResponse.json({ updated: result.count });
}
