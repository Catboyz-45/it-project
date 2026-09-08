CREATE TYPE "OccupancyTransitionType" AS ENUM ('MOVE_OUT', 'MOVE_ROOM');

DROP INDEX IF EXISTS "RoomOccupancy_roomId_tenantProfileId_status_key";
CREATE INDEX "RoomOccupancy_roomId_tenantProfileId_status_idx"
  ON "RoomOccupancy"("roomId", "tenantProfileId", "status");
CREATE UNIQUE INDEX "RoomOccupancy_one_open_per_tenant_room"
  ON "RoomOccupancy"("roomId", "tenantProfileId")
  WHERE "status" IN ('PENDING', 'ACTIVE');

CREATE TABLE "OccupancyTransition" (
  "id" TEXT NOT NULL,
  "propertyId" TEXT NOT NULL,
  "type" "OccupancyTransitionType" NOT NULL,
  "primaryOccupancyId" TEXT NOT NULL,
  "sourceRoomId" TEXT NOT NULL,
  "destinationRoomId" TEXT,
  "effectiveDate" DATE NOT NULL,
  "reason" VARCHAR(500) NOT NULL,
  "depositAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "deductions" JSONB NOT NULL,
  "outstandingAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "refundAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "amountDue" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "transferredAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "settlementNote" VARCHAR(1000),
  "completedByUserId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OccupancyTransition_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "OccupancyTransition_destination_check" CHECK (
    ("type" = 'MOVE_ROOM' AND "destinationRoomId" IS NOT NULL)
    OR ("type" = 'MOVE_OUT' AND "destinationRoomId" IS NULL)
  ),
  CONSTRAINT "OccupancyTransition_amounts_check" CHECK (
    "depositAmount" >= 0 AND "outstandingAmount" >= 0 AND "refundAmount" >= 0
    AND "amountDue" >= 0 AND "transferredAmount" >= 0
  )
);

CREATE INDEX "OccupancyTransition_propertyId_createdAt_idx" ON "OccupancyTransition"("propertyId", "createdAt" DESC);
CREATE INDEX "OccupancyTransition_primaryOccupancyId_idx" ON "OccupancyTransition"("primaryOccupancyId");
CREATE INDEX "OccupancyTransition_sourceRoomId_idx" ON "OccupancyTransition"("sourceRoomId");
CREATE INDEX "OccupancyTransition_destinationRoomId_idx" ON "OccupancyTransition"("destinationRoomId");
CREATE INDEX "OccupancyTransition_completedByUserId_idx" ON "OccupancyTransition"("completedByUserId");

ALTER TABLE "OccupancyTransition" ADD CONSTRAINT "OccupancyTransition_propertyId_fkey"
  FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OccupancyTransition" ADD CONSTRAINT "OccupancyTransition_primaryOccupancyId_fkey"
  FOREIGN KEY ("primaryOccupancyId") REFERENCES "RoomOccupancy"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OccupancyTransition" ADD CONSTRAINT "OccupancyTransition_sourceRoomId_fkey"
  FOREIGN KEY ("sourceRoomId") REFERENCES "Room"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OccupancyTransition" ADD CONSTRAINT "OccupancyTransition_destinationRoomId_fkey"
  FOREIGN KEY ("destinationRoomId") REFERENCES "Room"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OccupancyTransition" ADD CONSTRAINT "OccupancyTransition_completedByUserId_fkey"
  FOREIGN KEY ("completedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
