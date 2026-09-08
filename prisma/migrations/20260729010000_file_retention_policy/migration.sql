ALTER TABLE "PaymentSubmission"
  ALTER COLUMN "slipStorageKey" DROP NOT NULL,
  ALTER COLUMN "slipMime" DROP NOT NULL,
  ALTER COLUMN "slipSize" DROP NOT NULL,
  ADD COLUMN "slipPurgedAt" TIMESTAMP(3);

ALTER TABLE "GeneratedDocument"
  ALTER COLUMN "storageKey" DROP NOT NULL,
  ADD COLUMN "filePurgedAt" TIMESTAMP(3);

ALTER TABLE "ChatMessage"
  ADD COLUMN "attachmentPurgedAt" TIMESTAMP(3);

ALTER TABLE "Lease"
  ADD COLUMN "signedDocumentPurgedAt" TIMESTAMP(3);

CREATE INDEX "PaymentSubmission_slipPurgedAt_reviewedAt_idx"
  ON "PaymentSubmission"("slipPurgedAt", "reviewedAt");

CREATE INDEX "GeneratedDocument_filePurgedAt_createdAt_idx"
  ON "GeneratedDocument"("filePurgedAt", "createdAt");

CREATE INDEX "ChatMessage_attachmentPurgedAt_createdAt_idx"
  ON "ChatMessage"("attachmentPurgedAt", "createdAt");

CREATE INDEX "Lease_signedDocumentPurgedAt_endedAt_idx"
  ON "Lease"("signedDocumentPurgedAt", "endedAt");
