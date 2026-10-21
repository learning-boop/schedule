import { prisma } from "@/lib/prisma";
import { ensurePlannerSchema } from "@/lib/schema-guard";
import {
  addDays,
  dateLabel,
  dayOfWeek,
  eachDay,
  isDateStr,
  localDateStr,
  localMinutes,
  mondayOf,
  monthStartOf,
  shortTime,
  zonedTimeToUtc,
} from "@/lib/tz";
import type {
  DayPageData,
  GoalsPageData,
  MonthPageData,
  PlannerPage,
  SwotPageData,
  WeekPageData,
} from "./workbook";

export type ExportType = "day" | "week" | "month" | "goals" | "full";

export type ExportRequest = {
  type: ExportType;
  date?: string;
  weekStart?: string;
  month?: string;
  startDate?: string;
  endDate?: string;
};

export const MAX_FULL_RANGE_DAYS = 93;

type Plan =
  | {
      ok: true;
      goals: boolean;
      from: string;
      to: string;
      weeks: boolean;
      days: boolean;
      months: boolean;
    }
  | { ok: false; error: string };

/** Work out which workbook pages an export needs */
export function planExport(req: ExportRequest, today: string): Plan {
  switch (req.type) {
    case "goals":
      return {
        ok: true,
        goals: true,
        from: today,
        to: today,
        weeks: false,
        days: false,
        months: false,
      };
    case "day": {
      const d = isDateStr(req.date) ? req.date : today;
      return { ok: true, goals: false, from: d, to: d, weeks: false, days: true, months: false };
    }
    case "week": {
      const ws = mondayOf(
        isDateStr(req.weekStart) ? req.weekStart : isDateStr(req.date) ? req.date : today,
      );
      return {
        ok: true,
        goals: false,
        from: ws,
        to: addDays(ws, 6),
        weeks: true,
        days: true,
        months: false,
      };
    }
    case "month": {
      const m = monthStartOf(
        isDateStr(req.month) ? req.month : isDateStr(req.date) ? req.date : today,
      );
      return { ok: true, goals: false, from: m, to: m, weeks: false, days: false, months: true };
    }
    case "full": {
      if (!isDateStr(req.startDate) || !isDateStr(req.endDate) || req.endDate < req.startDate) {
        return { ok: false, error: "startDate and endDate (YYYY-MM-DD) required" };
      }
      if (eachDay(req.startDate, req.endDate).length > MAX_FULL_RANGE_DAYS) {
        return { ok: false, error: `Date range too long (max ${MAX_FULL_RANGE_DAYS} days)` };
      }
      return {
        ok: true,
        goals: true,
        from: req.startDate,
        to: req.endDate,
        weeks: true,
        days: true,
        months: true,
      };
    }
    default:
      return { ok: false, error: "Unknown export type" };
  }
}

type BlockRow = {
  title: string;
  start: Date;
  end: Date;
  done: boolean;
  goal: { colour: string } | null;
};

const asArray = <T>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);
const asObject = <T extends object>(v: unknown, fallback: T): T =>
  v && typeof v === "object" && !Array.isArray(v)
    ? ({ ...fallback, ...(v as object) } as T)
    : fallback;

const monthName = (m: string) =>
  new Date(m + "T00:00:00Z").toLocaleDateString("en-GB", {
    timeZone: "UTC",
    month: "long",
    year: "numeric",
  });

