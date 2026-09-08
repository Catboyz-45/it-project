CREATE TYPE "AccountApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

ALTER TABLE "User"
  ADD COLUMN "approvalStatus" "AccountApprovalStatus" NOT NULL DEFAULT 'APPROVED',
  ADD COLUMN "approvalReviewedAt" TIMESTAMP(3),
  ADD COLUMN "approvalReviewedById" TEXT,
  ADD COLUMN "approvalRejectionReason" VARCHAR(500);

-- Existing accounts predate the approval workflow and remain usable.
ALTER TABLE "User" ALTER COLUMN "approvalStatus" SET DEFAULT 'PENDING';

ALTER TABLE "User"
  ADD CONSTRAINT "User_approvalReviewedById_fkey"
  FOREIGN KEY ("approvalReviewedById") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "User_role_approvalStatus_createdAt_idx"
  ON "User"("role", "approvalStatus", "createdAt" DESC);
CREATE INDEX "User_approvalReviewedById_idx"
  ON "User"("approvalReviewedById");
