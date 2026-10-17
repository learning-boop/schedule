import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";

/** PUT /api/admin/members — founder: change role or manager of a user */
export async function PUT(request: Request) {
  const me = await getAuthUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (me.role !== "founder") return NextResponse.json({ error: "Founders only" }, { status: 403 });
  if (!me.org_id) return NextResponse.json({ error: "No organisation" }, { status: 403 });

  const body = await request.json();
  const { userId, role, managerId } = body;

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

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No valid updates" }, { status: 400 });
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data: updates,
    select: { id: true, name: true, email: true, role: true, manager_id: true },
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

  // Remove from org (don't delete the user, just unassign)
  await prisma.user.update({
    where: { id: userId },
    data: { org_id: null, role: "employee", manager_id: null },
  });

  return NextResponse.json({ ok: true });
}
