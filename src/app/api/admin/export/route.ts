import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";

/** GET /api/admin/export — founder: export all company data as JSON */
export async function GET() {
  const me = await getAuthUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (me.role !== "founder") return NextResponse.json({ error: "Founders only" }, { status: 403 });
  if (!me.org_id) return NextResponse.json({ error: "No organisation" }, { status: 403 });

  const org = await prisma.organisation.findUnique({
    where: { id: me.org_id },
    include: { invites: true },
  });

  const users = await prisma.user.findMany({
    where: { org_id: me.org_id },
    select: { id: true, name: true, email: true, role: true, manager_id: true, created_at: true },
  });

  const userIds = users.map((u) => u.id);

  const [goals, timeBlocks, dailyPages, weeklyPlans, monthlyPlans] = await Promise.all([
    prisma.goal.findMany({
      where: { user_id: { in: userIds } },
      include: { sub_goals: true, actions: true },
    }),
    prisma.timeBlock.findMany({
      where: { user_id: { in: userIds } },
    }),
    prisma.dailyPage.findMany({
      where: { user_id: { in: userIds } },
    }),
    prisma.weeklyPlan.findMany({
      where: { user_id: { in: userIds } },
    }),
    prisma.monthlyPlan.findMany({
      where: { user_id: { in: userIds } },
    }),
  ]);

  const exportData = {
    exported_at: new Date().toISOString(),
    organisation: org,
    users,
    goals,
    time_blocks: timeBlocks,
    daily_pages: dailyPages,
    weekly_plans: weeklyPlans,
    monthly_plans: monthlyPlans,
  };

  return new NextResponse(JSON.stringify(exportData, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="${org?.name ?? "company"}-export-${new Date().toISOString().split("T")[0]}.json"`,
    },
  });
}
