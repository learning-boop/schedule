import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendWeeklySummaryEmail } from "@/lib/email";

/** GET /api/cron/weekly-summary — called by cron every Monday morning */
export async function GET(request: Request) {
  // Verify cron secret to prevent unauthorized calls
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get("secret");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Last week: Mon-Sun
  const now = new Date();
  const day = now.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const thisMonday = new Date(now);
  thisMonday.setDate(thisMonday.getDate() + diff);
  thisMonday.setHours(0, 0, 0, 0);

  const lastMonday = new Date(thisMonday);
  lastMonday.setDate(lastMonday.getDate() - 7);

  const users = await prisma.user.findMany({
    where: { org_id: { not: null } },
    select: { id: true, name: true, email: true },
  });

  let sent = 0;

  for (const user of users) {
    const blocks = await prisma.timeBlock.findMany({
      where: {
        user_id: user.id,
        done: true,
        start: { gte: lastMonday },
        end: { lte: thisMonday },
      },
    });

    const hoursWorked = blocks.reduce(
      (sum, b) => sum + (b.end.getTime() - b.start.getTime()) / 3600000,
      0,
    );

    const goals = await prisma.goal.findMany({
      where: { user_id: user.id, status: "active" },
      include: { sub_goals: true, actions: true },
    });

    const goalsProgress = goals.map((g) => {
      const total = g.sub_goals.length + g.actions.length;
      const done =
        g.sub_goals.filter((s) => s.done).length + g.actions.filter((a) => a.done).length;
      return { title: g.title, progress: total > 0 ? Math.round((done / total) * 100) : 0 };
    });

    try {
      await sendWeeklySummaryEmail(user.email, user.name, {
        hoursWorked: Math.round(hoursWorked * 10) / 10,
        blocksDone: blocks.length,
        goalsProgress,
      });
      sent++;
    } catch (err) {
      console.error(`Failed to send summary to ${user.email}:`, err);
    }
  }

  return NextResponse.json({ sent, total: users.length });
}
