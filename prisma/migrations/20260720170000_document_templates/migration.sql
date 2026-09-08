CREATE TYPE "DocumentKind" AS ENUM ('CONTRACT', 'INVOICE');

CREATE TABLE "DocumentTemplate" (
    "id" TEXT NOT NULL,
    "kind" "DocumentKind" NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "html" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "DocumentTemplate_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "GeneratedDocument" (
    "id" TEXT NOT NULL,
    "kind" "DocumentKind" NOT NULL,
    "referenceId" VARCHAR(80) NOT NULL,
    "storageKey" VARCHAR(500) NOT NULL,
    "checksum" CHAR(64) NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "metadata" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "templateId" TEXT NOT NULL,
    CONSTRAINT "GeneratedDocument_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DocumentTemplate_kind_key" ON "DocumentTemplate"("kind");
CREATE UNIQUE INDEX "GeneratedDocument_storageKey_key" ON "GeneratedDocument"("storageKey");
CREATE INDEX "GeneratedDocument_kind_referenceId_createdAt_idx" ON "GeneratedDocument"("kind", "referenceId", "createdAt" DESC);
CREATE INDEX "GeneratedDocument_templateId_idx" ON "GeneratedDocument"("templateId");

ALTER TABLE "GeneratedDocument" ADD CONSTRAINT "GeneratedDocument_templateId_fkey"
FOREIGN KEY ("templateId") REFERENCES "DocumentTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
