CREATE TYPE "TicketEventType" AS ENUM ('CREATED', 'STATUS_CHANGED', 'PRIORITY_CHANGED', 'ATTACHMENT_ADDED');

CREATE TABLE "RoomFurniture" (
  "roomId" TEXT NOT NULL,
  "furnitureOptionId" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RoomFurniture_pkey" PRIMARY KEY ("roomId", "furnitureOptionId")
);

CREATE TABLE "LegacyFurnitureMigrationIssue" (
  "roomId" TEXT NOT NULL,
  "legacyValue" JSONB NOT NULL,
  "reason" VARCHAR(120) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LegacyFurnitureMigrationIssue_pkey" PRIMARY KEY ("roomId")
);

INSERT INTO "LegacyFurnitureMigrationIssue" ("roomId", "legacyValue", "reason")
SELECT "id", "furniture"::jsonb, 'Room.furniture was not a JSON array'
FROM "Room"
WHERE "furniture" IS NOT NULL AND jsonb_typeof("furniture"::jsonb) <> 'array';

INSERT INTO "FurnitureOption" ("id", "propertyId", "name", "isDefault", "createdAt", "updatedAt")
SELECT
  'legacy_' || md5(r."propertyId" || ':' || item.name),
  r."propertyId",
  item.name,
  false,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Room" r
CROSS JOIN LATERAL (
  SELECT DISTINCT trim(value) AS name
  FROM jsonb_array_elements_text(
    CASE WHEN jsonb_typeof(r."furniture"::jsonb) = 'array' THEN r."furniture"::jsonb ELSE '[]'::jsonb END
  )
) item
WHERE item.name <> ''
ON CONFLICT ("propertyId", "name") DO NOTHING;

INSERT INTO "RoomFurniture" ("roomId", "furnitureOptionId", "quantity", "createdAt")
SELECT r."id", f."id", 1, CURRENT_TIMESTAMP
FROM "Room" r
CROSS JOIN LATERAL (
  SELECT DISTINCT trim(value) AS name
  FROM jsonb_array_elements_text(
    CASE WHEN jsonb_typeof(r."furniture"::jsonb) = 'array' THEN r."furniture"::jsonb ELSE '[]'::jsonb END
  )
) item
JOIN "FurnitureOption" f ON f."propertyId" = r."propertyId" AND f."name" = item.name
WHERE item.name <> ''
ON CONFLICT ("roomId", "furnitureOptionId") DO NOTHING;

ALTER TABLE "Room" DROP COLUMN "furniture";

CREATE TABLE "TicketEvent" (
  "id" TEXT NOT NULL,
  "ticketId" TEXT NOT NULL,
  "type" "TicketEventType" NOT NULL,
  "actorUserId" TEXT,
  "fromValue" VARCHAR(80),
  "toValue" VARCHAR(80),
  "attachmentId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TicketEvent_pkey" PRIMARY KEY ("id")
);

INSERT INTO "TicketEvent" ("id", "ticketId", "type", "toValue", "createdAt")
SELECT 'legacy_' || md5("id" || ':created'), "id", 'CREATED', "status"::text, "createdAt"
FROM "ServiceTicket";

ALTER TABLE "Parcel" ADD COLUMN "recipientTenantId" TEXT;

CREATE INDEX "RoomFurniture_furnitureOptionId_idx" ON "RoomFurniture"("furnitureOptionId");
CREATE INDEX "TicketEvent_ticketId_createdAt_idx" ON "TicketEvent"("ticketId", "createdAt");
CREATE INDEX "TicketEvent_actorUserId_createdAt_idx" ON "TicketEvent"("actorUserId", "createdAt");
CREATE INDEX "TicketEvent_attachmentId_idx" ON "TicketEvent"("attachmentId");
CREATE INDEX "Parcel_recipientTenantId_status_idx" ON "Parcel"("recipientTenantId", "status");

ALTER TABLE "RoomFurniture" ADD CONSTRAINT "RoomFurniture_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RoomFurniture" ADD CONSTRAINT "RoomFurniture_furnitureOptionId_fkey" FOREIGN KEY ("furnitureOptionId") REFERENCES "FurnitureOption"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TicketEvent" ADD CONSTRAINT "TicketEvent_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "ServiceTicket"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TicketEvent" ADD CONSTRAINT "TicketEvent_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TicketEvent" ADD CONSTRAINT "TicketEvent_attachmentId_fkey" FOREIGN KEY ("attachmentId") REFERENCES "TicketAttachment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Parcel" ADD CONSTRAINT "Parcel_recipientTenantId_fkey" FOREIGN KEY ("recipientTenantId") REFERENCES "TenantProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
