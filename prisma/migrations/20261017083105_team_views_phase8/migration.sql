-- AlterTable
ALTER TABLE "organisations" ADD COLUMN     "allow_comments" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "goal_templates" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "org_id" UUID NOT NULL,
    "created_by" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "colour" TEXT NOT NULL DEFAULT '#6366f1',
    "actions" JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "goal_templates_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "goal_templates" ADD CONSTRAINT "goal_templates_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
