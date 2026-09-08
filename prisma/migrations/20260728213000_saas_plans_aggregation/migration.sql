CREATE TYPE "BillingInterval" AS ENUM ('MONTHLY', 'YEARLY');

CREATE TABLE "SaasPlan" (
  "id" TEXT NOT NULL,
  "code" VARCHAR(40) NOT NULL,
  "name" VARCHAR(80) NOT NULL,
  "description" VARCHAR(500),
  "monthlyPrice" DECIMAL(12,2) NOT NULL,
  "yearlyPrice" DECIMAL(12,2),
  "maxProperties" INTEGER NOT NULL DEFAULT 1,
  "maxRooms" INTEGER NOT NULL,
  "allowPromptPay" BOOLEAN NOT NULL DEFAULT true,
  "allowFileUploads" BOOLEAN NOT NULL DEFAULT true,
  "allowPrioritySupport" BOOLEAN NOT NULL DEFAULT false,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SaasPlan_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SaasPlan_code_key" ON "SaasPlan"("code");
CREATE INDEX "SaasPlan_isActive_sortOrder_idx" ON "SaasPlan"("isActive", "sortOrder");

ALTER TABLE "PropertySubscription"
  ADD COLUMN "planId" TEXT,
  ADD COLUMN "billingInterval" "BillingInterval" NOT NULL DEFAULT 'MONTHLY',
  ADD COLUMN "priceAmount" DECIMAL(12,2) NOT NULL DEFAULT 0;

CREATE INDEX "PropertySubscription_planId_status_idx" ON "PropertySubscription"("planId", "status");
ALTER TABLE "PropertySubscription" ADD CONSTRAINT "PropertySubscription_planId_fkey"
  FOREIGN KEY ("planId") REFERENCES "SaasPlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "SaasPlan" (
  "id", "code", "name", "description", "monthlyPrice", "yearlyPrice",
  "maxProperties", "maxRooms", "allowPromptPay", "allowFileUploads",
  "allowPrioritySupport", "isActive", "sortOrder", "updatedAt"
) VALUES
  ('plan_starter', 'STARTER', 'Starter', 'สำหรับหอพักขนาดเล็ก', 299, 2990, 1, 30, true, true, false, true, 10, CURRENT_TIMESTAMP),
  ('plan_growth', 'GROWTH', 'Growth', 'สำหรับหอพักที่กำลังเติบโต', 699, 6990, 3, 150, true, true, true, true, 20, CURRENT_TIMESTAMP),
  ('plan_business', 'BUSINESS', 'Business', 'สำหรับผู้ประกอบการหลายหอ', 1499, 14990, 10, 1000, true, true, true, true, 30, CURRENT_TIMESTAMP);

UPDATE "PropertySubscription" subscription
SET "planId" = plan."id",
    "priceAmount" = plan."monthlyPrice"
FROM "SaasPlan" plan
WHERE UPPER(subscription."planName") = plan."code";

INSERT INTO "PropertySubscription" (
  "propertyId", "planId", "planName", "billingInterval", "priceAmount",
  "status", "maxProperties", "maxRooms", "startsAt", "expiresAt",
  "createdAt", "updatedAt"
)
SELECT property."id", 'plan_starter', 'Starter', 'MONTHLY', 0,
       'TRIAL', 1, 30, CURRENT_TIMESTAMP,
       CURRENT_TIMESTAMP + INTERVAL '14 days', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "Property" property
WHERE NOT EXISTS (
  SELECT 1 FROM "PropertySubscription" subscription
  WHERE subscription."propertyId" = property."id"
);
