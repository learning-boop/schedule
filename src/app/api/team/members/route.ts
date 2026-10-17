import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";

/** GET /api/team/members — list all colleagues in the org, grouped by manager */
export async function GET(request: Request) {
  const me = await getAuthUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!me.org_id) return NextResponse.json({ error: "No organisation" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const search = searchParams.get("q")?.toLowerCase();

  let users = await prisma.user.findMany({
    where: { org_id: me.org_id },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      manager_id: true,
    },
    orderBy: { name: "asc" },
  });

  if (search) {
    users = users.filter(
      (u) => u.name.toLowerCase().includes(search) || u.email.toLowerCase().includes(search),
    );
  }

  // Group by manager
  const managers = new Map<string | null, typeof users>();
  for (const u of users) {
    const key = u.manager_id;
    if (!managers.has(key)) managers.set(key, []);
    managers.get(key)!.push(u);
  }

  // Build grouped result
  const grouped: { managerId: string | null; managerName: string | null; members: typeof users }[] =
    [];
  for (const [managerId, members] of managers) {
    const mgr = managerId ? users.find((u) => u.id === managerId) : null;
    grouped.push({
      managerId,
      managerName: mgr?.name ?? (managerId ? "Unknown Manager" : null),
      members,
    });
  }

  return NextResponse.json({
    me: { id: me.id, role: me.role, org_id: me.org_id },
    org: {
      name: me.organisation?.name,
      planner_visibility: me.organisation?.planner_visibility,
      allow_comments: me.organisation?.allow_comments,
    },
    grouped,
  });
}
