CREATE TYPE "ChatConversationType" AS ENUM ('TENANT_PROPERTY', 'PROPERTY_SUPPORT');

ALTER TYPE "ChatSenderRole" ADD VALUE 'SUPER_ADMIN';

ALTER TABLE "ChatConversation"
  ADD COLUMN "type" "ChatConversationType" NOT NULL DEFAULT 'TENANT_PROPERTY',
  ADD COLUMN "conversationKey" VARCHAR(140),
  ADD COLUMN "tenantProfileId" TEXT,
  ADD COLUMN "lastTenantReadAt" TIMESTAMP(3),
  ADD COLUMN "lastAdminReadAt" TIMESTAMP(3),
  ADD COLUMN "lastSuperAdminReadAt" TIMESTAMP(3),
  ALTER COLUMN "tenantExternalId" DROP NOT NULL,
  ALTER COLUMN "tenantName" DROP NOT NULL,
  ALTER COLUMN "roomNumber" DROP NOT NULL;

UPDATE "ChatConversation"
SET "conversationKey" = 'LEGACY:' || "tenantExternalId"
WHERE "conversationKey" IS NULL;

ALTER TABLE "ChatConversation" ALTER COLUMN "conversationKey" SET NOT NULL;

DROP INDEX "ChatConversation_propertyId_tenantExternalId_key";
CREATE UNIQUE INDEX "ChatConversation_propertyId_conversationKey_key"
  ON "ChatConversation"("propertyId", "conversationKey");
CREATE INDEX "ChatConversation_tenantProfileId_lastMessageAt_idx"
  ON "ChatConversation"("tenantProfileId", "lastMessageAt" DESC);
CREATE INDEX "ChatConversation_type_lastMessageAt_idx"
  ON "ChatConversation"("type", "lastMessageAt" DESC);

ALTER TABLE "ChatConversation" ADD CONSTRAINT "ChatConversation_tenantProfileId_fkey"
  FOREIGN KEY ("tenantProfileId") REFERENCES "TenantProfile"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
