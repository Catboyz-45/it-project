/**
 * หน้าที่ของไฟล์นี้: ชุดทดสอบ admin-rules.test ยืนยันว่าพฤติกรรมสำคัญยังถูกต้องเมื่อมีการแก้โค้ด
 * ผู้อ่านทั่วไปควรดูคู่มือใน docs ควบคู่กับคอมเมนต์ใกล้กฎสำคัญ
 */
import { AdminRole } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { wouldRemoveLastActiveSuperAdmin } from "@/server/auth/admin-rules";

describe("last Super Admin rule", () => {
  const target = { role: AdminRole.SUPER_ADMIN, isActive: true };

  it("blocks demotion and disablement of the final active Super Admin", () => {
    expect(wouldRemoveLastActiveSuperAdmin(target, { role: AdminRole.EDITOR }, 1)).toBe(true);
    expect(wouldRemoveLastActiveSuperAdmin(target, { isActive: false }, 1)).toBe(true);
  });

  it("allows the change when another active Super Admin remains", () => {
    expect(wouldRemoveLastActiveSuperAdmin(target, { role: AdminRole.EDITOR }, 2)).toBe(false);
    expect(wouldRemoveLastActiveSuperAdmin(target, { isActive: false }, 2)).toBe(false);
  });

  it("does not block unrelated account updates", () => {
    expect(wouldRemoveLastActiveSuperAdmin(target, {}, 1)).toBe(false);
    expect(wouldRemoveLastActiveSuperAdmin({ role: AdminRole.EDITOR, isActive: true }, { isActive: false }, 1)).toBe(false);
  });
});
