CREATE TYPE "SubscriptionOrderType" AS ENUM ('NEW', 'RENEWAL');
CREATE TYPE "SubscriptionOrderStatus" AS ENUM ('PENDING_PAYMENT', 'PENDING_REVIEW', 'PAID', 'REJECTED', 'CANCELLED', 'EXPIRED');
CREATE TYPE "SubscriptionPaymentStatus" AS ENUM ('PENDING_REVIEW', 'APPROVED', 'REJECTED');

CREATE TABLE "SubscriptionOrder" (
  "id" TEXT NOT NULL,
  "orderNumber" VARCHAR(40) NOT NULL,
  "propertyId" TEXT NOT NULL,
  "planId" TEXT,
  "planCode" VARCHAR(40) NOT NULL,
  "planName" VARCHAR(80) NOT NULL,
  "type" "SubscriptionOrderType" NOT NULL,
  "status" "SubscriptionOrderStatus" NOT NULL DEFAULT 'PENDING_PAYMENT',
  "billingInterval" "BillingInterval" NOT NULL,
  "amount" DECIMAL(12,2) NOT NULL,
  "maxProperties" INTEGER NOT NULL,
  "maxRooms" INTEGER NOT NULL,
  "allowPromptPay" BOOLEAN NOT NULL,
  "allowFileUploads" BOOLEAN NOT NULL,
  "allowPrioritySupport" BOOLEAN NOT NULL,
  "createdByUserId" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "paidAt" TIMESTAMP(3),
  "activatedAt" TIMESTAMP(3),
  "cancelledAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SubscriptionOrder_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SubscriptionPayment" (
  "id" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "amount" DECIMAL(12,2) NOT NULL,
  "storageKey" VARCHAR(500) NOT NULL,
  "mimeType" VARCHAR(100) NOT NULL,
  "sizeBytes" INTEGER NOT NULL,
  "status" "SubscriptionPaymentStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
  "submittedByUserId" TEXT NOT NULL,
  "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewedAt" TIMESTAMP(3),
  "reviewedByUserId" TEXT,
  "rejectionNote" VARCHAR(500),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SubscriptionPayment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SubscriptionOrder_orderNumber_key" ON "SubscriptionOrder"("orderNumber");
CREATE INDEX "SubscriptionOrder_propertyId_createdAt_idx" ON "SubscriptionOrder"("propertyId", "createdAt" DESC);
CREATE INDEX "SubscriptionOrder_status_expiresAt_idx" ON "SubscriptionOrder"("status", "expiresAt");
CREATE INDEX "SubscriptionOrder_createdByUserId_idx" ON "SubscriptionOrder"("createdByUserId");
CREATE UNIQUE INDEX "SubscriptionOrder_one_open_per_property"
  ON "SubscriptionOrder"("propertyId")
  WHERE "status" IN ('PENDING_PAYMENT', 'PENDING_REVIEW');
CREATE INDEX "SubscriptionPayment_orderId_submittedAt_idx" ON "SubscriptionPayment"("orderId", "submittedAt" DESC);
CREATE INDEX "SubscriptionPayment_status_submittedAt_idx" ON "SubscriptionPayment"("status", "submittedAt");
CREATE INDEX "SubscriptionPayment_submittedByUserId_idx" ON "SubscriptionPayment"("submittedByUserId");
CREATE INDEX "SubscriptionPayment_reviewedByUserId_idx" ON "SubscriptionPayment"("reviewedByUserId");

ALTER TABLE "SubscriptionOrder" ADD CONSTRAINT "SubscriptionOrder_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SubscriptionOrder" ADD CONSTRAINT "SubscriptionOrder_planId_fkey" FOREIGN KEY ("planId") REFERENCES "SaasPlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SubscriptionOrder" ADD CONSTRAINT "SubscriptionOrder_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SubscriptionPayment" ADD CONSTRAINT "SubscriptionPayment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "SubscriptionOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SubscriptionPayment" ADD CONSTRAINT "SubscriptionPayment_submittedByUserId_fkey" FOREIGN KEY ("submittedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SubscriptionPayment" ADD CONSTRAINT "SubscriptionPayment_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
