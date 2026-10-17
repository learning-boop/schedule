-- AlterTable
ALTER TABLE "organisations" ADD COLUMN     "billing_email" TEXT,
ADD COLUMN     "billing_region" TEXT,
ADD COLUMN     "razorpay_customer_id" TEXT,
ADD COLUMN     "razorpay_subscription_id" TEXT,
ADD COLUMN     "stripe_customer_id" TEXT,
ADD COLUMN     "stripe_subscription_id" TEXT,
ADD COLUMN     "trial_ends_at" TIMESTAMPTZ,
ALTER COLUMN "plan" SET DEFAULT 'trial';
