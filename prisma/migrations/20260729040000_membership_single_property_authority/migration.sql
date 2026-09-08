-- Preserve every legacy owner assignment as a membership before removing the
-- duplicate ownership authority.
INSERT INTO "PropertyMembership" ("userId", "propertyId", "createdAt")
SELECT "ownerUserId", "id", CURRENT_TIMESTAMP
FROM "Property"
WHERE "ownerUserId" IS NOT NULL
ON CONFLICT ("userId", "propertyId") DO NOTHING;

DROP INDEX IF EXISTS "Property_ownerUserId_isActive_idx";

ALTER TABLE "Property"
DROP CONSTRAINT IF EXISTS "Property_ownerUserId_fkey";

ALTER TABLE "Property"
DROP COLUMN "ownerUserId";
