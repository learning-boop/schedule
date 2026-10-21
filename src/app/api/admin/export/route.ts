import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { ensurePlannerSchema } from "@/lib/schema-guard";
import { clockTime, localDateStr, safeTimeZone } from "@/lib/tz";

function csvCell(v: unknown): string {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * GET /api/admin/export — founder: export all company data.
 *   ?format=json (default) — everything as JSON
 *   ?format=csv&tz=Area/City — every task/time block of every member as a spreadsheet
 */
export async function GET(request: Request) {
  const me = await getAuthUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (me.role !== "founder") return NextResponse.json({ error: "Founders only" }, { status: 403 });
  if (!me.org_id) return NextResponse.json({ error: "No organisation" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const format = searchParams.get("format") ?? "json";
  const today = new Date().toISOString().split("T")[0];

  const org = await prisma.organisation.findUnique({
    where: { id: me.org_id },
    include: { invites: true },
  });

  const users = await prisma.user.findMany({
    where: { org_id: me.org_id },
    select: { id: true, name: true, email: true, role: true, manager_id: true, created_at: true },
    orderBy: { name: "asc" },
  });

  const userIds = users.map((u) => u.id);
  const orgSlug = (org?.name ?? "company").replace(/[^A-Za-z0-9_-]+/g, "-");

  if (format === "csv") {
    const tz = safeTimeZone(searchParams.get("tz"));
    const blocks = await prisma.timeBlock.findMany({
      where: { user_id: { in: userIds } },
      include: { goal: { select: { title: true } } },
      orderBy: [{ start: "asc" }],
    });
    const byId = new Map(users.map((u) => [u.id, u]));
    const header = [
      "Member",
      "Email",
      "Role",
      "Date",
      "Start",
      "End",
      "Hours",
      "Task",
      "Goal",
      "Category",
      "Done",
      "What was worked on",
    ];
    const rows = blocks.map((b) => {
      const u = byId.get(b.user_id);
      const hours = Math.round(((b.end.getTime() - b.start.getTime()) / 36e5) * 100) / 100;
      return [
        u?.name,
        u?.email,
        u?.role,
        localDateStr(b.start, tz),
        clockTime(b.start, tz),
        clockTime(b.end, tz),
        hours,
        b.title,
        b.goal?.title ?? "",
        b.category ?? "",
        b.done ? "Yes" : "No",
        b.work_note ?? "",
      ]
        .map(csvCell)
        .join(",");
    });
    // BOM so Excel opens UTF-8 correctly
    const csv = "\uFEFF" + [header.join(","), ...rows].join("\r\n");
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${orgSlug}-all-tasks-${today}.csv"`,
      },
    });
  }

  await ensurePlannerSchema();

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
      "Content-Disposition": `attachment; filename="${orgSlug}-export-${today}.json"`,
    },
  });
}
