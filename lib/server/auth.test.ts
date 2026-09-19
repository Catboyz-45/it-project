import { describe, expect, it } from "vitest";
import { requirePropertyAccess, requireRole, type AuthContext } from "@/lib/server/auth";

const propertyAdmin: AuthContext = {
  userId: "user-1",
  email: "admin@example.com",
  displayName: "Admin",
  role: "PROPERTY_ADMIN",
  propertyIds: ["property-a"],
};

// กฎการเข้าถึงหอพัก เป็นด่านที่กันไม่ให้เจ้าของหอคนหนึ่งเห็นข้อมูลของอีกหอ
describe("authorization", () => {
  it("allows an assigned property", () => {
    expect(() => requirePropertyAccess(propertyAdmin, "property-a")).not.toThrow();
  });

  // หอที่ไม่มีสิทธิ์ต้องตอบว่าไม่พบข้อมูล ไม่ใช่บอกว่าไม่มีสิทธิ์ เพราะแบบหลังเท่ากับยืนยันว่าหอนั้นมีอยู่จริง
  it("hides an unassigned property", () => {
    expect(() => requirePropertyAccess(propertyAdmin, "property-b")).toThrowError("ไม่พบข้อมูล");
  });

  it("allows a super admin to access any property", () => {
    expect(() => requirePropertyAccess({ ...propertyAdmin, role: "SUPER_ADMIN", propertyIds: [] }, "property-b")).not.toThrow();
  });

  it("denies a role mismatch", () => {
    expect(() => requireRole(propertyAdmin, "SUPER_ADMIN")).toThrowError("คุณไม่มีสิทธิ์ดำเนินการ");
  });
});
