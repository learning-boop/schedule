import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { buildHTML, goalsPage, monthPage, weekPage, dailyPage } from "@/lib/pdf/templates";
import { formatDate } from "@/lib/date-utils";

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type") ?? "day";
  const date = searchParams.get("date") ?? formatDate(new Date());

  const pages: string[] = [];

  if (type === "goals" || type === "all") {
    const goals = await prisma.goal.findMany({
      where: { user_id: user.id, status: "active" },
      include: { sub_goals: true, actions: true },
      orderBy: { rank: "asc" },
    });
    pages.push(
      goalsPage(
        goals.map((g) => ({
          title: g.title,
          colour: g.colour,
          rank: g.rank,
          deadline: g.deadline ? formatDate(g.deadline) : null,
          sub_goals: g.sub_goals.map((sg) => ({
            title: sg.title,
            done: sg.done,
            deadline: sg.deadline ? formatDate(sg.deadline) : null,
          })),
          actions: g.actions.map((a) => ({
            title: a.title,
            done: a.done,
            order: a.order,
          })),
        })),
      ),
    );
  }

  if (type === "month" || type === "all") {
    const m = date.slice(0, 7) + "-01";
    const plan = await prisma.monthlyPlan.findUnique({
      where: { user_id_month: { user_id: user.id, month: new Date(m) } },
    });
    const defaultSwot = { strengths: "", weaknesses: "", opportunities: "", threats: "" };
    pages.push(
      monthPage({
        month: m,
        top3: (plan?.top3 as string[]) || [],
        focus: plan?.focus ?? null,
        swot: plan?.swot
          ? { ...defaultSwot, ...(plan.swot as Record<string, string>) }
          : defaultSwot,
      }),
    );
  }

  if (type === "week" || type === "all") {
    // Find the Monday of the week containing `date`
    const d = new Date(date + "T00:00:00");
    const day = d.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    d.setDate(d.getDate() + diff);
    const ws = formatDate(d);

    const plan = await prisma.weeklyPlan.findUnique({
      where: { user_id_week_start: { user_id: user.id, week_start: new Date(ws) } },
    });
    pages.push(
      weekPage({
        weekStart: ws,
        goals: (plan?.goals as { text: string; done: boolean }[]) || [],
        quote: plan?.quote ?? null,
        slots: (plan?.slots as { day: number; index: number; text: string }[]) || [],
      }),
    );
  }

  if (type === "day" || type === "all") {
    const dp = await prisma.dailyPage.findUnique({
      where: { user_id_date: { user_id: user.id, date: new Date(date) } },
    });
    const blocks = await prisma.timeBlock.findMany({
      where: {
        user_id: user.id,
        start: { gte: new Date(date) },
        end: { lte: new Date(date + "T23:59:59Z") },
      },
      orderBy: { start: "asc" },
    });
    const defaultMatrix = {
      urgent_important: [],
      urgent_not: [],
      not_urgent_important: [],
      not_urgent_not: [],
    };
    pages.push(
      dailyPage({
        date,
        top3: (dp?.top3 as { text: string; done: boolean; goalId?: string }[]) || [],
        matrix: dp?.matrix
          ? { ...defaultMatrix, ...(dp.matrix as Record<string, string[]>) }
          : defaultMatrix,
        water: dp?.water ?? 0,
        fitness: dp?.fitness ?? null,
        notes: dp?.notes ?? null,
        blocks: blocks.map((b) => ({
          title: b.title,
          start: b.start.toISOString(),
          end: b.end.toISOString(),
          done: b.done,
          category: b.category,
        })),
      }),
    );
  }

  const html = buildHTML(pages);
  return new NextResponse(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
