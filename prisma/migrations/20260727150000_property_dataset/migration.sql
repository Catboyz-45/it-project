CREATE TABLE "PropertyDataset" (
  "propertyId" TEXT NOT NULL,
  "rooms" JSONB NOT NULL,
  "tenants" JSONB NOT NULL,
  "invoices" JSONB NOT NULL,
  "repairs" JSONB NOT NULL,
  "parcels" JSONB NOT NULL,
  "announcements" JSONB NOT NULL,
  "complaints" JSONB NOT NULL,
  "settings" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PropertyDataset_pkey" PRIMARY KEY ("propertyId")
);

ALTER TABLE "PropertyDataset" ADD CONSTRAINT "PropertyDataset_propertyId_fkey"
  FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;
