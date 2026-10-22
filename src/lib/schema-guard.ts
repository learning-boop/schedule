import type { PrismaClient } from "@/generated/prisma/client";

/**
 * Schema upkeep that runs once per server instance, before the first database
 * query (see src/lib/prisma.ts), so a deploy works even if
 * `prisma migrate deploy` hasn't been run against the database.
 *
 * Every statement is idempotent and mirrors a file in prisma/migrations:
 * - 20261021090000_month_day_plans — monthly_plans.day_plans
 * - 20261022090000_teams_meetings — teams, invites v2, meetings, notifications
 */

/** Mirrors prisma/migrations/20261022090000_teams_meetings/migration.sql */
export const TEAMS_MEETINGS_SQL: string[] = [
  // Company working days and hours (used to suggest meeting times)
  `ALTER TABLE "organisations" ADD COLUMN IF NOT EXISTS "work_days" INTEGER[] NOT NULL DEFAULT ARRAY[1, 2, 3, 4, 5, 6]::INTEGER[]`,
  `ALTER TABLE "organisations" ADD COLUMN IF NOT EXISTS "work_start" INTEGER NOT NULL DEFAULT 540`,
  `ALTER TABLE "organisations" ADD COLUMN IF NOT EXISTS "work_end" INTEGER NOT NULL DEFAULT 1080`,

  // Teams
  `CREATE TABLE IF NOT EXISTS "teams" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "org_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "lead_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    CONSTRAINT "teams_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "teams_org_id_name_key" ON "teams"("org_id", "name")`,
  `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "team_id" UUID`,

  // Invites: team, who invited, and a status instead of deleting used invites
  `ALTER TABLE "invites" ADD COLUMN IF NOT EXISTS "team_id" UUID`,
  `ALTER TABLE "invites" ADD COLUMN IF NOT EXISTS "invited_by" UUID`,
  `ALTER TABLE "invites" ADD COLUMN IF NOT EXISTS "accepted_at" TIMESTAMPTZ`,
  `ALTER TABLE "invites" ADD COLUMN IF NOT EXISTS "revoked_at" TIMESTAMPTZ`,
  `CREATE INDEX IF NOT EXISTS "invites_org_id_idx" ON "invites"("org_id")`,
  `UPDATE "invites" SET "email" = lower(trim("email")) WHERE "email" <> lower(trim("email"))`,

  // Meetings and their guests
  `CREATE TABLE IF NOT EXISTS "meetings" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "org_id" UUID NOT NULL,
    "organiser_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "agenda" TEXT,
    "location" TEXT,
    "start" TIMESTAMPTZ NOT NULL,
    "end" TIMESTAMPTZ NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    CONSTRAINT "meetings_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE INDEX IF NOT EXISTS "meetings_org_id_start_idx" ON "meetings"("org_id", "start")`,
  `CREATE TABLE IF NOT EXISTS "meeting_guests" (
    "meeting_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "response" TEXT NOT NULL DEFAULT 'pending',
    "note" TEXT,
    "responded_at" TIMESTAMPTZ,
    CONSTRAINT "meeting_guests_pkey" PRIMARY KEY ("meeting_id", "user_id")
  )`,
  `CREATE INDEX IF NOT EXISTS "meeting_guests_user_id_idx" ON "meeting_guests"("user_id")`,
  `ALTER TABLE "time_blocks" ADD COLUMN IF NOT EXISTS "meeting_id" UUID`,
  `ALTER TABLE "time_blocks" ADD COLUMN IF NOT EXISTS "rsvp" TEXT`,
  `CREATE INDEX IF NOT EXISTS "time_blocks_meeting_id_idx" ON "time_blocks"("meeting_id")`,

  // In-app notifications
  `CREATE TABLE IF NOT EXISTS "notifications" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "actor_id" UUID,
    "meeting_id" UUID,
    "type" TEXT NOT NULL,
    "data" JSONB NOT NULL DEFAULT '{}',
    "read_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE INDEX IF NOT EXISTS "notifications_user_id_created_at_idx" ON "notifications"("user_id", "created_at")`,

  // Foreign keys, added only when missing
  `DO $$
  BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'teams_org_id_fkey') THEN
      ALTER TABLE "teams" ADD CONSTRAINT "teams_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'teams_lead_id_fkey') THEN
      ALTER TABLE "teams" ADD CONSTRAINT "teams_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_team_id_fkey') THEN
      ALTER TABLE "users" ADD CONSTRAINT "users_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'invites_team_id_fkey') THEN
      ALTER TABLE "invites" ADD CONSTRAINT "invites_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'invites_invited_by_fkey') THEN
      ALTER TABLE "invites" ADD CONSTRAINT "invites_invited_by_fkey" FOREIGN KEY ("invited_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'meetings_org_id_fkey') THEN
      ALTER TABLE "meetings" ADD CONSTRAINT "meetings_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'meetings_organiser_id_fkey') THEN
      ALTER TABLE "meetings" ADD CONSTRAINT "meetings_organiser_id_fkey" FOREIGN KEY ("organiser_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'meeting_guests_meeting_id_fkey') THEN
      ALTER TABLE "meeting_guests" ADD CONSTRAINT "meeting_guests_meeting_id_fkey" FOREIGN KEY ("meeting_id") REFERENCES "meetings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'meeting_guests_user_id_fkey') THEN
      ALTER TABLE "meeting_guests" ADD CONSTRAINT "meeting_guests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'time_blocks_meeting_id_fkey') THEN
      ALTER TABLE "time_blocks" ADD CONSTRAINT "time_blocks_meeting_id_fkey" FOREIGN KEY ("meeting_id") REFERENCES "meetings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'notifications_user_id_fkey') THEN
      ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'notifications_actor_id_fkey') THEN
      ALTER TABLE "notifications" ADD CONSTRAINT "notifications_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'notifications_meeting_id_fkey') THEN
      ALTER TABLE "notifications" ADD CONSTRAINT "notifications_meeting_id_fkey" FOREIGN KEY ("meeting_id") REFERENCES "meetings"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
  END $$`,

  // These tables are only read by the app's server. Row-level security with
  // no policies keeps them out of reach of Supabase's public REST API.
  `ALTER TABLE "teams" ENABLE ROW LEVEL SECURITY`,
  `ALTER TABLE "meetings" ENABLE ROW LEVEL SECURITY`,
  `ALTER TABLE "meeting_guests" ENABLE ROW LEVEL SECURITY`,
  `ALTER TABLE "notifications" ENABLE ROW LEVEL SECURITY`,
  `ALTER TABLE "pdf_exports" ENABLE ROW LEVEL SECURITY`,
  `ALTER TABLE "goal_templates" ENABLE ROW LEVEL SECURITY`,
];

