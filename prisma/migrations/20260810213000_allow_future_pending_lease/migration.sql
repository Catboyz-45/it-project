-- A signed future lease may wait alongside the currently active lease.
-- Application-level date-overlap validation protects renewal periods, while
-- this index continues to guarantee only one operational lease per room.
DROP INDEX IF EXISTS "Lease_one_live_per_room";

CREATE UNIQUE INDEX "Lease_one_active_per_room"
  ON "Lease"("roomId")
  WHERE "status" IN ('ACTIVE', 'EXPIRING');
