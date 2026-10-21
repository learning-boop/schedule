-- Workbook month page: "Date and Day" grid (Week 1–5 × Monday–Sunday),
-- stored as { "<day of month>": "plan text" }.
-- IF NOT EXISTS: the app also adds this column at runtime if it is missing.
ALTER TABLE "monthly_plans" ADD COLUMN IF NOT EXISTS "day_plans" JSONB NOT NULL DEFAULT '{}';

-- Repair plan keys written by older clients that converted dates to UTC
-- (users ahead of UTC got Sunday for a Monday week start, and the last day
-- of the previous month for the 1st). Never overwrites an existing key.
UPDATE "weekly_plans" w SET "week_start" = w."week_start" + 1
WHERE EXTRACT(ISODOW FROM w."week_start") = 7
  AND NOT EXISTS (
    SELECT 1 FROM "weekly_plans" x
    WHERE x."user_id" = w."user_id" AND x."week_start" = w."week_start" + 1
  );

UPDATE "monthly_plans" m SET "month" = m."month" + 1
WHERE EXTRACT(DAY FROM (m."month" + 1)) = 1
  AND NOT EXISTS (
    SELECT 1 FROM "monthly_plans" x
    WHERE x."user_id" = m."user_id" AND x."month" = m."month" + 1
  );
