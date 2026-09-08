-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('TRIAL', 'ACTIVE', 'EXPIRED', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "RoomStatus" AS ENUM ('AVAILABLE', 'OCCUPIED', 'MAINTENANCE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "OccupancyRole" AS ENUM ('PRIMARY', 'CO_OCCUPANT');

-- CreateEnum
CREATE TYPE "OccupancyStatus" AS ENUM ('PENDING', 'ACTIVE', 'ENDED', 'REJECTED');

-- CreateEnum
CREATE TYPE "InvitationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'EXPIRED', 'REVOKED');

-- CreateEnum
CREATE TYPE "LeaseStatus" AS ENUM ('DRAFT', 'PENDING_SIGNATURE', 'ACTIVE', 'EXPIRING', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "MeterType" AS ENUM ('WATER', 'ELECTRICITY');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'PENDING', 'PAID', 'OVERDUE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "InvoiceItemType" AS ENUM ('RENT', 'WATER', 'ELECTRICITY', 'SERVICE', 'LATE_FEE', 'OTHER');

-- CreateEnum
CREATE TYPE "PaymentSubmissionStatus" AS ENUM ('PENDING_REVIEW', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "TicketType" AS ENUM ('REPAIR', 'COMPLAINT');

-- CreateEnum
CREATE TYPE "TicketStatus" AS ENUM ('OPEN', 'ACKNOWLEDGED', 'IN_PROGRESS', 'RESOLVED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TicketPriority" AS ENUM ('NORMAL', 'URGENT');

-- CreateEnum
CREATE TYPE "ParcelStatus" AS ENUM ('WAITING', 'RECEIVED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AnnouncementStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "AnnouncementAudience" AS ENUM ('ALL_TENANTS', 'BUILDING', 'FLOOR', 'ROOM');

-- AlterEnum
ALTER TYPE "UserRole" ADD VALUE 'TENANT';

-- AlterTable
ALTER TABLE "Property" ADD COLUMN     "ownerUserId" TEXT;

-- CreateTable
CREATE TABLE "PropertySubscription" (
    "propertyId" TEXT NOT NULL,
    "planName" VARCHAR(80) NOT NULL,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'TRIAL',
    "maxProperties" INTEGER NOT NULL DEFAULT 1,
    "maxRooms" INTEGER NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "suspendedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PropertySubscription_pkey" PRIMARY KEY ("propertyId")
);

-- CreateTable
CREATE TABLE "PropertySettings" (
    "propertyId" TEXT NOT NULL,
    "legalName" VARCHAR(160),
    "lessorName" VARCHAR(160),
    "address" VARCHAR(1000) NOT NULL,
    "contactPhone" VARCHAR(30) NOT NULL,
    "contactEmail" VARCHAR(254),
    "logoStorageKey" VARCHAR(500),
    "promptPayId" VARCHAR(20),
    "waterUnitRate" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "electricityUnitRate" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "billingDay" INTEGER NOT NULL DEFAULT 1,
    "dueDay" INTEGER NOT NULL DEFAULT 5,
    "lateFeePerDay" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "lateFeeCap" DECIMAL(12,2),
    "invoicePrefix" VARCHAR(20) NOT NULL DEFAULT 'INV',
    "invoiceFooter" VARCHAR(2000),
    "houseRules" TEXT,
    "emergencyContact" VARCHAR(500),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PropertySettings_pkey" PRIMARY KEY ("propertyId")
);

-- CreateTable
CREATE TABLE "Building" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "code" VARCHAR(30) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Building_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Floor" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "buildingId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "label" VARCHAR(80),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Floor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Room" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "buildingId" TEXT NOT NULL,
    "floorId" TEXT NOT NULL,
    "number" VARCHAR(30) NOT NULL,
    "roomType" VARCHAR(80) NOT NULL,
    "monthlyRent" DECIMAL(12,2) NOT NULL,
    "depositAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "capacity" INTEGER NOT NULL DEFAULT 1,
    "status" "RoomStatus" NOT NULL DEFAULT 'AVAILABLE',
    "furniture" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Room_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TenantProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "phone" VARCHAR(30) NOT NULL,
    "address" VARCHAR(1000),
    "emergencyName" VARCHAR(160),
    "emergencyPhone" VARCHAR(30),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TenantProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TenantInvitation" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "tokenHash" CHAR(64) NOT NULL,
    "status" "InvitationStatus" NOT NULL DEFAULT 'PENDING',
    "intendedRole" "OccupancyRole" NOT NULL DEFAULT 'CO_OCCUPANT',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "acceptedById" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TenantInvitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoomOccupancy" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "tenantProfileId" TEXT NOT NULL,
    "role" "OccupancyRole" NOT NULL,
    "status" "OccupancyStatus" NOT NULL DEFAULT 'PENDING',
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "endReason" VARCHAR(500),
    "approvedAt" TIMESTAMP(3),
    "approvedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RoomOccupancy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lease" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "leaseNumber" VARCHAR(50) NOT NULL,
    "status" "LeaseStatus" NOT NULL DEFAULT 'DRAFT',
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "monthlyRent" DECIMAL(12,2) NOT NULL,
    "depositAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "currentVersion" INTEGER NOT NULL DEFAULT 1,
    "signedStorageKey" VARCHAR(500),
    "activatedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lease_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeaseVersion" (
    "id" TEXT NOT NULL,
    "leaseId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "templateId" TEXT,
    "snapshot" JSONB NOT NULL,
    "documentId" TEXT,
    "signedStorageKey" VARCHAR(500),
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeaseVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeaseTenant" (
    "leaseId" TEXT NOT NULL,
    "occupancyId" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeaseTenant_pkey" PRIMARY KEY ("leaseId","occupancyId")
);

-- CreateTable
CREATE TABLE "MeterReading" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "type" "MeterType" NOT NULL,
    "billingMonth" DATE NOT NULL,
    "previousReading" DECIMAL(14,3) NOT NULL,
    "currentReading" DECIMAL(14,3) NOT NULL,
    "unitRate" DECIMAL(12,2) NOT NULL,
    "recordedById" TEXT NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MeterReading_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "leaseId" TEXT,
    "invoiceNumber" VARCHAR(50) NOT NULL,
    "billingMonth" DATE NOT NULL,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "issuedAt" TIMESTAMP(3),
    "dueDate" DATE NOT NULL,
    "subtotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "lateFee" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "paidAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "cancellationNote" VARCHAR(500),
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvoiceItem" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "type" "InvoiceItemType" NOT NULL,
    "description" VARCHAR(255) NOT NULL,
    "quantity" DECIMAL(14,3) NOT NULL DEFAULT 1,
    "unitPrice" DECIMAL(12,2) NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "meterReadingId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InvoiceItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentSubmission" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "tenantProfileId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "status" "PaymentSubmissionStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
    "slipStorageKey" VARCHAR(500) NOT NULL,
    "slipMime" VARCHAR(100) NOT NULL,
    "slipSize" INTEGER NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "reviewedById" TEXT,
    "rejectionNote" VARCHAR(500),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceTicket" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "roomId" TEXT,
    "tenantProfileId" TEXT,
    "type" "TicketType" NOT NULL,
    "status" "TicketStatus" NOT NULL DEFAULT 'OPEN',
    "priority" "TicketPriority" NOT NULL DEFAULT 'NORMAL',
    "title" VARCHAR(200) NOT NULL,
    "detail" VARCHAR(4000) NOT NULL,
    "isAnonymous" BOOLEAN NOT NULL DEFAULT false,
    "createdByUserId" TEXT,
    "assignedToUserId" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceTicket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TicketAttachment" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "storageKey" VARCHAR(500) NOT NULL,
    "fileName" VARCHAR(255) NOT NULL,
    "mimeType" VARCHAR(100) NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TicketAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Parcel" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "status" "ParcelStatus" NOT NULL DEFAULT 'WAITING',
    "note" VARCHAR(1000),
    "imageStorageKey" VARCHAR(500),
    "registeredById" TEXT NOT NULL,
    "registeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "receivedAt" TIMESTAMP(3),
    "receivedByTenantId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Parcel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Announcement" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "content" VARCHAR(10000) NOT NULL,
    "status" "AnnouncementStatus" NOT NULL DEFAULT 'DRAFT',
    "audience" "AnnouncementAudience" NOT NULL DEFAULT 'ALL_TENANTS',
    "buildingId" TEXT,
    "floorId" TEXT,
    "publishAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Announcement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnnouncementRoom" (
    "announcementId" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,

    CONSTRAINT "AnnouncementRoom_pkey" PRIMARY KEY ("announcementId","roomId")
);

-- CreateIndex
CREATE INDEX "PropertySubscription_status_expiresAt_idx" ON "PropertySubscription"("status", "expiresAt");

-- CreateIndex
CREATE INDEX "Building_propertyId_isActive_idx" ON "Building"("propertyId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "Building_propertyId_code_key" ON "Building"("propertyId", "code");

-- CreateIndex
CREATE INDEX "Floor_propertyId_idx" ON "Floor"("propertyId");

-- CreateIndex
CREATE UNIQUE INDEX "Floor_buildingId_number_key" ON "Floor"("buildingId", "number");

-- CreateIndex
CREATE INDEX "Room_propertyId_status_idx" ON "Room"("propertyId", "status");

-- CreateIndex
CREATE INDEX "Room_buildingId_floorId_idx" ON "Room"("buildingId", "floorId");

-- CreateIndex
CREATE UNIQUE INDEX "Room_propertyId_number_key" ON "Room"("propertyId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "TenantProfile_userId_key" ON "TenantProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "TenantInvitation_tokenHash_key" ON "TenantInvitation"("tokenHash");

-- CreateIndex
CREATE INDEX "TenantInvitation_propertyId_roomId_status_idx" ON "TenantInvitation"("propertyId", "roomId", "status");

-- CreateIndex
CREATE INDEX "TenantInvitation_expiresAt_status_idx" ON "TenantInvitation"("expiresAt", "status");

-- CreateIndex
CREATE INDEX "RoomOccupancy_propertyId_status_idx" ON "RoomOccupancy"("propertyId", "status");

-- CreateIndex
CREATE INDEX "RoomOccupancy_tenantProfileId_status_idx" ON "RoomOccupancy"("tenantProfileId", "status");

-- CreateIndex
CREATE INDEX "RoomOccupancy_roomId_role_status_idx" ON "RoomOccupancy"("roomId", "role", "status");

-- CreateIndex
CREATE UNIQUE INDEX "RoomOccupancy_roomId_tenantProfileId_status_key" ON "RoomOccupancy"("roomId", "tenantProfileId", "status");

-- CreateIndex
CREATE INDEX "Lease_propertyId_status_endDate_idx" ON "Lease"("propertyId", "status", "endDate");

-- CreateIndex
CREATE INDEX "Lease_roomId_status_idx" ON "Lease"("roomId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Lease_propertyId_leaseNumber_key" ON "Lease"("propertyId", "leaseNumber");

-- CreateIndex
CREATE INDEX "LeaseVersion_documentId_idx" ON "LeaseVersion"("documentId");

-- CreateIndex
CREATE UNIQUE INDEX "LeaseVersion_leaseId_version_key" ON "LeaseVersion"("leaseId", "version");

-- CreateIndex
CREATE INDEX "LeaseTenant_occupancyId_idx" ON "LeaseTenant"("occupancyId");

-- CreateIndex
CREATE INDEX "MeterReading_propertyId_billingMonth_idx" ON "MeterReading"("propertyId", "billingMonth");

-- CreateIndex
CREATE INDEX "MeterReading_roomId_type_billingMonth_idx" ON "MeterReading"("roomId", "type", "billingMonth" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "MeterReading_roomId_type_billingMonth_key" ON "MeterReading"("roomId", "type", "billingMonth");

-- CreateIndex
CREATE INDEX "Invoice_propertyId_status_dueDate_idx" ON "Invoice"("propertyId", "status", "dueDate");

-- CreateIndex
CREATE INDEX "Invoice_propertyId_billingMonth_idx" ON "Invoice"("propertyId", "billingMonth");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_propertyId_invoiceNumber_key" ON "Invoice"("propertyId", "invoiceNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_roomId_billingMonth_key" ON "Invoice"("roomId", "billingMonth");

-- CreateIndex
CREATE INDEX "InvoiceItem_invoiceId_sortOrder_idx" ON "InvoiceItem"("invoiceId", "sortOrder");

-- CreateIndex
CREATE INDEX "InvoiceItem_meterReadingId_idx" ON "InvoiceItem"("meterReadingId");

-- CreateIndex
CREATE INDEX "PaymentSubmission_propertyId_status_submittedAt_idx" ON "PaymentSubmission"("propertyId", "status", "submittedAt");

-- CreateIndex
CREATE INDEX "PaymentSubmission_invoiceId_status_idx" ON "PaymentSubmission"("invoiceId", "status");

-- CreateIndex
CREATE INDEX "PaymentSubmission_tenantProfileId_submittedAt_idx" ON "PaymentSubmission"("tenantProfileId", "submittedAt" DESC);

-- CreateIndex
CREATE INDEX "ServiceTicket_propertyId_type_status_createdAt_idx" ON "ServiceTicket"("propertyId", "type", "status", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "ServiceTicket_tenantProfileId_status_idx" ON "ServiceTicket"("tenantProfileId", "status");

-- CreateIndex
CREATE INDEX "ServiceTicket_assignedToUserId_status_idx" ON "ServiceTicket"("assignedToUserId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "TicketAttachment_storageKey_key" ON "TicketAttachment"("storageKey");

-- CreateIndex
CREATE INDEX "TicketAttachment_ticketId_idx" ON "TicketAttachment"("ticketId");

-- CreateIndex
CREATE INDEX "Parcel_propertyId_status_registeredAt_idx" ON "Parcel"("propertyId", "status", "registeredAt" DESC);

-- CreateIndex
CREATE INDEX "Parcel_roomId_status_idx" ON "Parcel"("roomId", "status");

-- CreateIndex
CREATE INDEX "Announcement_propertyId_status_publishAt_idx" ON "Announcement"("propertyId", "status", "publishAt");

-- CreateIndex
CREATE INDEX "Announcement_buildingId_idx" ON "Announcement"("buildingId");

-- CreateIndex
CREATE INDEX "Announcement_floorId_idx" ON "Announcement"("floorId");

-- CreateIndex
CREATE INDEX "AnnouncementRoom_roomId_idx" ON "AnnouncementRoom"("roomId");

-- CreateIndex
CREATE INDEX "Property_ownerUserId_isActive_idx" ON "Property"("ownerUserId", "isActive");

-- AddForeignKey
ALTER TABLE "Property" ADD CONSTRAINT "Property_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertySubscription" ADD CONSTRAINT "PropertySubscription_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertySettings" ADD CONSTRAINT "PropertySettings_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Building" ADD CONSTRAINT "Building_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Floor" ADD CONSTRAINT "Floor_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "Building"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Room" ADD CONSTRAINT "Room_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Room" ADD CONSTRAINT "Room_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "Building"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Room" ADD CONSTRAINT "Room_floorId_fkey" FOREIGN KEY ("floorId") REFERENCES "Floor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantProfile" ADD CONSTRAINT "TenantProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantInvitation" ADD CONSTRAINT "TenantInvitation_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantInvitation" ADD CONSTRAINT "TenantInvitation_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantInvitation" ADD CONSTRAINT "TenantInvitation_acceptedById_fkey" FOREIGN KEY ("acceptedById") REFERENCES "TenantProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomOccupancy" ADD CONSTRAINT "RoomOccupancy_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomOccupancy" ADD CONSTRAINT "RoomOccupancy_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomOccupancy" ADD CONSTRAINT "RoomOccupancy_tenantProfileId_fkey" FOREIGN KEY ("tenantProfileId") REFERENCES "TenantProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomOccupancy" ADD CONSTRAINT "RoomOccupancy_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lease" ADD CONSTRAINT "Lease_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lease" ADD CONSTRAINT "Lease_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaseVersion" ADD CONSTRAINT "LeaseVersion_leaseId_fkey" FOREIGN KEY ("leaseId") REFERENCES "Lease"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaseTenant" ADD CONSTRAINT "LeaseTenant_leaseId_fkey" FOREIGN KEY ("leaseId") REFERENCES "Lease"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaseTenant" ADD CONSTRAINT "LeaseTenant_occupancyId_fkey" FOREIGN KEY ("occupancyId") REFERENCES "RoomOccupancy"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeterReading" ADD CONSTRAINT "MeterReading_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeterReading" ADD CONSTRAINT "MeterReading_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_leaseId_fkey" FOREIGN KEY ("leaseId") REFERENCES "Lease"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceItem" ADD CONSTRAINT "InvoiceItem_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceItem" ADD CONSTRAINT "InvoiceItem_meterReadingId_fkey" FOREIGN KEY ("meterReadingId") REFERENCES "MeterReading"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentSubmission" ADD CONSTRAINT "PaymentSubmission_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentSubmission" ADD CONSTRAINT "PaymentSubmission_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentSubmission" ADD CONSTRAINT "PaymentSubmission_tenantProfileId_fkey" FOREIGN KEY ("tenantProfileId") REFERENCES "TenantProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentSubmission" ADD CONSTRAINT "PaymentSubmission_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceTicket" ADD CONSTRAINT "ServiceTicket_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceTicket" ADD CONSTRAINT "ServiceTicket_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceTicket" ADD CONSTRAINT "ServiceTicket_tenantProfileId_fkey" FOREIGN KEY ("tenantProfileId") REFERENCES "TenantProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceTicket" ADD CONSTRAINT "ServiceTicket_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceTicket" ADD CONSTRAINT "ServiceTicket_assignedToUserId_fkey" FOREIGN KEY ("assignedToUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketAttachment" ADD CONSTRAINT "TicketAttachment_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "ServiceTicket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Parcel" ADD CONSTRAINT "Parcel_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Parcel" ADD CONSTRAINT "Parcel_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Parcel" ADD CONSTRAINT "Parcel_receivedByTenantId_fkey" FOREIGN KEY ("receivedByTenantId") REFERENCES "TenantProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Announcement" ADD CONSTRAINT "Announcement_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnnouncementRoom" ADD CONSTRAINT "AnnouncementRoom_announcementId_fkey" FOREIGN KEY ("announcementId") REFERENCES "Announcement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnnouncementRoom" ADD CONSTRAINT "AnnouncementRoom_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Business invariants that Prisma cannot currently express in the schema.
ALTER TABLE "PropertySubscription"
  ADD CONSTRAINT "PropertySubscription_limits_check" CHECK ("maxProperties" > 0 AND "maxRooms" > 0),
  ADD CONSTRAINT "PropertySubscription_dates_check" CHECK ("expiresAt" > "startsAt");

ALTER TABLE "PropertySettings"
  ADD CONSTRAINT "PropertySettings_billingDay_check" CHECK ("billingDay" BETWEEN 1 AND 28),
  ADD CONSTRAINT "PropertySettings_dueDay_check" CHECK ("dueDay" BETWEEN 1 AND 31),
  ADD CONSTRAINT "PropertySettings_rates_check" CHECK (
    "waterUnitRate" >= 0 AND
    "electricityUnitRate" >= 0 AND
    "lateFeePerDay" >= 0 AND
    ("lateFeeCap" IS NULL OR "lateFeeCap" >= 0)
  );

ALTER TABLE "Room"
  ADD CONSTRAINT "Room_amounts_capacity_check" CHECK (
    "monthlyRent" >= 0 AND "depositAmount" >= 0 AND "capacity" > 0
  );

ALTER TABLE "Lease"
  ADD CONSTRAINT "Lease_dates_check" CHECK ("endDate" >= "startDate"),
  ADD CONSTRAINT "Lease_amounts_version_check" CHECK (
    "monthlyRent" >= 0 AND "depositAmount" >= 0 AND "currentVersion" > 0
  );

ALTER TABLE "MeterReading"
  ADD CONSTRAINT "MeterReading_values_check" CHECK (
    "previousReading" >= 0 AND
    "currentReading" >= "previousReading" AND
    "unitRate" >= 0
  );

ALTER TABLE "Invoice"
  ADD CONSTRAINT "Invoice_amounts_version_check" CHECK (
    "subtotal" >= 0 AND "lateFee" >= 0 AND "total" >= 0 AND "version" > 0
  );

ALTER TABLE "InvoiceItem"
  ADD CONSTRAINT "InvoiceItem_values_check" CHECK (
    "quantity" >= 0 AND "unitPrice" >= 0 AND "amount" >= 0 AND "sortOrder" >= 0
  );

ALTER TABLE "PaymentSubmission"
  ADD CONSTRAINT "PaymentSubmission_values_check" CHECK ("amount" > 0 AND "slipSize" > 0);

ALTER TABLE "TicketAttachment"
  ADD CONSTRAINT "TicketAttachment_size_check" CHECK ("sizeBytes" > 0 AND "sizeBytes" <= 5242880);

-- Only one active primary occupant and one live lease may exist per room.
CREATE UNIQUE INDEX "RoomOccupancy_one_active_primary_per_room"
  ON "RoomOccupancy"("roomId")
  WHERE "role" = 'PRIMARY' AND "status" = 'ACTIVE';

CREATE UNIQUE INDEX "Lease_one_live_per_room"
  ON "Lease"("roomId")
  WHERE "status" IN ('PENDING_SIGNATURE', 'ACTIVE', 'EXPIRING');

-- Creator and document provenance relations are intentionally restrictive so
-- audit history cannot be orphaned by ordinary application deletes.
ALTER TABLE "TenantInvitation" ADD CONSTRAINT "TenantInvitation_createdByUserId_fkey"
  FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "LeaseVersion" ADD CONSTRAINT "LeaseVersion_templateId_fkey"
  FOREIGN KEY ("templateId") REFERENCES "DocumentTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "LeaseVersion" ADD CONSTRAINT "LeaseVersion_documentId_fkey"
  FOREIGN KEY ("documentId") REFERENCES "GeneratedDocument"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "LeaseVersion" ADD CONSTRAINT "LeaseVersion_createdByUserId_fkey"
  FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Parcel" ADD CONSTRAINT "Parcel_registeredById_fkey"
  FOREIGN KEY ("registeredById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Announcement" ADD CONSTRAINT "Announcement_buildingId_fkey"
  FOREIGN KEY ("buildingId") REFERENCES "Building"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Announcement" ADD CONSTRAINT "Announcement_floorId_fkey"
  FOREIGN KEY ("floorId") REFERENCES "Floor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Announcement" ADD CONSTRAINT "Announcement_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "TenantInvitation_createdByUserId_idx" ON "TenantInvitation"("createdByUserId");
CREATE INDEX "LeaseVersion_templateId_idx" ON "LeaseVersion"("templateId");
CREATE INDEX "LeaseVersion_createdByUserId_idx" ON "LeaseVersion"("createdByUserId");
CREATE INDEX "Parcel_registeredById_idx" ON "Parcel"("registeredById");
CREATE INDEX "Announcement_createdById_idx" ON "Announcement"("createdById");
