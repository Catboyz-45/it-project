/**
 * หน้าที่ของไฟล์นี้: ชุดทดสอบ security-controls.test ยืนยันว่าพฤติกรรมสำคัญยังถูกต้องเมื่อมีการแก้โค้ด
 * ผู้อ่านทั่วไปควรดูคู่มือใน docs ควบคู่กับคอมเมนต์ใกล้กฎสำคัญ
 */
import { AdminRole } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { can, type Permission } from "@/server/auth/permissions";
import { calculateLockout } from "@/server/auth/throttle";
import { isSameOrigin } from "@/server/security/request";
import { errorDetails } from "@/server/observability/logger";

describe("RBAC permission matrix", () => {
  const content: Permission[] = ["CMS_READ", "CMS_WRITE", "MEDIA_WRITE"];
  it.each(content)("allows Editor to %s", permission => expect(can(AdminRole.EDITOR, permission)).toBe(true));
  it.each(["ADMIN_MANAGE", "AUDIT_READ", "PURGE_EARLY"] as Permission[])("denies Editor permission %s", permission => expect(can(AdminRole.EDITOR, permission)).toBe(false));
  it.each(["CMS_READ", "CMS_WRITE", "MEDIA_WRITE", "ADMIN_MANAGE", "AUDIT_READ", "PURGE_EARLY"] as Permission[])("allows Super Admin permission %s", permission => expect(can(AdminRole.SUPER_ADMIN, permission)).toBe(true));
});

describe("request security", () => {
  it("accepts only an exact origin match", () => {
    expect(isSameOrigin("https://cms.example.com", "https://cms.example.com/admin")).toBe(true);
    expect(isSameOrigin("https://evil.example.com", "https://cms.example.com")).toBe(false);
    expect(isSameOrigin("https://cms.example.com.evil.test", "https://cms.example.com")).toBe(false);
    expect(isSameOrigin(null, "https://cms.example.com")).toBe(false);
    expect(isSameOrigin("not a url", "https://cms.example.com")).toBe(false);
  });
  it("delays progressively and locks fully at the configured threshold", () => {
    const now = Date.parse("2026-09-01T00:00:00Z");
    expect(calculateLockout(1, 5, 15, now)).toBeNull();
    expect(calculateLockout(4, 5, 15, now)?.toISOString()).toBe("2026-09-01T00:00:04.000Z");
    expect(calculateLockout(5, 5, 15, now)?.toISOString()).toBe("2026-09-01T00:15:00.000Z");
    expect(calculateLockout(8, 5, 15, now)?.toISOString()).toBe("2026-09-01T00:15:00.000Z");
  });
  it("does not expose stack traces through normalized error details", () => {
    const details = errorDetails(new Error("database unavailable"));
    expect(details).toEqual({ errorName: "Error", errorMessage: "database unavailable" });
    expect(details).not.toHaveProperty("stack");
  });
});
