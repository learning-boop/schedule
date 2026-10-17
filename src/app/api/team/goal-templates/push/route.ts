import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";

/** POST /api/team/goal-templates/push — founder pushes a template to users */
export async function POST(request: Request) {
  const me = await getAuthUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (me.role !== "founder") return NextResponse.json({ error: "Founders only" }, { status: 403 });
  if (!me.org_id) return NextResponse.json({ error: "No organisation" }, { status: 403 });

  const body = await request.json();
  const { templateId, userIds } = body;
  // userIds: string[] — specific users, or empty/null for everyone

  if (!templateId) return NextResponse.json({ error: "templateId required" }, { status: 400 });

  const template = await prisma.goalTemplate.findUnique({ where: { id: templateId } });
  if (!template || template.org_id !== me.org_id) {
    return NextResponse.json({ error: "Template not found" }, { status: 404 });
  }

  // Determine target users
  let targets: string[];
  if (Array.isArray(userIds) && userIds.length > 0) {
    // Validate they're in the same org
    const valid = await prisma.user.findMany({
      where: { id: { in: userIds }, org_id: me.org_id },
      select: { id: true },
    });
    targets = valid.map((u) => u.id);
  } else {
    // Everyone in the org
    const allUsers = await prisma.user.findMany({
      where: { org_id: me.org_id },
      select: { id: true },
    });
    targets = allUsers.map((u) => u.id);
  }

  const actions = (template.actions as string[]) || [];

  let created = 0;
  for (const userId of targets) {
    // Get next rank
    const maxRank = await prisma.goal.aggregate({
      where: { user_id: userId },
      _max: { rank: true },
    });

    const goal = await prisma.goal.create({
      data: {
        user_id: userId,
        title: template.title,
        colour: template.colour,
        rank: (maxRank._max.rank ?? -1) + 1,
      },
    });

    // Create actions
    if (actions.length > 0) {
      await prisma.action.createMany({
        data: actions.map((title, i) => ({
          goal_id: goal.id,
          title,
          order: i,
        })),
      });
    }

    created++;
  }

  return NextResponse.json({ pushed: created });
}
