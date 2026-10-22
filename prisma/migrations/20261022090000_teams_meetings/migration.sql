-- Teams, invites v2, meetings with guests, notifications.
-- Every statement is idempotent: the app also applies this at runtime (src/lib/schema-guard.ts)
-- when the database is behind, so deploys work without running migrations by hand.

ALTER TABLE "organisations" ADD COLUMN IF NOT EXISTS "work_days" INTEGER[] NOT NULL DEFAULT ARRAY[1, 2, 3, 4, 5, 6]::INTEGER[];

ALTER TABLE "organisations" ADD COLUMN IF NOT EXISTS "work_start" INTEGER NOT NULL DEFAULT 540;

ALTER TABLE "organisations" ADD COLUMN IF NOT EXISTS "work_end" INTEGER NOT NULL DEFAULT 1080;

CREATE TABLE IF NOT EXISTS "teams" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "org_id" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "lead_id" UUID,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL,
  CONSTRAINT "teams_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "teams_org_id_name_key" ON "teams"("org_id", "name");

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "team_id" UUID;

ALTER TABLE "invites" ADD COLUMN IF NOT EXISTS "team_id" UUID;

ALTER TABLE "invites" ADD COLUMN IF NOT EXISTS "invited_by" UUID;

ALTER TABLE "invites" ADD COLUMN IF NOT EXISTS "accepted_at" TIMESTAMPTZ;

ALTER TABLE "invites" ADD COLUMN IF NOT EXISTS "revoked_at" TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS "invites_org_id_idx" ON "invites"("org_id");

UPDATE "invites" SET "email" = lower(trim("email")) WHERE "email" <> lower(trim("email"));

CREATE TABLE IF NOT EXISTS "meetings" (
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
);

CREATE INDEX IF NOT EXISTS "meetings_org_id_start_idx" ON "meetings"("org_id", "start");

CREATE TABLE IF NOT EXISTS "meeting_guests" (
  "meeting_id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "response" TEXT NOT NULL DEFAULT 'pending',
  "note" TEXT,
  "responded_at" TIMESTAMPTZ,
  CONSTRAINT "meeting_guests_pkey" PRIMARY KEY ("meeting_id", "user_id")
);

CREATE INDEX IF NOT EXISTS "meeting_guests_user_id_idx" ON "meeting_guests"("user_id");

ALTER TABLE "time_blocks" ADD COLUMN IF NOT EXISTS "meeting_id" UUID;

ALTER TABLE "time_blocks" ADD COLUMN IF NOT EXISTS "rsvp" TEXT;

CREATE INDEX IF NOT EXISTS "time_blocks_meeting_id_idx" ON "time_blocks"("meeting_id");

CREATE TABLE IF NOT EXISTS "notifications" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "actor_id" UUID,
  "meeting_id" UUID,
  "type" TEXT NOT NULL,
  "data" JSONB NOT NULL DEFAULT '{}',
  "read_at" TIMESTAMPTZ,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "notifications_user_id_created_at_idx" ON "notifications"("user_id", "created_at");

DO $$
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
END $$;

ALTER TABLE "teams" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "meetings" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "meeting_guests" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "notifications" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "pdf_exports" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "goal_templates" ENABLE ROW LEVEL SECURITY;
