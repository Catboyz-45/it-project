-- Case-normalized uniqueness closes races where two requests use differently
-- cased values that resolve to the same public URL or taxonomy label.
CREATE UNIQUE INDEX "Service_slug_lower_key" ON "Service" (lower("slug"));
CREATE UNIQUE INDEX "Product_slug_lower_key" ON "Product" (lower("slug"));
CREATE UNIQUE INDEX "Project_slug_lower_key" ON "Project" (lower("slug"));
CREATE UNIQUE INDEX "News_slug_lower_key" ON "News" (lower("slug"));
CREATE UNIQUE INDEX "Brand_slug_lower_key" ON "Brand" (lower("slug"));
CREATE UNIQUE INDEX "ProductType_slug_lower_key" ON "ProductType" (lower("slug"));
CREATE UNIQUE INDEX "NewsCategory_slug_lower_key" ON "NewsCategory" (lower("slug"));
CREATE UNIQUE INDEX "Brand_name_lower_key" ON "Brand" (lower("name"));
CREATE UNIQUE INDEX "ProductType_name_lower_key" ON "ProductType" (lower("name"));
CREATE UNIQUE INDEX "NewsCategory_name_lower_key" ON "NewsCategory" (lower("name"));

-- Published rows always carry a publication timestamp; trashed rows always
-- carry a retention deadline. Business services preserve both invariants.
ALTER TABLE "Banner" ADD CONSTRAINT "Banner_publication_state" CHECK ("status" <> 'PUBLISHED' OR "publishedAt" IS NOT NULL);
ALTER TABLE "Service" ADD CONSTRAINT "Service_publication_state" CHECK ("status" <> 'PUBLISHED' OR "publishedAt" IS NOT NULL);
ALTER TABLE "Product" ADD CONSTRAINT "Product_publication_state" CHECK ("status" <> 'PUBLISHED' OR "publishedAt" IS NOT NULL);
ALTER TABLE "Project" ADD CONSTRAINT "Project_publication_state" CHECK ("status" <> 'PUBLISHED' OR "publishedAt" IS NOT NULL);
ALTER TABLE "News" ADD CONSTRAINT "News_publication_state" CHECK ("status" <> 'PUBLISHED' OR "publishedAt" IS NOT NULL);
ALTER TABLE "Banner" ADD CONSTRAINT "Banner_trash_retention_required" CHECK ("deletedAt" IS NULL OR "purgeAt" IS NOT NULL);
ALTER TABLE "Service" ADD CONSTRAINT "Service_trash_retention_required" CHECK ("deletedAt" IS NULL OR "purgeAt" IS NOT NULL);
ALTER TABLE "Product" ADD CONSTRAINT "Product_trash_retention_required" CHECK ("deletedAt" IS NULL OR "purgeAt" IS NOT NULL);
ALTER TABLE "Project" ADD CONSTRAINT "Project_trash_retention_required" CHECK ("deletedAt" IS NULL OR "purgeAt" IS NOT NULL);
ALTER TABLE "News" ADD CONSTRAINT "News_trash_retention_required" CHECK ("deletedAt" IS NULL OR "purgeAt" IS NOT NULL);
