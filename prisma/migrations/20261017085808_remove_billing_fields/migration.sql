/*
  Warnings:

  - You are about to drop the column `billing_email` on the `organisations` table. All the data in the column will be lost.
  - You are about to drop the column `billing_region` on the `organisations` table. All the data in the column will be lost.
  - You are about to drop the column `razorpay_customer_id` on the `organisations` table. All the data in the column will be lost.
  - You are about to drop the column `razorpay_subscription_id` on the `organisations` table. All the data in the column will be lost.
  - You are about to drop the column `stripe_customer_id` on the `organisations` table. All the data in the column will be lost.
  - You are about to drop the column `stripe_subscription_id` on the `organisations` table. All the data in the column will be lost.
  - You are about to drop the column `trial_ends_at` on the `organisations` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "organisations" DROP COLUMN "billing_email",
DROP COLUMN "billing_region",
DROP COLUMN "razorpay_customer_id",
DROP COLUMN "razorpay_subscription_id",
DROP COLUMN "stripe_customer_id",
DROP COLUMN "stripe_subscription_id",
DROP COLUMN "trial_ends_at",
ALTER COLUMN "plan" SET DEFAULT 'free';
