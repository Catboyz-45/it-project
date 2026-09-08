CREATE TABLE "RoomTypeConfig" (
  "id" TEXT NOT NULL,
  "propertyId" TEXT NOT NULL,
  "name" VARCHAR(80) NOT NULL,
  "monthlyRent" DECIMAL(12,2) NOT NULL,
  "depositAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "capacity" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RoomTypeConfig_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "ServiceChargeConfig" (
  "id" TEXT NOT NULL,
  "propertyId" TEXT NOT NULL,
  "name" VARCHAR(120) NOT NULL,
  "amount" DECIMAL(12,2) NOT NULL,
  "frequency" VARCHAR(20) NOT NULL,
  "calculation" VARCHAR(20) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ServiceChargeConfig_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "FurnitureOption" (
  "id" TEXT NOT NULL,
  "propertyId" TEXT NOT NULL,
  "name" VARCHAR(80) NOT NULL,
  "isDefault" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FurnitureOption_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "RoomTypeConfig_propertyId_name_key" ON "RoomTypeConfig"("propertyId", "name");
CREATE INDEX "RoomTypeConfig_propertyId_idx" ON "RoomTypeConfig"("propertyId");
CREATE UNIQUE INDEX "ServiceChargeConfig_propertyId_name_key" ON "ServiceChargeConfig"("propertyId", "name");
CREATE INDEX "ServiceChargeConfig_propertyId_idx" ON "ServiceChargeConfig"("propertyId");
CREATE UNIQUE INDEX "FurnitureOption_propertyId_name_key" ON "FurnitureOption"("propertyId", "name");
CREATE INDEX "FurnitureOption_propertyId_idx" ON "FurnitureOption"("propertyId");
ALTER TABLE "RoomTypeConfig" ADD CONSTRAINT "RoomTypeConfig_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ServiceChargeConfig" ADD CONSTRAINT "ServiceChargeConfig_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FurnitureOption" ADD CONSTRAINT "FurnitureOption_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;