/** Repairs plan keys written by older clients (see 20261021090000_month_day_plans) */
const PLAN_KEY_REPAIRS = [
  `UPDATE "weekly_plans" w SET "week_start" = w."week_start" + 1
   WHERE EXTRACT(ISODOW FROM w."week_start") = 7
     AND NOT EXISTS (
       SELECT 1 FROM "weekly_plans" x
       WHERE x."user_id" = w."user_id" AND x."week_start" = w."week_start" + 1
     )`,
  `UPDATE "monthly_plans" m SET "month" = m."month" + 1
   WHERE EXTRACT(DAY FROM (m."month" + 1)) = 1
     AND NOT EXISTS (
       SELECT 1 FROM "monthly_plans" x
       WHERE x."user_id" = m."user_id" AND x."month" = m."month" + 1
     )`,
];

let ensured: Promise<void> | null = null;

/**
 * Bring the database up to date (once per server instance). Always resolves:
 * on failure it logs, and tries again on the next query.
 */
export function ensureSchema(db: PrismaClient): Promise<void> {
  if (!ensured) {
    ensured = (async () => {
      const [state] = await db.$queryRaw<{ day_plans: boolean; teams_meetings: boolean }[]>`
        SELECT
          EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = current_schema()
              AND table_name = 'monthly_plans' AND column_name = 'day_plans'
          ) AS day_plans,
          (
            SELECT count(*) FROM information_schema.columns
            WHERE table_schema = current_schema()
              AND (table_name, column_name) IN (
                ('organisations', 'work_end'),
                ('users', 'team_id'),
                ('invites', 'revoked_at'),
                ('time_blocks', 'rsvp'),
                ('notifications', 'meeting_id'),
                ('meeting_guests', 'note'),
                ('meetings', 'location'),
                ('teams', 'lead_id')
              )
          ) = 8
          AND EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'notifications_meeting_id_fkey')
          AS teams_meetings`;

      if (!state?.day_plans) {
        await db.$executeRawUnsafe(
          `ALTER TABLE "monthly_plans" ADD COLUMN IF NOT EXISTS "day_plans" JSONB NOT NULL DEFAULT '{}'`,
        );
      }
      if (!state?.teams_meetings) {
        for (const sql of TEAMS_MEETINGS_SQL) await db.$executeRawUnsafe(sql);
      }
      for (const sql of PLAN_KEY_REPAIRS) await db.$executeRawUnsafe(sql);
    })().catch((err) => {
      ensured = null; // try again on the next query
      console.error("ensureSchema failed:", err);
    });
  }
  return ensured;
}
