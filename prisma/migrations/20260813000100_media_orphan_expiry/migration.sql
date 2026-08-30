ALTER TABLE "Media" ADD COLUMN "orphanExpiresAt" TIMESTAMPTZ(3);

CREATE INDEX "Media_status_orphanExpiresAt_idx" ON "Media"("status", "orphanExpiresAt");
