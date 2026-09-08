CREATE TYPE "VehicleType" AS ENUM ('MOTORCYCLE', 'CAR', 'BICYCLE', 'OTHER');

CREATE TABLE "TenantVehicle" (
    "id" TEXT NOT NULL,
    "tenantProfileId" TEXT NOT NULL,
    "type" "VehicleType" NOT NULL,
    "licensePlate" VARCHAR(30) NOT NULL,
    "province" VARCHAR(80),
    "brandModel" VARCHAR(120),
    "color" VARCHAR(80),
    "detail" VARCHAR(500),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TenantVehicle_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TenantVehicle_tenantProfileId_key" ON "TenantVehicle"("tenantProfileId");
CREATE INDEX "TenantVehicle_licensePlate_idx" ON "TenantVehicle"("licensePlate");

ALTER TABLE "TenantVehicle"
ADD CONSTRAINT "TenantVehicle_tenantProfileId_fkey"
FOREIGN KEY ("tenantProfileId") REFERENCES "TenantProfile"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