/** Build the workbook pages for one person */
export async function collectPlannerPages(
  userId: string,
  req: ExportRequest,
  tz: string,
): Promise<{ ok: true; pages: PlannerPage[] } | { ok: false; error: string }> {
  const today = localDateStr(new Date(), tz);
  const plan = planExport(req, today);
  if (!plan.ok) return plan;

  await ensurePlannerSchema();

  const pages: PlannerPage[] = [];

  // ── Goals page ────────────────────────────────────────────────
  if (plan.goals) {
    const goals = await prisma.goal.findMany({
      where: { user_id: userId, status: "active" },
      include: {
        sub_goals: { orderBy: { created_at: "asc" } },
        actions: { orderBy: { order: "asc" } },
      },
      orderBy: { rank: "asc" },
      take: 10,
    });
    const data: GoalsPageData = {
      kind: "goals",
      goals: goals.map((g) => {
        const nextAction = g.actions.find((a) => !a.done)?.title ?? null;
        return {
          title: g.title,
          colour: g.colour,
          deadline: g.deadline ? dateLabel(g.deadline.toISOString().slice(0, 10)) : null,
          subGoals: g.sub_goals.map((s) => ({
            title: s.title,
            done: s.done,
            deadline: s.deadline
              ? dateLabel(s.deadline.toISOString().slice(0, 10), { year: undefined })
              : null,
          })),
          nextAction,
          actionsDone: g.actions.filter((a) => a.done).length,
          actionsTotal: g.actions.length,
        };
      }),
    };
    pages.push(data);
  }

  if (!plan.months && !plan.weeks && !plan.days) return { ok: true, pages };

  // ── Load everything for the span in a few queries ─────────────
  const from = plan.weeks ? mondayOf(plan.from) : plan.from;
  const to = plan.weeks ? addDays(mondayOf(plan.to), 6) : plan.to;
  const days = eachDay(plan.from, plan.to);
  const monthKeys = plan.months ? [...new Set(eachDay(plan.from, plan.to).map(monthStartOf))] : [];
  const weekKeys = plan.weeks ? [...new Set(days.map(mondayOf))] : [];

  // Month pages need hours for the whole month, daily pages need the day's blocks
  const blockFrom = monthKeys.length ? (monthKeys[0] < from ? monthKeys[0] : from) : from;
  const lastMonth = monthKeys[monthKeys.length - 1];
  const lastMonthEnd = lastMonth ? addDays(monthStartOf(addDays(lastMonth, 32)), -1) : to;
  const blockTo = lastMonthEnd > to ? lastMonthEnd : to;

  const [monthlyPlans, weeklyPlans, dailyPages, blocks] = await Promise.all([
    monthKeys.length
      ? prisma.monthlyPlan.findMany({
          where: { user_id: userId, month: { in: monthKeys.map((m) => new Date(m)) } },
        })
      : Promise.resolve([]),
    weekKeys.length
      ? prisma.weeklyPlan.findMany({
          where: { user_id: userId, week_start: { in: weekKeys.map((w) => new Date(w)) } },
        })
      : Promise.resolve([]),
    plan.days
      ? prisma.dailyPage.findMany({
          where: { user_id: userId, date: { gte: new Date(plan.from), lte: new Date(plan.to) } },
        })
      : Promise.resolve([]),
    prisma.timeBlock.findMany({
      where: {
        user_id: userId,
        start: { lt: zonedTimeToUtc(addDays(blockTo, 1), tz) },
        end: { gt: zonedTimeToUtc(blockFrom, tz) },
      },
      select: {
        title: true,
        start: true,
        end: true,
        done: true,
        goal: { select: { colour: true } },
      },
      orderBy: { start: "asc" },
    }) as Promise<BlockRow[]>,
  ]);

  const key = (d: Date) => d.toISOString().slice(0, 10); // @db.Date values are UTC midnight
  const monthByKey = new Map(monthlyPlans.map((p) => [key(p.month), p]));
  const weekByKey = new Map(weeklyPlans.map((p) => [key(p.week_start), p]));
  const dailyByKey = new Map(dailyPages.map((p) => [key(p.date), p]));

  // Group blocks and completed hours by local day
  const blocksByDay = new Map<string, BlockRow[]>();
  const hoursByDay: Record<string, number> = {};
  for (const b of blocks) {
    const d = localDateStr(b.start, tz);
    if (!blocksByDay.has(d)) blocksByDay.set(d, []);
    blocksByDay.get(d)!.push(b);
    if (b.done) hoursByDay[d] = (hoursByDay[d] ?? 0) + (b.end.getTime() - b.start.getTime()) / 36e5;
  }

  const monthPages = (m: string): PlannerPage[] => {
    const p = monthByKey.get(m);
    const month: MonthPageData = {
      kind: "month",
      month: m,
      monthLabel: monthName(m),
      top3: asArray<string>(p?.top3).filter((t) => typeof t === "string"),
      focus: p?.focus ?? null,
      dayPlans: asObject<Record<string, string>>(p?.day_plans, {}),
      hoursByDay,
    };
    const swot: SwotPageData = {
      kind: "swot",
      swot: asObject(p?.swot, { strengths: "", weaknesses: "", opportunities: "", threats: "" }),
    };
    return [month, swot];
  };

  const weekPage = (ws: string): WeekPageData => {
    const p = weekByKey.get(ws);
    const slots: string[][] = Array.from({ length: 7 }, () => Array(5).fill(""));
    for (const s of asArray<{ day: number; index: number; text: string }>(p?.slots)) {
      if (s && s.day >= 0 && s.day < 7 && s.index >= 0 && s.index < 5)
        slots[s.day][s.index] = s.text ?? "";
    }
    const sunday = addDays(ws, 6);
    const sameMonth = ws.slice(0, 7) === sunday.slice(0, 7);
    return {
      kind: "week",
      weekLabel: `${dateLabel(ws, sameMonth ? { month: undefined, year: undefined } : { year: undefined })} – ${dateLabel(sunday)}`,
      dayLabels: Array.from({ length: 7 }, (_, i) =>
        dateLabel(addDays(ws, i), { year: undefined }),
      ),
      goals: asArray<{ text: string; done: boolean }>(p?.goals),
      quote: p?.quote ?? null,
      slots,
    };
  };

  const dayPage = (d: string): DayPageData => {
    const p = dailyByKey.get(d);
    const fitnessRaw = p?.fitness ?? null;
    const fitnessDone = !!fitnessRaw?.startsWith("[done]");
    const dayStart = zonedTimeToUtc(d, tz);
    return {
      kind: "day",
      dateLabel: dateLabel(d),
      weekday: dayOfWeek(d),
      top3: asArray<{ text: string; done: boolean }>(p?.top3),
      matrix: asObject(p?.matrix, {
        urgent_important: [] as string[],
        not_urgent_important: [] as string[],
        urgent_not: [] as string[],
        not_urgent_not: [] as string[],
      }),
      water: p?.water ?? 0,
      fitness: fitnessRaw
        ? { text: fitnessRaw.replace(/^\[done\] ?/, ""), done: fitnessDone }
        : null,
      notes: p?.notes ?? null,
      blocks: (blocksByDay.get(d) ?? []).map((b) => {
        const startMin = localMinutes(b.start, tz);
        const endMin = Math.max(
          startMin + 1,
          Math.min(24 * 60, (b.end.getTime() - dayStart.getTime()) / 60000),
        );
        return {
          title: b.title,
          startMin,
          endMin,
          label: `${shortTime(b.start, tz)}–${shortTime(b.end, tz)} ${b.title}`,
          done: b.done,
          colour: b.goal?.colour ?? "#039be5",
        };
      }),
    };
  };

  // ── Order pages like the workbook: month, SWOT, week, its days ─
  if (plan.months && !plan.weeks) {
    for (const m of monthKeys) pages.push(...monthPages(m));
  } else if (plan.weeks) {
    // A week goes under the month of its first day in the range
    const emitted = new Set<string>();
    for (const ws of weekKeys) {
      const inRange = eachDay(ws, addDays(ws, 6)).filter((d) => d >= plan.from && d <= plan.to);
      const home = monthStartOf(inRange[0] ?? ws);
      if (plan.months && !emitted.has(home)) {
        emitted.add(home);
        pages.push(...monthPages(home));
      }
      pages.push(weekPage(ws));
      if (plan.days) for (const d of inRange) pages.push(dayPage(d));
    }
    // Months that only appear at the tail of the last week
    if (plan.months) for (const m of monthKeys) if (!emitted.has(m)) pages.push(...monthPages(m));
  } else if (plan.days) {
    for (const d of days) pages.push(dayPage(d));
  }

  return { ok: true, pages };
}
