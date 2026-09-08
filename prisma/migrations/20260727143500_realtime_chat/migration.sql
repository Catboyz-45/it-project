CREATE TYPE "ChatSenderRole" AS ENUM ('ADMIN', 'TENANT');

CREATE TABLE "ChatConversation" (
  "id" TEXT NOT NULL,
  "propertyId" TEXT NOT NULL,
  "tenantExternalId" VARCHAR(80) NOT NULL,
  "tenantName" VARCHAR(160) NOT NULL,
  "roomNumber" VARCHAR(30) NOT NULL,
  "lastMessageAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ChatConversation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ChatMessage" (
  "id" TEXT NOT NULL,
  "propertyId" TEXT NOT NULL,
  "conversationId" TEXT NOT NULL,
  "senderRole" "ChatSenderRole" NOT NULL,
  "senderUserId" TEXT,
  "body" VARCHAR(4000) NOT NULL,
  "clientId" VARCHAR(80) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ChatMessage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ChatConversation_propertyId_tenantExternalId_key" ON "ChatConversation"("propertyId", "tenantExternalId");
CREATE INDEX "ChatConversation_propertyId_lastMessageAt_idx" ON "ChatConversation"("propertyId", "lastMessageAt" DESC);
CREATE UNIQUE INDEX "ChatMessage_conversationId_clientId_key" ON "ChatMessage"("conversationId", "clientId");
CREATE INDEX "ChatMessage_conversationId_createdAt_idx" ON "ChatMessage"("conversationId", "createdAt");
CREATE INDEX "ChatMessage_propertyId_createdAt_idx" ON "ChatMessage"("propertyId", "createdAt");

ALTER TABLE "ChatConversation" ADD CONSTRAINT "ChatConversation_propertyId_fkey"
  FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_propertyId_fkey"
  FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_conversationId_fkey"
  FOREIGN KEY ("conversationId") REFERENCES "ChatConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_senderUserId_fkey"
  FOREIGN KEY ("senderUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
