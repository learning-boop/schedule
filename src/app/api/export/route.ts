import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { htmlToPdf } from "@/lib/pdf/generate";
import { buildHTML, goalsPage, monthPage, weekPage, dailyPage } from "@/lib/pdf/templates";
import { formatDate } from "@/lib/date-utils";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { type, date, weekStart, month, startDate, endDate } = body;
  // type: "day" | "week" | "month" | "goals" | "full"

  const pages: string[] = [];
  let filename = "planner";

  try {
    if (type === "goals" || type === "full") {
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
      filename = "goals";
    }

    if (type === "month" || type === "full") {
      const m = month || (type === "full" && startDate ? startDate.slice(0, 7) + "-01" : null);
      if (m) {
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
        filename = type === "month" ? `month-${m}` : filename;
      }
    }

    if (type === "week" || type === "full") {
      const ws = weekStart || (type === "full" && startDate ? startDate : null);
      if (ws) {
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
        filename = type === "week" ? `week-${ws}` : filename;
      }
    }

    if (type === "day" || type === "full") {
      const dates: string[] = [];
      if (type === "day" && date) {
        dates.push(date);
      } else if (type === "full" && startDate && endDate) {
        const cur = new Date(startDate);
        const end = new Date(endDate);
        while (cur <= end) {
          dates.push(formatDate(cur));
          cur.setDate(cur.getDate() + 1);
        }
      }

      for (const d of dates) {
        const dp = await prisma.dailyPage.findUnique({
          where: { user_id_date: { user_id: user.id, date: new Date(d) } },
        });
        const blocks = await prisma.timeBlock.findMany({
          where: {
            user_id: user.id,
            start: { gte: new Date(d) },
            end: { lte: new Date(d + "T23:59:59Z") },
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
            date: d,
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
        filename = type === "day" ? `day-${d}` : filename;
      }
    }

    if (type === "full") filename = `planner-${startDate}-to-${endDate}`;

    if (pages.length === 0) {
      return NextResponse.json(
        { error: "No data found for the given parameters" },
        { status: 400 },
      );
    }

    const html = buildHTML(pages);
    const pdfBuffer = await htmlToPdf(html);

    // Store with expiring share link
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 day expiry

    const exported = await prisma.pdfExport.create({
      data: {
        user_id: user.id,
        filename: `${filename}.pdf`,
        data: new Uint8Array(pdfBuffer),
        expires_at: expiresAt,
      },
    });

    return NextResponse.json({
      id: exported.id,
      token: exported.token,
      filename: exported.filename,
      expiresAt: exported.expires_at.toISOString(),
      downloadUrl: `/api/export/${exported.token}`,
    });
  } catch (err) {
    console.error("PDF export error:", err);
    return NextResponse.json(
      { error: "Failed to generate PDF. Ensure Chromium is available." },
      { status: 500 },
    );
  }
}
