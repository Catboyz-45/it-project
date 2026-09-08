ALTER TABLE "ChatMessage"
  ADD COLUMN "attachmentName" VARCHAR(255),
  ADD COLUMN "attachmentMime" VARCHAR(100),
  ADD COLUMN "attachmentSize" INTEGER,
  ADD COLUMN "attachmentKey" VARCHAR(500);
