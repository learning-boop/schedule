import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";

/** PUT /api/team/settings — founder-only: update org settings */
export async function PUT(request: Request) {
  const me = await getAuthUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (me.role !== "founder") return NextResponse.json({ error: "Founders only" }, { status: 403 });
  if (!me.org_id) return NextResponse.json({ error: "No organisation" }, { status: 403 });

  const body = await request.json();
  const { planner_visibility, allow_comments } = body;

  const updates: Record<string, unknown> = {};
  if (planner_visibility === "schedule" || planner_visibility === "full") {
    updates.planner_visibility = planner_visibility;
  }
  if (typeof allow_comments === "boolean") {
    updates.allow_comments = allow_comments;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  const org = await prisma.organisation.update({
    where: { id: me.org_id },
    data: updates,
  });

  return NextResponse.json(org);
}
