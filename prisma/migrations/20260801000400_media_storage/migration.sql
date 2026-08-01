CREATE TYPE "MediaStatus" AS ENUM ('UPLOADING', 'PROCESSING', 'READY', 'FAILED');
CREATE TYPE "MediaFormat" AS ENUM ('WEBP', 'AVIF', 'ORIGINAL');

ALTER TABLE "Media"
ADD COLUMN "status" "MediaStatus" NOT NULL DEFAULT 'UPLOADING',
ADD COLUMN "uploadExpiresAt" TIMESTAMPTZ(3),
ADD COLUMN "failureReason" VARCHAR(200);

UPDATE "Media" SET "status" = 'READY';

CREATE TABLE "MediaVariant" (
  "id" VARCHAR(30) NOT NULL,
  "mediaId" VARCHAR(30) NOT NULL,
  "format" "MediaFormat" NOT NULL,
  "width" INTEGER,
  "height" INTEGER,
  "objectKey" VARCHAR(1000) NOT NULL,
  "mimeType" VARCHAR(120) NOT NULL,
  "sizeBytes" BIGINT NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MediaVariant_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MediaVariant_objectKey_key" ON "MediaVariant"("objectKey");
CREATE UNIQUE INDEX "MediaVariant_mediaId_format_width_key" ON "MediaVariant"("mediaId", "format", "width");
CREATE INDEX "MediaVariant_mediaId_idx" ON "MediaVariant"("mediaId");
CREATE INDEX "Media_status_uploadExpiresAt_idx" ON "Media"("status", "uploadExpiresAt");
ALTER TABLE "MediaVariant" ADD CONSTRAINT "MediaVariant_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "Media"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "StorageCleanupJob" (
  "id" VARCHAR(30) NOT NULL,
  "mediaId" VARCHAR(30),
  "objectKeys" JSONB NOT NULL,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "nextRunAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastError" VARCHAR(500),
  "completedAt" TIMESTAMPTZ(3),
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StorageCleanupJob_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "StorageCleanupJob_completedAt_nextRunAt_idx" ON "StorageCleanupJob"("completedAt", "nextRunAt");
