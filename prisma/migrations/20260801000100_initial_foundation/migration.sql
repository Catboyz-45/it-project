-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "AdminRole" AS ENUM ('EDITOR', 'SUPER_ADMIN');

-- CreateEnum
CREATE TYPE "ContentStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "MediaKind" AS ENUM ('IMAGE', 'PDF');

-- CreateEnum
CREATE TYPE "AuditResult" AS ENUM ('SUCCESS', 'FAILURE');

-- CreateTable
CREATE TABLE "Company" (
    "id" VARCHAR(30) NOT NULL,
    "singletonKey" VARCHAR(20) NOT NULL DEFAULT 'PRIMARY',
    "legalName" VARCHAR(200) NOT NULL,
    "displayName" VARCHAR(160) NOT NULL,
    "shortDescription" VARCHAR(500),
    "history" TEXT,
    "vision" TEXT,
    "mission" TEXT,
    "address" TEXT,
    "phoneDisplay" VARCHAR(50),
    "phoneHref" VARCHAR(30),
    "email" VARCHAR(254),
    "lineLabel" VARCHAR(100),
    "lineUrl" VARCHAR(500),
    "facebookUrl" VARCHAR(500),
    "mapsUrl" VARCHAR(1000),
    "mapsEmbedUrl" VARCHAR(2000),
    "businessHours" VARCHAR(200),
    "seoTitle" VARCHAR(60),
    "seoDescription" VARCHAR(160),
    "logoMediaId" VARCHAR(30),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Banner" (
    "id" VARCHAR(30) NOT NULL,
    "title" VARCHAR(180) NOT NULL,
    "description" VARCHAR(500),
    "buttonLabel" VARCHAR(80),
    "buttonUrl" VARCHAR(500),
    "imageId" VARCHAR(30),
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
    "publishedAt" TIMESTAMPTZ(3),
    "deletedAt" TIMESTAMPTZ(3),
    "purgeAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Banner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Service" (
    "id" VARCHAR(30) NOT NULL,
    "slug" VARCHAR(180) NOT NULL,
    "title" VARCHAR(180) NOT NULL,
    "eyebrow" VARCHAR(80),
    "summary" VARCHAR(500) NOT NULL,
    "content" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "isSearchable" BOOLEAN NOT NULL DEFAULT true,
    "seoTitle" VARCHAR(60),
    "seoDescription" VARCHAR(160),
    "coverMediaId" VARCHAR(30),
    "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
    "publishedAt" TIMESTAMPTZ(3),
    "deletedAt" TIMESTAMPTZ(3),
    "purgeAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Service_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Brand" (
    "id" VARCHAR(30) NOT NULL,
    "slug" VARCHAR(120) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "deletedAt" TIMESTAMPTZ(3),
    "purgeAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Brand_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductType" (
    "id" VARCHAR(30) NOT NULL,
    "slug" VARCHAR(120) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "deletedAt" TIMESTAMPTZ(3),
    "purgeAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "ProductType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" VARCHAR(30) NOT NULL,
    "slug" VARCHAR(180) NOT NULL,
    "name" VARCHAR(180) NOT NULL,
    "model" VARCHAR(120) NOT NULL,
    "summary" VARCHAR(500) NOT NULL,
    "content" TEXT,
    "btuMin" INTEGER,
    "btuMax" INTEGER,
    "features" TEXT,
    "specifications" JSONB,
    "warranty" VARCHAR(200),
    "seer" DECIMAL(6,2),
    "refrigerant" VARCHAR(50),
    "priceLabel" VARCHAR(80) NOT NULL DEFAULT 'สอบถามราคา',
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "isSearchable" BOOLEAN NOT NULL DEFAULT true,
    "seoTitle" VARCHAR(60),
    "seoDescription" VARCHAR(160),
    "brandId" VARCHAR(30) NOT NULL,
    "productTypeId" VARCHAR(30) NOT NULL,
    "coverMediaId" VARCHAR(30),
    "catalogMediaId" VARCHAR(30),
    "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
    "publishedAt" TIMESTAMPTZ(3),
    "deletedAt" TIMESTAMPTZ(3),
    "purgeAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductMedia" (
    "productId" VARCHAR(30) NOT NULL,
    "mediaId" VARCHAR(30) NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ProductMedia_pkey" PRIMARY KEY ("productId","mediaId")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" VARCHAR(30) NOT NULL,
    "slug" VARCHAR(180) NOT NULL,
    "title" VARCHAR(180) NOT NULL,
    "projectType" VARCHAR(120) NOT NULL,
    "area" VARCHAR(160) NOT NULL,
    "customerName" VARCHAR(180),
    "showCustomerName" BOOLEAN NOT NULL DEFAULT false,
    "summary" VARCHAR(500) NOT NULL,
    "content" TEXT,
    "completedAt" DATE,
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "isSearchable" BOOLEAN NOT NULL DEFAULT true,
    "seoTitle" VARCHAR(60),
    "seoDescription" VARCHAR(160),
    "coverMediaId" VARCHAR(30),
    "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
    "publishedAt" TIMESTAMPTZ(3),
    "deletedAt" TIMESTAMPTZ(3),
    "purgeAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectMedia" (
    "projectId" VARCHAR(30) NOT NULL,
    "mediaId" VARCHAR(30) NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ProjectMedia_pkey" PRIMARY KEY ("projectId","mediaId")
);

-- CreateTable
CREATE TABLE "ProjectService" (
    "projectId" VARCHAR(30) NOT NULL,
    "serviceId" VARCHAR(30) NOT NULL,

    CONSTRAINT "ProjectService_pkey" PRIMARY KEY ("projectId","serviceId")
);

-- CreateTable
CREATE TABLE "NewsCategory" (
    "id" VARCHAR(30) NOT NULL,
    "slug" VARCHAR(120) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "deletedAt" TIMESTAMPTZ(3),
    "purgeAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "NewsCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "News" (
    "id" VARCHAR(30) NOT NULL,
    "slug" VARCHAR(180) NOT NULL,
    "title" VARCHAR(180) NOT NULL,
    "summary" VARCHAR(500) NOT NULL,
    "content" TEXT,
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "isSearchable" BOOLEAN NOT NULL DEFAULT true,
    "seoTitle" VARCHAR(60),
    "seoDescription" VARCHAR(160),
    "categoryId" VARCHAR(30) NOT NULL,
    "coverMediaId" VARCHAR(30),
    "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
    "publishedAt" TIMESTAMPTZ(3),
    "deletedAt" TIMESTAMPTZ(3),
    "purgeAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "News_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Media" (
    "id" VARCHAR(30) NOT NULL,
    "kind" "MediaKind" NOT NULL,
    "objectKey" VARCHAR(1000) NOT NULL,
    "originalName" VARCHAR(255),
    "mimeType" VARCHAR(120) NOT NULL,
    "sizeBytes" BIGINT NOT NULL,
    "checksumSha256" CHAR(64),
    "width" INTEGER,
    "height" INTEGER,
    "altText" VARCHAR(500),
    "isPrivate" BOOLEAN NOT NULL DEFAULT true,
    "uploadedById" VARCHAR(30),
    "deletedAt" TIMESTAMPTZ(3),
    "purgeAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Media_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Admin" (
    "id" VARCHAR(30) NOT NULL,
    "username" VARCHAR(80) NOT NULL,
    "usernameNormalized" VARCHAR(80) NOT NULL,
    "displayName" VARCHAR(160) NOT NULL,
    "role" "AdminRole" NOT NULL DEFAULT 'EDITOR',
    "passwordHash" VARCHAR(255) NOT NULL,
    "mustChangePassword" BOOLEAN NOT NULL DEFAULT true,
    "totpSecretEncrypted" TEXT,
    "totpKeyVersion" INTEGER,
    "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false,
    "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMPTZ(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" TIMESTAMPTZ(3),
    "deletedAt" TIMESTAMPTZ(3),
    "purgeAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Admin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" VARCHAR(30) NOT NULL,
    "tokenHash" CHAR(64) NOT NULL,
    "adminId" VARCHAR(30) NOT NULL,
    "twoFactorAt" TIMESTAMPTZ(3),
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "lastSeenAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMPTZ(3),
    "revokeReason" VARCHAR(160),
    "ipAddressHash" CHAR(64),
    "userAgentHash" CHAR(64),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecoveryCode" (
    "id" VARCHAR(30) NOT NULL,
    "adminId" VARCHAR(30) NOT NULL,
    "codeHash" CHAR(64) NOT NULL,
    "usedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecoveryCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" BIGSERIAL NOT NULL,
    "actorId" VARCHAR(30),
    "action" VARCHAR(120) NOT NULL,
    "targetType" VARCHAR(80),
    "targetId" VARCHAR(80),
    "result" "AuditResult" NOT NULL,
    "requestId" VARCHAR(100),
    "ipAddress" INET,
    "userAgent" VARCHAR(500),
    "metadata" JSONB,
    "errorCode" VARCHAR(100),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Redirect" (
    "id" VARCHAR(30) NOT NULL,
    "fromPath" VARCHAR(1000) NOT NULL,
    "toPath" VARCHAR(1000) NOT NULL,
    "statusCode" INTEGER NOT NULL DEFAULT 301,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "hitCount" BIGINT NOT NULL DEFAULT 0,
    "lastHitAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Redirect_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Company_singletonKey_key" ON "Company"("singletonKey");

-- CreateIndex
CREATE INDEX "Company_logoMediaId_idx" ON "Company"("logoMediaId");

-- CreateIndex
CREATE INDEX "Banner_status_sortOrder_idx" ON "Banner"("status", "sortOrder");

-- CreateIndex
CREATE INDEX "Banner_deletedAt_purgeAt_idx" ON "Banner"("deletedAt", "purgeAt");

-- CreateIndex
CREATE INDEX "Banner_imageId_idx" ON "Banner"("imageId");

-- CreateIndex
CREATE UNIQUE INDEX "Service_slug_key" ON "Service"("slug");

-- CreateIndex
CREATE INDEX "Service_status_sortOrder_idx" ON "Service"("status", "sortOrder");

-- CreateIndex
CREATE INDEX "Service_isFeatured_status_idx" ON "Service"("isFeatured", "status");

-- CreateIndex
CREATE INDEX "Service_deletedAt_purgeAt_idx" ON "Service"("deletedAt", "purgeAt");

-- CreateIndex
CREATE INDEX "Service_coverMediaId_idx" ON "Service"("coverMediaId");

-- CreateIndex
CREATE UNIQUE INDEX "Brand_slug_key" ON "Brand"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Brand_name_key" ON "Brand"("name");

-- CreateIndex
CREATE INDEX "Brand_isActive_sortOrder_idx" ON "Brand"("isActive", "sortOrder");

-- CreateIndex
CREATE INDEX "Brand_deletedAt_purgeAt_idx" ON "Brand"("deletedAt", "purgeAt");

-- CreateIndex
CREATE UNIQUE INDEX "ProductType_slug_key" ON "ProductType"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "ProductType_name_key" ON "ProductType"("name");

-- CreateIndex
CREATE INDEX "ProductType_isActive_sortOrder_idx" ON "ProductType"("isActive", "sortOrder");

-- CreateIndex
CREATE INDEX "ProductType_deletedAt_purgeAt_idx" ON "ProductType"("deletedAt", "purgeAt");

-- CreateIndex
CREATE UNIQUE INDEX "Product_slug_key" ON "Product"("slug");

-- CreateIndex
CREATE INDEX "Product_status_updatedAt_idx" ON "Product"("status", "updatedAt");

-- CreateIndex
CREATE INDEX "Product_brandId_productTypeId_status_idx" ON "Product"("brandId", "productTypeId", "status");

-- CreateIndex
CREATE INDEX "Product_btuMin_btuMax_idx" ON "Product"("btuMin", "btuMax");

-- CreateIndex
CREATE INDEX "Product_isFeatured_status_idx" ON "Product"("isFeatured", "status");

-- CreateIndex
CREATE INDEX "Product_deletedAt_purgeAt_idx" ON "Product"("deletedAt", "purgeAt");

-- CreateIndex
CREATE INDEX "Product_coverMediaId_idx" ON "Product"("coverMediaId");

-- CreateIndex
CREATE INDEX "Product_catalogMediaId_idx" ON "Product"("catalogMediaId");

-- CreateIndex
CREATE UNIQUE INDEX "Product_brandId_model_key" ON "Product"("brandId", "model");

-- CreateIndex
CREATE INDEX "ProductMedia_mediaId_idx" ON "ProductMedia"("mediaId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductMedia_productId_sortOrder_key" ON "ProductMedia"("productId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "Project_slug_key" ON "Project"("slug");

-- CreateIndex
CREATE INDEX "Project_status_completedAt_idx" ON "Project"("status", "completedAt");

-- CreateIndex
CREATE INDEX "Project_projectType_status_idx" ON "Project"("projectType", "status");

-- CreateIndex
CREATE INDEX "Project_isFeatured_status_idx" ON "Project"("isFeatured", "status");

-- CreateIndex
CREATE INDEX "Project_deletedAt_purgeAt_idx" ON "Project"("deletedAt", "purgeAt");

-- CreateIndex
CREATE INDEX "Project_coverMediaId_idx" ON "Project"("coverMediaId");

-- CreateIndex
CREATE INDEX "ProjectMedia_mediaId_idx" ON "ProjectMedia"("mediaId");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectMedia_projectId_sortOrder_key" ON "ProjectMedia"("projectId", "sortOrder");

-- CreateIndex
CREATE INDEX "ProjectService_serviceId_idx" ON "ProjectService"("serviceId");

-- CreateIndex
CREATE UNIQUE INDEX "NewsCategory_slug_key" ON "NewsCategory"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "NewsCategory_name_key" ON "NewsCategory"("name");

-- CreateIndex
CREATE INDEX "NewsCategory_isActive_sortOrder_idx" ON "NewsCategory"("isActive", "sortOrder");

-- CreateIndex
CREATE INDEX "NewsCategory_deletedAt_purgeAt_idx" ON "NewsCategory"("deletedAt", "purgeAt");

-- CreateIndex
CREATE UNIQUE INDEX "News_slug_key" ON "News"("slug");

-- CreateIndex
CREATE INDEX "News_categoryId_status_publishedAt_idx" ON "News"("categoryId", "status", "publishedAt");

-- CreateIndex
CREATE INDEX "News_status_publishedAt_idx" ON "News"("status", "publishedAt");

-- CreateIndex
CREATE INDEX "News_isFeatured_status_idx" ON "News"("isFeatured", "status");

-- CreateIndex
CREATE INDEX "News_deletedAt_purgeAt_idx" ON "News"("deletedAt", "purgeAt");

-- CreateIndex
CREATE INDEX "News_coverMediaId_idx" ON "News"("coverMediaId");

-- CreateIndex
CREATE UNIQUE INDEX "Media_objectKey_key" ON "Media"("objectKey");

-- CreateIndex
CREATE INDEX "Media_kind_createdAt_idx" ON "Media"("kind", "createdAt");

-- CreateIndex
CREATE INDEX "Media_uploadedById_idx" ON "Media"("uploadedById");

-- CreateIndex
CREATE INDEX "Media_deletedAt_purgeAt_idx" ON "Media"("deletedAt", "purgeAt");

-- CreateIndex
CREATE UNIQUE INDEX "Admin_username_key" ON "Admin"("username");

-- CreateIndex
CREATE UNIQUE INDEX "Admin_usernameNormalized_key" ON "Admin"("usernameNormalized");

-- CreateIndex
CREATE INDEX "Admin_role_isActive_idx" ON "Admin"("role", "isActive");

-- CreateIndex
CREATE INDEX "Admin_deletedAt_purgeAt_idx" ON "Admin"("deletedAt", "purgeAt");

-- CreateIndex
CREATE INDEX "Admin_lockedUntil_idx" ON "Admin"("lockedUntil");

-- CreateIndex
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");

-- CreateIndex
CREATE INDEX "Session_adminId_revokedAt_expiresAt_idx" ON "Session"("adminId", "revokedAt", "expiresAt");

-- CreateIndex
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");

-- CreateIndex
CREATE INDEX "RecoveryCode_adminId_usedAt_idx" ON "RecoveryCode"("adminId", "usedAt");

-- CreateIndex
CREATE UNIQUE INDEX "RecoveryCode_adminId_codeHash_key" ON "RecoveryCode"("adminId", "codeHash");

-- CreateIndex
CREATE INDEX "AuditLog_actorId_createdAt_idx" ON "AuditLog"("actorId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_action_createdAt_idx" ON "AuditLog"("action", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_targetType_targetId_createdAt_idx" ON "AuditLog"("targetType", "targetId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_requestId_idx" ON "AuditLog"("requestId");

-- CreateIndex
CREATE UNIQUE INDEX "Redirect_fromPath_key" ON "Redirect"("fromPath");

-- CreateIndex
CREATE INDEX "Redirect_isActive_fromPath_idx" ON "Redirect"("isActive", "fromPath");

-- AddForeignKey
ALTER TABLE "Company" ADD CONSTRAINT "Company_logoMediaId_fkey" FOREIGN KEY ("logoMediaId") REFERENCES "Media"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Banner" ADD CONSTRAINT "Banner_imageId_fkey" FOREIGN KEY ("imageId") REFERENCES "Media"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Service" ADD CONSTRAINT "Service_coverMediaId_fkey" FOREIGN KEY ("coverMediaId") REFERENCES "Media"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_productTypeId_fkey" FOREIGN KEY ("productTypeId") REFERENCES "ProductType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_coverMediaId_fkey" FOREIGN KEY ("coverMediaId") REFERENCES "Media"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_catalogMediaId_fkey" FOREIGN KEY ("catalogMediaId") REFERENCES "Media"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductMedia" ADD CONSTRAINT "ProductMedia_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductMedia" ADD CONSTRAINT "ProductMedia_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "Media"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_coverMediaId_fkey" FOREIGN KEY ("coverMediaId") REFERENCES "Media"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectMedia" ADD CONSTRAINT "ProjectMedia_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectMedia" ADD CONSTRAINT "ProjectMedia_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "Media"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectService" ADD CONSTRAINT "ProjectService_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectService" ADD CONSTRAINT "ProjectService_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "News" ADD CONSTRAINT "News_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "NewsCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "News" ADD CONSTRAINT "News_coverMediaId_fkey" FOREIGN KEY ("coverMediaId") REFERENCES "Media"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Media" ADD CONSTRAINT "Media_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "Admin"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "Admin"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecoveryCode" ADD CONSTRAINT "RecoveryCode_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "Admin"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "Admin"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Domain integrity constraints not expressible in the Prisma schema.
ALTER TABLE "Banner" ADD CONSTRAINT "Banner_sortOrder_nonnegative" CHECK ("sortOrder" >= 0);
ALTER TABLE "Service" ADD CONSTRAINT "Service_sortOrder_nonnegative" CHECK ("sortOrder" >= 0);
ALTER TABLE "Brand" ADD CONSTRAINT "Brand_sortOrder_nonnegative" CHECK ("sortOrder" >= 0);
ALTER TABLE "ProductType" ADD CONSTRAINT "ProductType_sortOrder_nonnegative" CHECK ("sortOrder" >= 0);
ALTER TABLE "NewsCategory" ADD CONSTRAINT "NewsCategory_sortOrder_nonnegative" CHECK ("sortOrder" >= 0);
ALTER TABLE "ProductMedia" ADD CONSTRAINT "ProductMedia_sortOrder_nonnegative" CHECK ("sortOrder" >= 0);
ALTER TABLE "ProjectMedia" ADD CONSTRAINT "ProjectMedia_sortOrder_nonnegative" CHECK ("sortOrder" >= 0);

ALTER TABLE "Product" ADD CONSTRAINT "Product_btu_positive" CHECK (("btuMin" IS NULL OR "btuMin" > 0) AND ("btuMax" IS NULL OR "btuMax" > 0));
ALTER TABLE "Product" ADD CONSTRAINT "Product_btu_range" CHECK ("btuMin" IS NULL OR "btuMax" IS NULL OR "btuMin" <= "btuMax");
ALTER TABLE "Product" ADD CONSTRAINT "Product_seer_positive" CHECK ("seer" IS NULL OR "seer" > 0);
ALTER TABLE "Media" ADD CONSTRAINT "Media_size_positive" CHECK ("sizeBytes" > 0);
ALTER TABLE "Media" ADD CONSTRAINT "Media_dimensions_positive" CHECK (("width" IS NULL OR "width" > 0) AND ("height" IS NULL OR "height" > 0));
ALTER TABLE "Admin" ADD CONSTRAINT "Admin_failedLoginAttempts_nonnegative" CHECK ("failedLoginAttempts" >= 0);
ALTER TABLE "Redirect" ADD CONSTRAINT "Redirect_statusCode_supported" CHECK ("statusCode" IN (301, 308));
ALTER TABLE "Redirect" ADD CONSTRAINT "Redirect_paths_different" CHECK ("fromPath" <> "toPath");
ALTER TABLE "Redirect" ADD CONSTRAINT "Redirect_paths_absolute" CHECK ("fromPath" LIKE '/%' AND "toPath" LIKE '/%');

ALTER TABLE "Banner" ADD CONSTRAINT "Banner_purge_after_delete" CHECK ("purgeAt" IS NULL OR ("deletedAt" IS NOT NULL AND "purgeAt" >= "deletedAt"));
ALTER TABLE "Service" ADD CONSTRAINT "Service_purge_after_delete" CHECK ("purgeAt" IS NULL OR ("deletedAt" IS NOT NULL AND "purgeAt" >= "deletedAt"));
ALTER TABLE "Brand" ADD CONSTRAINT "Brand_purge_after_delete" CHECK ("purgeAt" IS NULL OR ("deletedAt" IS NOT NULL AND "purgeAt" >= "deletedAt"));
ALTER TABLE "ProductType" ADD CONSTRAINT "ProductType_purge_after_delete" CHECK ("purgeAt" IS NULL OR ("deletedAt" IS NOT NULL AND "purgeAt" >= "deletedAt"));
ALTER TABLE "Product" ADD CONSTRAINT "Product_purge_after_delete" CHECK ("purgeAt" IS NULL OR ("deletedAt" IS NOT NULL AND "purgeAt" >= "deletedAt"));
ALTER TABLE "Project" ADD CONSTRAINT "Project_purge_after_delete" CHECK ("purgeAt" IS NULL OR ("deletedAt" IS NOT NULL AND "purgeAt" >= "deletedAt"));
ALTER TABLE "NewsCategory" ADD CONSTRAINT "NewsCategory_purge_after_delete" CHECK ("purgeAt" IS NULL OR ("deletedAt" IS NOT NULL AND "purgeAt" >= "deletedAt"));
ALTER TABLE "News" ADD CONSTRAINT "News_purge_after_delete" CHECK ("purgeAt" IS NULL OR ("deletedAt" IS NOT NULL AND "purgeAt" >= "deletedAt"));
ALTER TABLE "Media" ADD CONSTRAINT "Media_purge_after_delete" CHECK ("purgeAt" IS NULL OR ("deletedAt" IS NOT NULL AND "purgeAt" >= "deletedAt"));
ALTER TABLE "Admin" ADD CONSTRAINT "Admin_purge_after_delete" CHECK ("purgeAt" IS NULL OR ("deletedAt" IS NOT NULL AND "purgeAt" >= "deletedAt"));

-- Slugs and usernames are normalized by the service layer; these indexes make
-- uniqueness safe even if data is inserted outside the application.
CREATE UNIQUE INDEX "Admin_username_ci_key" ON "Admin" (LOWER("username"));
CREATE UNIQUE INDEX "Service_slug_ci_key" ON "Service" (LOWER("slug"));
CREATE UNIQUE INDEX "Brand_slug_ci_key" ON "Brand" (LOWER("slug"));
CREATE UNIQUE INDEX "Brand_name_ci_key" ON "Brand" (LOWER("name"));
CREATE UNIQUE INDEX "ProductType_slug_ci_key" ON "ProductType" (LOWER("slug"));
CREATE UNIQUE INDEX "ProductType_name_ci_key" ON "ProductType" (LOWER("name"));
CREATE UNIQUE INDEX "Product_slug_ci_key" ON "Product" (LOWER("slug"));
CREATE UNIQUE INDEX "Project_slug_ci_key" ON "Project" (LOWER("slug"));
CREATE UNIQUE INDEX "NewsCategory_slug_ci_key" ON "NewsCategory" (LOWER("slug"));
CREATE UNIQUE INDEX "NewsCategory_name_ci_key" ON "NewsCategory" (LOWER("name"));
CREATE UNIQUE INDEX "News_slug_ci_key" ON "News" (LOWER("slug"));
