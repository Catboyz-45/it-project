-- CreateEnum
CREATE TYPE "PolicyType" AS ENUM ('TERMS_OF_SERVICE', 'PRIVACY_NOTICE', 'MARKETING_COMMUNICATIONS');

-- CreateEnum
CREATE TYPE "PolicyActionType" AS ENUM ('ACCEPTED', 'ACKNOWLEDGED', 'GRANTED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "PolicyActionSource" AS ENUM ('REGISTRATION', 'REQUIRED_GATE', 'ACCOUNT_SETTINGS');

-- CreateTable
CREATE TABLE "PolicyAction" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "policyType" "PolicyType" NOT NULL,
    "action" "PolicyActionType" NOT NULL,
    "documentVersion" VARCHAR(40) NOT NULL,
    "source" "PolicyActionSource" NOT NULL,
    "requestId" VARCHAR(80),
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PolicyAction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PolicyAction_userId_policyType_occurredAt_idx" ON "PolicyAction"("userId", "policyType", "occurredAt" DESC);

-- CreateIndex
CREATE INDEX "PolicyAction_policyType_documentVersion_occurredAt_idx" ON "PolicyAction"("policyType", "documentVersion", "occurredAt" DESC);

-- AddForeignKey
ALTER TABLE "PolicyAction" ADD CONSTRAINT "PolicyAction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
