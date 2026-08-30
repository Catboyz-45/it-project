-- Authentication throttling is owned exclusively by AuthThrottle. Keeping a
-- second lock state on Admin risks inconsistent authorization decisions.
DROP INDEX IF EXISTS "Admin_lockedUntil_idx";
ALTER TABLE "Admin" DROP CONSTRAINT IF EXISTS "Admin_failedLoginAttempts_nonnegative";
ALTER TABLE "Admin"
  DROP COLUMN IF EXISTS "failedLoginAttempts",
  DROP COLUMN IF EXISTS "lockedUntil";
