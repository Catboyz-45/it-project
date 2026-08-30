ALTER TABLE "Admin" ADD COLUMN "lastTotpTimeStep" INTEGER;

ALTER TABLE "Admin"
ADD CONSTRAINT "Admin_lastTotpTimeStep_nonnegative"
CHECK ("lastTotpTimeStep" IS NULL OR "lastTotpTimeStep" >= 0);
