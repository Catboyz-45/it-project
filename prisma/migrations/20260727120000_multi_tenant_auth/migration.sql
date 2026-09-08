CREATE TYPE "UserRole" AS ENUM ('SUPER_ADMIN', 'PROPERTY_ADMIN');
CREATE TYPE "AuditResult" AS ENUM ('SUCCESS', 'FAILURE');

CREATE TABLE "User" (
  "id" TEXT NOT NULL,
  "email" VARCHAR(254) NOT NULL,
  "passwordHash" VARCHAR(255) NOT NULL,
  "displayName" VARCHAR(120) NOT NULL,
  "role" "UserRole" NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Property" (
  "id" TEXT NOT NULL,
  "name" VARCHAR(160) NOT NULL,
  "shortName" VARCHAR(80) NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Property_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PropertyMembership" (
  "userId" TEXT NOT NULL,
  "propertyId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PropertyMembership_pkey" PRIMARY KEY ("userId", "propertyId")
);

CREATE TABLE "Session" (
  "id" TEXT NOT NULL,
  "tokenHash" CHAR(64) NOT NULL,
  "userId" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LoginThrottle" (
  "key" CHAR(64) NOT NULL,
  "failedCount" INTEGER NOT NULL DEFAULT 0,
  "windowStart" TIMESTAMP(3) NOT NULL,
  "blockedUntil" TIMESTAMP(3),
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "LoginThrottle_pkey" PRIMARY KEY ("key")
);

CREATE TABLE "AuditLog" (
  "id" TEXT NOT NULL,
  "userId" TEXT,
  "propertyId" TEXT,
  "action" VARCHAR(100) NOT NULL,
  "targetType" VARCHAR(80),
  "targetId" VARCHAR(120),
  "result" "AuditResult" NOT NULL,
  "requestId" VARCHAR(80) NOT NULL,
  "ipAddress" VARCHAR(64),
  "userAgent" VARCHAR(500),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "DocumentTemplate" ADD COLUMN "propertyId" TEXT;
ALTER TABLE "GeneratedDocument" ADD COLUMN "propertyId" TEXT;

-- Existing installations receive a disabled migration property so historical
-- documents remain attributable. Enable or reassign it explicitly after deploy.
INSERT INTO "Property" ("id", "name", "shortName", "isActive", "updatedAt")
VALUES ('migration-property', 'ข้อมูลก่อนแบ่งหอพัก', 'ข้อมูลเดิม', false, CURRENT_TIMESTAMP);

UPDATE "DocumentTemplate" SET "propertyId" = 'migration-property' WHERE "propertyId" IS NULL;
UPDATE "GeneratedDocument" SET "propertyId" = 'migration-property' WHERE "propertyId" IS NULL;

ALTER TABLE "DocumentTemplate" ALTER COLUMN "propertyId" SET NOT NULL;
ALTER TABLE "GeneratedDocument" ALTER COLUMN "propertyId" SET NOT NULL;
DROP INDEX "DocumentTemplate_kind_key";

CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE INDEX "User_role_isActive_idx" ON "User"("role", "isActive");
CREATE INDEX "Property_isActive_idx" ON "Property"("isActive");
CREATE INDEX "PropertyMembership_propertyId_idx" ON "PropertyMembership"("propertyId");
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");
CREATE INDEX "Session_userId_idx" ON "Session"("userId");
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");
CREATE INDEX "LoginThrottle_blockedUntil_idx" ON "LoginThrottle"("blockedUntil");
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt" DESC);
CREATE INDEX "AuditLog_userId_createdAt_idx" ON "AuditLog"("userId", "createdAt" DESC);
CREATE INDEX "AuditLog_propertyId_createdAt_idx" ON "AuditLog"("propertyId", "createdAt" DESC);
CREATE UNIQUE INDEX "DocumentTemplate_propertyId_kind_key" ON "DocumentTemplate"("propertyId", "kind");
CREATE INDEX "DocumentTemplate_propertyId_idx" ON "DocumentTemplate"("propertyId");
CREATE INDEX "GeneratedDocument_propertyId_createdAt_idx" ON "GeneratedDocument"("propertyId", "createdAt" DESC);

ALTER TABLE "PropertyMembership" ADD CONSTRAINT "PropertyMembership_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PropertyMembership" ADD CONSTRAINT "PropertyMembership_propertyId_fkey"
  FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_propertyId_fkey"
  FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DocumentTemplate" ADD CONSTRAINT "DocumentTemplate_propertyId_fkey"
  FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GeneratedDocument" ADD CONSTRAINT "GeneratedDocument_propertyId_fkey"
  FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
