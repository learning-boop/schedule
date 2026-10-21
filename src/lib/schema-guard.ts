import { prisma } from "@/lib/prisma";

/**
 * One-time, idempotent upkeep run before planner reads/writes (once per server
 * instance), so a deploy works even if `prisma migrate deploy` hasn't been run:
 *
 * 1. Adds monthly_plans.day_plans (mirrors migration 20261021090000_month_day_plans).
 * 2. Repairs plan keys written by older clients, which turned dates into UTC
 *    before saving: users ahead of UTC (e.g. India) got Sunday for "Monday"
 *    week starts and the last day of the previous month for "the 1st".
 *    Only rows that can only have come from that bug are moved, and never
 *    onto a key that already exists.
 */
let ensured: Promise<void> | null = null;

export function ensurePlannerSchema(): Promise<void> {
  if (!ensured) {
    ensured = (async () => {
      const rows = await prisma.$queryRaw<{ present: boolean }[]>`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = current_schema()
            AND table_name = 'monthly_plans'
            AND column_name = 'day_plans'
        ) AS present`;
      if (!rows[0]?.present) {
        await prisma.$executeRawUnsafe(
          `ALTER TABLE "monthly_plans" ADD COLUMN IF NOT EXISTS "day_plans" JSONB NOT NULL DEFAULT '{}'`,
        );
      }

      await prisma.$executeRawUnsafe(`
        UPDATE "weekly_plans" w SET "week_start" = w."week_start" + 1
        WHERE EXTRACT(ISODOW FROM w."week_start") = 7
          AND NOT EXISTS (
            SELECT 1 FROM "weekly_plans" x
            WHERE x."user_id" = w."user_id" AND x."week_start" = w."week_start" + 1
          )`);
      await prisma.$executeRawUnsafe(`
        UPDATE "monthly_plans" m SET "month" = m."month" + 1
        WHERE EXTRACT(DAY FROM (m."month" + 1)) = 1
          AND NOT EXISTS (
            SELECT 1 FROM "monthly_plans" x
            WHERE x."user_id" = m."user_id" AND x."month" = m."month" + 1
          )`);
    })().catch((err) => {
      ensured = null; // try again on the next request
      console.error("ensurePlannerSchema failed:", err);
    });
  }
  return ensured;
}
